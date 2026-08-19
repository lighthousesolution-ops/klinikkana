"""Backend tests for Klinik Kana public-sync endpoints."""
import os
import time
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL")
            or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _snapshot(ticket, status="pending", **overrides):
    doc = {
        "ticket_no": ticket,
        "status": status,
        "device_brand": "TEST_BRAND",
        "device_model": "TEST_MODEL",
        "complaint": "TEST complaint",
        "customer_name": "TEST Cust",
        "customer_phone": "0800000000",
        "total": 100000,
        "paid": 0,
        "balance": 100000,
    }
    doc.update(overrides)
    return doc


# ---- Health ----
class TestHealth:
    def test_api_root(self, client):
        r = client.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert "message" in r.json()


# ---- Public sync CRUD ----
class TestPublicSync:
    ticket = f"TEST-{int(time.time())}-A"

    def test_get_missing_returns_404(self, client):
        r = client.get(f"{BASE_URL}/api/public-sync/DOES_NOT_EXIST_{int(time.time())}")
        assert r.status_code == 404

    def test_post_and_get(self, client):
        r = client.post(f"{BASE_URL}/api/public-sync/{self.ticket}",
                        json=_snapshot(self.ticket, "pending"))
        assert r.status_code == 200
        assert r.json().get("success") is True

        g = client.get(f"{BASE_URL}/api/public-sync/{self.ticket}")
        assert g.status_code == 200
        data = g.json()
        assert data["ticket_no"] == self.ticket
        assert data["status"] == "pending"
        assert data["device_brand"] == "TEST_BRAND"
        assert "_id" not in data

    def test_update_status_persists(self, client):
        r = client.post(f"{BASE_URL}/api/public-sync/{self.ticket}",
                        json=_snapshot(self.ticket, "ready"))
        assert r.status_code == 200
        g = client.get(f"{BASE_URL}/api/public-sync/{self.ticket}").json()
        assert g["status"] == "ready"

    def test_only_if_new_does_not_overwrite(self, client):
        # currently status=ready; seed push should NOT overwrite
        r = client.post(f"{BASE_URL}/api/public-sync/{self.ticket}?only_if_new=true",
                        json=_snapshot(self.ticket, "pending"))
        assert r.status_code == 200
        assert r.json().get("inserted") is False
        g = client.get(f"{BASE_URL}/api/public-sync/{self.ticket}").json()
        assert g["status"] == "ready"  # unchanged

    def test_only_if_new_inserts_new(self, client):
        new_ticket = f"TEST-{int(time.time())}-NEW"
        r = client.post(f"{BASE_URL}/api/public-sync/{new_ticket}?only_if_new=true",
                        json=_snapshot(new_ticket, "pending"))
        assert r.status_code == 200
        assert r.json().get("inserted") is True
        g = client.get(f"{BASE_URL}/api/public-sync/{new_ticket}").json()
        assert g["status"] == "pending"


# ---- Rating endpoint ----
class TestPublicRating:
    ticket = f"TEST-RATE-{int(time.time())}"

    def test_rate_requires_picked_up(self, client):
        client.post(f"{BASE_URL}/api/public-sync/{self.ticket}",
                    json=_snapshot(self.ticket, "ready"))
        r = client.post(f"{BASE_URL}/api/public-sync/{self.ticket}/rating",
                        json={"rating": 5, "review": "great"})
        assert r.status_code == 400

    def test_rate_out_of_range(self, client):
        client.post(f"{BASE_URL}/api/public-sync/{self.ticket}",
                    json=_snapshot(self.ticket, "picked_up"))
        r = client.post(f"{BASE_URL}/api/public-sync/{self.ticket}/rating",
                        json={"rating": 6, "review": ""})
        assert r.status_code == 400

    def test_rate_success(self, client):
        r = client.post(f"{BASE_URL}/api/public-sync/{self.ticket}/rating",
                        json={"rating": 5, "review": "TEST review"})
        assert r.status_code == 200
        data = r.json()
        assert data["rating"] == 5
        # verify persisted
        g = client.get(f"{BASE_URL}/api/public-sync/{self.ticket}").json()
        assert g["rating"] == 5
        assert g["review"] == "TEST review"
        assert g["rated_at"]

    def test_rate_duplicate_conflict(self, client):
        r = client.post(f"{BASE_URL}/api/public-sync/{self.ticket}/rating",
                        json={"rating": 4, "review": "again"})
        assert r.status_code == 409

    def test_rate_missing_ticket(self, client):
        r = client.post(f"{BASE_URL}/api/public-sync/NONEXISTENT_TKT/rating",
                        json={"rating": 5})
        assert r.status_code == 404


# ---- Reviews list + admin reply ----
class TestReviewsAndReply:
    ticket = f"TEST-REV-{int(time.time())}"

    def test_setup_and_rate(self, client):
        # create a picked_up snapshot then rate it
        r = client.post(f"{BASE_URL}/api/public-sync/{self.ticket}",
                        json=_snapshot(self.ticket, "picked_up", customer_name="TEST Reviewer"))
        assert r.status_code == 200
        r = client.post(f"{BASE_URL}/api/public-sync/{self.ticket}/rating",
                        json={"rating": 4, "review": "TEST reviews-endpoint check"})
        assert r.status_code == 200

    def test_list_reviews_includes_new(self, client):
        r = client.get(f"{BASE_URL}/api/public-sync/reviews")
        assert r.status_code == 200
        body = r.json()
        assert "reviews" in body and isinstance(body["reviews"], list)
        tickets = [x["ticket_no"] for x in body["reviews"]]
        assert self.ticket in tickets
        row = next(x for x in body["reviews"] if x["ticket_no"] == self.ticket)
        assert row["rating"] == 4
        assert row["review"] == "TEST reviews-endpoint check"
        assert "_id" not in row

    def test_reply_requires_existing_rating(self, client):
        # ticket without any rating
        blank_ticket = f"TEST-NORATE-{int(time.time())}"
        client.post(f"{BASE_URL}/api/public-sync/{blank_ticket}",
                    json=_snapshot(blank_ticket, "picked_up"))
        r = client.post(f"{BASE_URL}/api/public-sync/{blank_ticket}/reply",
                        json={"reply": "hi", "admin_reply_by_name": "Admin"})
        assert r.status_code == 400

    def test_reply_missing_ticket_404(self, client):
        r = client.post(f"{BASE_URL}/api/public-sync/NOSUCH_TKT_XYZ/reply",
                        json={"reply": "hi"})
        assert r.status_code == 404

    def test_submit_and_persist_reply(self, client):
        r = client.post(f"{BASE_URL}/api/public-sync/{self.ticket}/reply",
                        json={"reply": "TEST admin reply text", "admin_reply_by_name": "Andi Wijaya"})
        assert r.status_code == 200
        assert r.json().get("success") is True
        g = client.get(f"{BASE_URL}/api/public-sync/{self.ticket}").json()
        assert g["admin_reply"] == "TEST admin reply text"
        assert g["admin_reply_by_name"] == "Andi Wijaya"
        assert g["admin_reply_at"]

    def test_empty_reply_deletes(self, client):
        r = client.post(f"{BASE_URL}/api/public-sync/{self.ticket}/reply",
                        json={"reply": ""})
        assert r.status_code == 200
        assert r.json().get("deleted") is True
        g = client.get(f"{BASE_URL}/api/public-sync/{self.ticket}").json()
        assert g.get("admin_reply") in (None, "")
        assert not g.get("admin_reply_at")

    def test_reply_too_long(self, client):
        r = client.post(f"{BASE_URL}/api/public-sync/{self.ticket}/reply",
                        json={"reply": "x" * 501})
        assert r.status_code == 400
