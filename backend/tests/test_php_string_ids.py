"""
PHP backend (VPS emulation) string-ID contract tests.
Target: ephemeral PHP + SQLite server at http://localhost:8888
Verifies the user-reported bug: UPDATE/DELETE with string IDs previously
became id=0 due to (int) casts -> 400 'id wajib'.
"""
import os
import pytest
import requests

PHP_URL = os.environ.get("PHP_TEST_URL", "http://localhost:8888").rstrip("/")


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{PHP_URL}/api/auth/login.php",
                      json={"username": "admin", "password": "admin123"}, timeout=15)
    assert r.status_code == 200, f"login failed {r.status_code}: {r.text[:300]}"
    d = r.json()
    assert "token" in d and d["token"]
    assert d["user"]["id"] == "u1", f"expected string id 'u1', got {d['user']['id']!r}"
    assert isinstance(d["user"]["id"], str)
    return d["token"]


@pytest.fixture(scope="session")
def client(token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json",
                      "Authorization": f"Bearer {token}"})
    return s


# ---------- AUTH ----------
class TestAuth:
    def test_login_ok(self, token):
        assert isinstance(token, str) and len(token) > 10

    def test_login_bad_password(self):
        r = requests.post(f"{PHP_URL}/api/auth/login.php",
                          json={"username": "admin", "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_unauthenticated_list_rejected(self):
        r = requests.get(f"{PHP_URL}/api/customers/index.php", timeout=15)
        assert r.status_code == 401


# ---------- CUSTOMERS (the core reported bug) ----------
class TestCustomerStringIdCycle:
    CID = "c_qa_1"

    def test_01_create_with_client_id(self, client):
        r = client.post(f"{PHP_URL}/api/customers/index.php",
                        json={"id": self.CID, "name": "QA Test", "phone": "0899000111"})
        assert r.status_code == 201, r.text[:300]
        d = r.json()
        assert d["id"] == self.CID
        assert d["name"] == "QA Test"

    def test_02_update_string_id(self, client):
        r = client.put(f"{PHP_URL}/api/customers/index.php?id={self.CID}",
                       json={"name": "QA Edited", "phone": "0899000111"})
        assert r.status_code == 200, f"REGRESSION (id wajib bug): {r.status_code} {r.text[:300]}"
        assert r.json()["name"] == "QA Edited"

    def test_03_get_persisted(self, client):
        r = client.get(f"{PHP_URL}/api/customers/index.php?id={self.CID}")
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == self.CID and d["name"] == "QA Edited"

    def test_04_list_ids_are_strings(self, client):
        r = client.get(f"{PHP_URL}/api/customers/index.php")
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list) and len(rows) >= 1
        for row in rows:
            assert isinstance(row["id"], str), f"id not string: {row['id']!r}"
        assert "c1" in [x["id"] for x in rows]

    def test_05_delete_string_id(self, client):
        r = client.delete(f"{PHP_URL}/api/customers/index.php?id={self.CID}")
        assert r.status_code == 200, r.text[:300]
        assert r.json()["deleted"] == self.CID
        g = client.get(f"{PHP_URL}/api/customers/index.php?id={self.CID}")
        assert g.status_code == 404


# ---------- SPAREPARTS ----------
class TestSparepartCycle:
    SID = "sp_qa_1"

    def test_01_create(self, client):
        r = client.post(f"{PHP_URL}/api/spareparts/index.php",
                        json={"id": self.SID, "name": "QA Part", "sku": "QA-001",
                              "stock": 5, "cost_price": 1000, "selling_price": 2000})
        assert r.status_code == 201, r.text[:300]
        d = r.json()
        assert d["id"] == self.SID and int(d["stock"]) == 5

    def test_02_update_stock(self, client):
        r = client.put(f"{PHP_URL}/api/spareparts/index.php?id={self.SID}",
                       json={"name": "QA Part", "sku": "QA-001", "stock": 11,
                             "cost_price": 1000, "selling_price": 2000})
        assert r.status_code == 200, r.text[:300]
        assert int(r.json()["stock"]) == 11

    def test_03_get_and_list_strings(self, client):
        r = client.get(f"{PHP_URL}/api/spareparts/index.php")
        assert r.status_code == 200
        for row in r.json():
            assert isinstance(row["id"], str)

    def test_04_delete(self, client):
        r = client.delete(f"{PHP_URL}/api/spareparts/index.php?id={self.SID}")
        assert r.status_code == 200, r.text[:300]
        assert r.json()["deleted"] == self.SID


# ---------- USERS ----------
class TestUserCycle:
    UID = "u_qa_1"

    def test_01_create(self, client):
        r = client.post(f"{PHP_URL}/api/users/index.php",
                        json={"id": self.UID, "username": "qa_tech", "password": "QaPass!23",
                              "full_name": "QA Tech", "role": "technician"})
        assert r.status_code == 201, r.text[:300]
        d = r.json()
        assert d["id"] == self.UID and d["role"] == "technician"

    def test_02_update(self, client):
        r = client.put(f"{PHP_URL}/api/users/index.php?id={self.UID}",
                       json={"full_name": "QA Tech Edited", "role": "technician"})
        assert r.status_code == 200, r.text[:300]
        assert r.json()["full_name"] == "QA Tech Edited"

    def test_03_new_user_can_login(self):
        r = requests.post(f"{PHP_URL}/api/auth/login.php",
                          json={"username": "qa_tech", "password": "QaPass!23"}, timeout=15)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["user"]["id"] == "u_qa_1"

    def test_04_delete(self, client):
        r = client.delete(f"{PHP_URL}/api/users/index.php?id={self.UID}")
        assert r.status_code == 200
        assert r.json()["deleted"] == self.UID
        g = client.get(f"{PHP_URL}/api/users/index.php?id={self.UID}")
        assert g.status_code == 404


# ---------- REPAIRS (FK path with string customer_id) ----------
class TestRepairCycle:
    RID = "r_qa_1"

    def test_01_create_with_string_fk(self, client):
        r = client.post(f"{PHP_URL}/api/repairs/index.php",
                        json={"id": self.RID, "customer_id": "c1", "device_brand": "iPhone",
                              "device_model": "X", "complaint": "test",
                              "service_fee": 100000, "deposit": 0})
        assert r.status_code == 201, f"FK/string-id failure: {r.status_code} {r.text[:300]}"
        d = r.json()
        assert d["id"] == self.RID
        assert d["customer_id"] == "c1"
        assert d["ticket_no"].startswith("KK-")

    def test_02_status_ready(self, client):
        r = client.put(f"{PHP_URL}/api/repairs/index.php?id={self.RID}",
                       json={"status": "ready"})
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["status"] == "ready"
        assert d["completed_at"], "completed_at not set on ready"

    def test_03_status_picked_up(self, client):
        r = client.put(f"{PHP_URL}/api/repairs/index.php?id={self.RID}",
                       json={"status": "picked_up"})
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["status"] == "picked_up"
        assert d["picked_up_at"], "picked_up_at not set"

    def test_04_invalid_status_rejected(self, client):
        r = client.put(f"{PHP_URL}/api/repairs/index.php?id={self.RID}",
                       json={"status": "bogus"})
        assert r.status_code == 400

    def test_05_field_update(self, client):
        r = client.put(f"{PHP_URL}/api/repairs/index.php?id={self.RID}",
                       json={"device_brand": "Samsung", "device_model": "S21",
                             "complaint": "edited", "service_fee": 150000, "deposit": 50000})
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["device_brand"] == "Samsung" and float(d["service_fee"]) == 150000

    def test_06_list_and_filter(self, client):
        r = client.get(f"{PHP_URL}/api/repairs/index.php")
        assert r.status_code == 200
        rows = r.json()
        for row in rows:
            assert isinstance(row["id"], str)
            assert "parts_used" in row and "payments" in row
        r2 = client.get(f"{PHP_URL}/api/repairs/index.php?customer_id=c1")
        assert r2.status_code == 200
        assert self.RID in [x["id"] for x in r2.json()]

    def test_07_payment_add_and_delete(self, client):
        r = client.post(f"{PHP_URL}/api/repairs/payments.php?id={self.RID}",
                        json={"amount": 50000, "method": "Tunai"})
        assert r.status_code == 201, r.text[:300]
        pid = r.json()["id"]
        assert isinstance(pid, str) and pid

        g = client.get(f"{PHP_URL}/api/repairs/index.php?id={self.RID}")
        assert pid in [p["id"] for p in g.json()["payments"]]

        d = client.delete(f"{PHP_URL}/api/repairs/payments.php?id={self.RID}&payment_id={pid}")
        assert d.status_code == 200, d.text[:300]
        g2 = client.get(f"{PHP_URL}/api/repairs/index.php?id={self.RID}")
        assert pid not in [p["id"] for p in g2.json()["payments"]]

    def test_08_parts_add_and_delete(self, client):
        """SQLite may reject FOR UPDATE — env-only limitation, see report."""
        r = client.post(f"{PHP_URL}/api/repairs/parts.php?id={self.RID}",
                        json={"sparepart_id": "sp1", "qty": 1})
        if r.status_code >= 400 and "FOR UPDATE" in r.text.upper():
            pytest.skip(f"SQLite FOR UPDATE limitation: {r.text[:200]}")
        assert r.status_code == 201, r.text[:300]
        g = client.get(f"{PHP_URL}/api/repairs/index.php?id={self.RID}")
        assert "sp1" in [p["sparepart_id"] for p in g.json()["parts_used"]]
        d = client.delete(f"{PHP_URL}/api/repairs/parts.php?id={self.RID}&part_id=sp1")
        assert d.status_code == 200, d.text[:300]

    def test_09_delete_repair(self, client):
        r = client.delete(f"{PHP_URL}/api/repairs/index.php?id={self.RID}")
        assert r.status_code == 200
        assert r.json()["deleted"] == self.RID
        g = client.get(f"{PHP_URL}/api/repairs/index.php?id={self.RID}")
        assert g.status_code == 404


# ---------- SETTINGS ----------
class TestSettings:
    def test_update_and_persist(self, client):
        r = client.put(f"{PHP_URL}/api/settings/index.php", json={"shop_name": "QA Shop"})
        assert r.status_code == 200, r.text[:300]
        assert r.json()["shop_name"] == "QA Shop"
        g = client.get(f"{PHP_URL}/api/settings/index.php")
        assert g.status_code == 200
        assert g.json()["shop_name"] == "QA Shop"


# ---------- DASHBOARD ----------
class TestDashboard:
    def test_dashboard(self, client):
        r = client.get(f"{PHP_URL}/api/dashboard/stats.php")
        if r.status_code == 500:
            pytest.skip("stats.php uses MySQL-only DATE_FORMAT/DATE_SUB/CURDATE - "
                        "cannot run on the SQLite test harness (env limitation)")
        assert r.status_code == 200, r.text[:300]
        assert isinstance(r.json(), dict)


# ---------- PUBLIC ENDPOINTS + REVIEW REPLY (string id path) ----------
class TestPublicAndReview:
    RID = "r_qa_pub"

    def test_01_create_repair(self, client):
        r = client.post(f"{PHP_URL}/api/repairs/index.php",
                        json={"id": self.RID, "customer_id": "c1", "device_brand": "Oppo",
                              "device_model": "A5", "complaint": "pub test",
                              "service_fee": 50000, "deposit": 0})
        assert r.status_code == 201, r.text[:300]
        TestPublicAndReview.TICKET = r.json()["ticket_no"]

    def test_02_public_status_no_auth(self):
        r = requests.get(f"{PHP_URL}/api/public/status.php",
                         params={"ticket": TestPublicAndReview.TICKET}, timeout=15)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d.get("ticket_no") == TestPublicAndReview.TICKET

    def test_02b_mark_picked_up(self, client):
        r = client.put(f"{PHP_URL}/api/repairs/index.php?id={self.RID}", json={"status": "picked_up"})
        assert r.status_code == 200, r.text[:300]

    def test_03_public_rating_submit(self):
        r = requests.post(f"{PHP_URL}/api/public/rating.php",
                          json={"ticket": TestPublicAndReview.TICKET, "rating": 5,
                                "review": "QA review"}, timeout=15)
        assert r.status_code in (200, 201), r.text[:300]

    def test_04_admin_reply_string_id(self, client):
        r = client.post(f"{PHP_URL}/api/repairs/reply.php?id={self.RID}",
                        json={"reply": "Terima kasih"})
        assert r.status_code == 200, r.text[:300]
        assert r.json()["admin_reply"] == "Terima kasih"

    def test_05_cleanup(self, client):
        assert client.delete(f"{PHP_URL}/api/repairs/index.php?id={self.RID}").status_code == 200


# ---------- MISSING ID GUARDS ----------
class TestGuards:
    def test_put_without_id(self, client):
        r = client.put(f"{PHP_URL}/api/customers/index.php", json={"name": "x"})
        assert r.status_code == 400
        assert "id" in r.text.lower()

    def test_delete_without_id(self, client):
        r = client.delete(f"{PHP_URL}/api/customers/index.php")
        assert r.status_code == 400


# ---------- CONTRACT REGRESSION: phpMirror sends FULL object on repair update ----------
class TestRepairUpdateContract:
    """store.js repairs.update() fires PUT with the FULL repair object, which
    always contains `status`. repairs/index.php PUT branches on isset($b['status'])
    -> field edits are silently DROPPED. Reproduces the user's 'MySQL not changing'."""
    RID = "r_qa_contract"

    def test_01_create(self, client):
        r = client.post(f"{PHP_URL}/api/repairs/index.php",
                        json={"id": self.RID, "customer_id": "c1", "device_brand": "iPhone",
                              "device_model": "X", "complaint": "orig",
                              "service_fee": 100000, "deposit": 0, "status": "pending"})
        assert r.status_code == 201, r.text[:300]

    def test_02_full_object_put_drops_field_edits(self, client):
        payload = {
            "id": self.RID, "customer_id": "c1", "status": "pending",
            "device_brand": "Samsung", "device_model": "S23",
            "complaint": "EDITED", "notes": "note",
            "service_fee": 999000, "deposit": 111000,
            "parts_used": [], "payments": [],
        }
        r = client.put(f"{PHP_URL}/api/repairs/index.php?id={self.RID}", json=payload)
        assert r.status_code == 200, r.text[:300]
        g = client.get(f"{PHP_URL}/api/repairs/index.php?id={self.RID}").json()
        assert g["device_brand"] == "Samsung", (
            f"BUG: field edits dropped because payload contains 'status'. "
            f"device_brand={g['device_brand']}, complaint={g['complaint']}, service_fee={g['service_fee']}")
        assert g["complaint"] == "EDITED"
        assert float(g["service_fee"]) == 999000

    def test_03_cleanup(self, client):
        client.delete(f"{PHP_URL}/api/repairs/index.php?id={self.RID}")
