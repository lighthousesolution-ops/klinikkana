"""
Iteration 11 verification of the PHP backend fixes:
  1. PUT /api/repairs/index.php  -> full-object payload persists BOTH status and field edits
  2. completed_at / picked_up_at guarded by COALESCE (no re-stamping)
  3. POST/DELETE /api/repairs/reply.php -> require_role(['admin']) (200 admin / 403 non-admin / 401 unauth)
  4. Global exception handler returns generic JSON 500 without leaking paths/stack traces
Target: PHP + SQLite harness at http://localhost:8888
"""
import os
import time
import pytest
import requests

PHP_URL = os.environ.get("PHP_TEST_URL", "http://localhost:8888").rstrip("/")


def _login(username, password):
    r = requests.post(f"{PHP_URL}/api/auth/login.php",
                      json={"username": username, "password": password}, timeout=15)
    assert r.status_code == 200, f"login {username} failed {r.status_code}: {r.text[:200]}"
    return r.json()["token"]


def _session(token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def client():
    return _session(_login("admin", "admin123"))


@pytest.fixture(scope="module")
def tech_client(client):
    """Create a technician user (non-admin) for role-guard checks."""
    uid = "u_qa_i11_tech"
    client.delete(f"{PHP_URL}/api/users/index.php?id={uid}")
    r = client.post(f"{PHP_URL}/api/users/index.php",
                    json={"id": uid, "username": "qa_i11_tech", "password": "QaPass!23",
                          "full_name": "QA I11 Tech", "role": "technician"})
    assert r.status_code == 201, r.text[:300]
    sess = _session(_login("qa_i11_tech", "QaPass!23"))
    yield sess
    client.delete(f"{PHP_URL}/api/users/index.php?id={uid}")


# ---------- 1. FULL-OBJECT PUT PERSISTS EVERYTHING ----------
class TestFullObjectPut:
    RID = "r_qa_i11_full"

    def test_01_create(self, client):
        client.delete(f"{PHP_URL}/api/repairs/index.php?id={self.RID}")
        r = client.post(f"{PHP_URL}/api/repairs/index.php",
                        json={"id": self.RID, "customer_id": "c1", "device_brand": "iPhone",
                              "device_model": "X", "serial_no": "SN-OLD", "complaint": "orig",
                              "notes": "n-old", "service_fee": 100000, "deposit": 0,
                              "status": "pending"})
        assert r.status_code == 201, r.text[:300]

    def test_02_status_plus_fields_both_persist(self, client):
        payload = {
            "id": self.RID, "customer_id": "c1", "status": "in_progress",
            "device_brand": "Samsung", "device_model": "S23", "serial_no": "SN-NEW",
            "complaint": "EDITED", "notes": "n-new",
            "service_fee": 999000, "deposit": 111000, "technician_id": "u2",
            "parts_used": [], "payments": [],
        }
        r = client.put(f"{PHP_URL}/api/repairs/index.php?id={self.RID}", json=payload)
        assert r.status_code == 200, r.text[:300]
        g = client.get(f"{PHP_URL}/api/repairs/index.php?id={self.RID}")
        assert g.status_code == 200
        d = g.json()
        assert d["status"] == "in_progress"
        assert d["device_brand"] == "Samsung"
        assert d["device_model"] == "S23"
        assert d["serial_no"] == "SN-NEW"
        assert d["complaint"] == "EDITED"
        assert d["notes"] == "n-new"
        assert float(d["service_fee"]) == 999000
        assert float(d["deposit"]) == 111000
        assert str(d["technician_id"]) == "u2"

    def test_03_status_only_put_keeps_fields(self, client):
        r = client.put(f"{PHP_URL}/api/repairs/index.php?id={self.RID}", json={"status": "ready"})
        assert r.status_code == 200, r.text[:300]
        d = client.get(f"{PHP_URL}/api/repairs/index.php?id={self.RID}").json()
        assert d["status"] == "ready"
        assert d["device_brand"] == "Samsung", "status-only PUT wiped field data"
        assert float(d["service_fee"]) == 999000

    def test_04_cleanup(self, client):
        assert client.delete(f"{PHP_URL}/api/repairs/index.php?id={self.RID}").status_code == 200


# ---------- 2. COALESCE TIMESTAMP GUARD ----------
class TestTimestampNoRestamp:
    RID = "r_qa_i11_ts"

    def test_01_create(self, client):
        client.delete(f"{PHP_URL}/api/repairs/index.php?id={self.RID}")
        r = client.post(f"{PHP_URL}/api/repairs/index.php",
                        json={"id": self.RID, "customer_id": "c1", "device_brand": "Oppo",
                              "device_model": "A5", "complaint": "ts test", "service_fee": 1000,
                              "deposit": 0})
        assert r.status_code == 201, r.text[:300]

    def test_02_completed_at_not_restamped(self, client):
        r1 = client.put(f"{PHP_URL}/api/repairs/index.php?id={self.RID}", json={"status": "ready"})
        assert r1.status_code == 200
        first = r1.json()["completed_at"]
        assert first, "completed_at not stamped on first ready"
        time.sleep(2)
        r2 = client.put(f"{PHP_URL}/api/repairs/index.php?id={self.RID}",
                        json={"status": "ready", "device_brand": "Oppo", "device_model": "A5",
                              "complaint": "ts test 2", "service_fee": 1000, "deposit": 0})
        assert r2.status_code == 200
        second = r2.json()["completed_at"]
        assert second == first, f"completed_at re-stamped: {first} -> {second}"

    def test_03_picked_up_at_not_restamped(self, client):
        r1 = client.put(f"{PHP_URL}/api/repairs/index.php?id={self.RID}", json={"status": "picked_up"})
        assert r1.status_code == 200
        first = r1.json()["picked_up_at"]
        assert first, "picked_up_at not stamped"
        completed_first = r1.json()["completed_at"]
        time.sleep(2)
        r2 = client.put(f"{PHP_URL}/api/repairs/index.php?id={self.RID}", json={"status": "picked_up"})
        assert r2.status_code == 200
        assert r2.json()["picked_up_at"] == first, "picked_up_at re-stamped"
        assert r2.json()["completed_at"] == completed_first, "completed_at changed on picked_up PUT"

    def test_04_cleanup(self, client):
        assert client.delete(f"{PHP_URL}/api/repairs/index.php?id={self.RID}").status_code == 200


# ---------- 3. REPLY.PHP ROLE GUARDS ----------
class TestReplyAuth:
    RID = "r_qa_i11_reply"
    TICKET = None

    def test_01_setup_repair_with_rating(self, client):
        client.delete(f"{PHP_URL}/api/repairs/index.php?id={self.RID}")
        r = client.post(f"{PHP_URL}/api/repairs/index.php",
                        json={"id": self.RID, "customer_id": "c1", "device_brand": "Vivo",
                              "device_model": "Y20", "complaint": "reply test",
                              "service_fee": 20000, "deposit": 0})
        assert r.status_code == 201, r.text[:300]
        TestReplyAuth.TICKET = r.json()["ticket_no"]
        assert client.put(f"{PHP_URL}/api/repairs/index.php?id={self.RID}",
                          json={"status": "picked_up"}).status_code == 200
        rr = requests.post(f"{PHP_URL}/api/public/rating.php",
                           json={"ticket": self.TICKET, "rating": 5, "review": "bagus"}, timeout=15)
        assert rr.status_code in (200, 201), rr.text[:300]

    def test_02_unauth_reply_401(self):
        r = requests.post(f"{PHP_URL}/api/repairs/reply.php?id={self.RID}",
                          json={"reply": "hack"}, timeout=15)
        assert r.status_code == 401, f"{r.status_code}: {r.text[:200]}"

    def test_03_non_admin_reply_403(self, tech_client):
        r = tech_client.post(f"{PHP_URL}/api/repairs/reply.php?id={self.RID}",
                             json={"reply": "tech reply"})
        assert r.status_code == 403, f"{r.status_code}: {r.text[:200]}"

    def test_04_admin_reply_200_and_persists(self, client):
        r = client.post(f"{PHP_URL}/api/repairs/reply.php?id={self.RID}",
                        json={"reply": "Terima kasih atas ulasannya"})
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["success"] is True
        assert d["admin_reply"] == "Terima kasih atas ulasannya"
        g = client.get(f"{PHP_URL}/api/repairs/index.php?id={self.RID}").json()
        assert g["admin_reply"] == "Terima kasih atas ulasannya"
        assert str(g["admin_reply_by"]) == "u1"
        assert g["admin_reply_at"]

    def test_05_empty_reply_rejected(self, client):
        r = client.post(f"{PHP_URL}/api/repairs/reply.php?id={self.RID}", json={"reply": "  "})
        assert r.status_code == 400

    def test_06_too_long_reply_rejected(self, client):
        r = client.post(f"{PHP_URL}/api/repairs/reply.php?id={self.RID}", json={"reply": "x" * 501})
        assert r.status_code == 400

    def test_07_reply_on_unrated_ticket_400(self, client):
        rid = "r_qa_i11_norate"
        client.delete(f"{PHP_URL}/api/repairs/index.php?id={rid}")
        c = client.post(f"{PHP_URL}/api/repairs/index.php",
                        json={"id": rid, "customer_id": "c1", "device_brand": "Xiaomi",
                              "device_model": "N9", "complaint": "no rating"})
        assert c.status_code == 201
        r = client.post(f"{PHP_URL}/api/repairs/reply.php?id={rid}", json={"reply": "hi"})
        assert r.status_code == 400
        client.delete(f"{PHP_URL}/api/repairs/index.php?id={rid}")

    def test_08_reply_unknown_ticket_404(self, client):
        r = client.post(f"{PHP_URL}/api/repairs/reply.php?id=r_does_not_exist",
                        json={"reply": "hi"})
        assert r.status_code == 404

    def test_09_non_admin_delete_403(self, tech_client):
        r = tech_client.delete(f"{PHP_URL}/api/repairs/reply.php?id={self.RID}")
        assert r.status_code == 403, f"{r.status_code}: {r.text[:200]}"

    def test_10_admin_delete_reply_200(self, client):
        r = client.delete(f"{PHP_URL}/api/repairs/reply.php?id={self.RID}")
        assert r.status_code == 200, r.text[:300]
        assert r.json()["success"] is True
        g = client.get(f"{PHP_URL}/api/repairs/index.php?id={self.RID}").json()
        assert not g["admin_reply"]
        assert not g["admin_reply_by"]

    def test_11_cleanup(self, client):
        assert client.delete(f"{PHP_URL}/api/repairs/index.php?id={self.RID}").status_code == 200


# ---------- 4. NO STACK TRACE LEAK ----------
class TestNoErrorLeak:
    LEAKS = ["Fatal error", "Stack trace", "/app/php-backend", ".php:", "SQLSTATE",
             "PDOException", "Warning:", "<br />"]

    def test_01_stats_php_error_is_generic(self, client):
        """stats.php uses MySQL-only SQL -> on the SQLite harness it raises PDOException.
        The global handler must return a generic JSON 500 with no leaked internals."""
        r = client.get(f"{PHP_URL}/api/dashboard/stats.php")
        if r.status_code == 200:
            pytest.skip("stats.php returned 200 on harness - cannot exercise the fatal path here")
        assert r.status_code == 500, r.status_code
        body = r.text
        for token in self.LEAKS:
            assert token not in body, f"leaked '{token}' in error body: {body[:400]}"
        assert r.json() == {"error": "Internal server error"}, body[:300]

    def test_02_bad_json_body_no_leak(self, client):
        r = client.put(f"{PHP_URL}/api/repairs/index.php?id=r_nope",
                       data="{not-json", headers={"Content-Type": "application/json"})
        assert r.status_code < 500 or "Fatal error" not in r.text
        for token in self.LEAKS:
            assert token not in r.text, f"leaked '{token}': {r.text[:300]}"

    def test_03_method_not_allowed(self, client):
        r = client.patch(f"{PHP_URL}/api/repairs/index.php?id=r_nope", json={})
        assert r.status_code in (405, 400), r.status_code
        for token in self.LEAKS:
            assert token not in r.text
