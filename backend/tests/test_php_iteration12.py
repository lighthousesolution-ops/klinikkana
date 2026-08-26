"""
Iteration 12 verification of the PHP backend fixes:
  1. PUT /api/repairs/index.php?id=  -> PARTIAL payload must NOT wipe omitted columns
  2. PUT /api/repairs/index.php      -> full-object payload (status + all fields) still persists
  3. PUT /api/users/index.php?id=<own id> as non-admin -> 200 for own password/phone,
     403 on another user's id, role field silently ignored for non-admin
  4. PUT /api/users/index.php partial payload must NOT blank role / full_name
Target: PHP + SQLite harness at http://localhost:8888
"""
import os
import pytest
import requests

PHP_URL = os.environ.get("PHP_TEST_URL", "http://localhost:8888").rstrip("/")


def _login(username, password):
    r = requests.post(f"{PHP_URL}/api/auth/login.php",
                      json={"username": username, "password": password}, timeout=15)
    return r


def _token(username, password):
    r = _login(username, password)
    assert r.status_code == 200, f"login {username} failed {r.status_code}: {r.text[:200]}"
    return r.json()["token"]


def _session(token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def client():
    return _session(_token("admin", "admin123"))


# ---------- 1. PARTIAL PUT ON REPAIRS IS NON-DESTRUCTIVE ----------
class TestRepairPartialPut:
    RID = "r_qa_i12_partial"

    def test_01_create(self, client):
        client.delete(f"{PHP_URL}/api/repairs/index.php?id={self.RID}")
        r = client.post(f"{PHP_URL}/api/repairs/index.php",
                        json={"id": self.RID, "customer_id": "c1", "device_brand": "iPhone",
                              "device_model": "X", "serial_no": "SN1", "complaint": "orig",
                              "notes": "n1", "service_fee": 50000, "deposit": 10000,
                              "status": "pending"})
        assert r.status_code == 201, r.text[:300]
        d = r.json()
        assert d["device_brand"] == "iPhone"
        assert float(d["service_fee"]) == 50000
        assert float(d["deposit"]) == 10000

    def test_02_notes_only_put_keeps_everything(self, client):
        r = client.put(f"{PHP_URL}/api/repairs/index.php?id={self.RID}",
                       json={"notes": "only notes"})
        assert r.status_code == 200, r.text[:300]
        d = client.get(f"{PHP_URL}/api/repairs/index.php?id={self.RID}").json()
        assert d["notes"] == "only notes"
        assert d["device_brand"] == "iPhone", f"device_brand wiped: {d['device_brand']!r}"
        assert d["device_model"] == "X", f"device_model wiped: {d['device_model']!r}"
        assert d["serial_no"] == "SN1", f"serial_no wiped: {d['serial_no']!r}"
        assert d["complaint"] == "orig", f"complaint wiped: {d['complaint']!r}"
        assert float(d["service_fee"]) == 50000, f"service_fee zeroed: {d['service_fee']}"
        assert float(d["deposit"]) == 10000, f"deposit zeroed: {d['deposit']}"
        assert d["status"] == "pending"

    def test_03_service_fee_only_put(self, client):
        r = client.put(f"{PHP_URL}/api/repairs/index.php?id={self.RID}",
                       json={"service_fee": 75000})
        assert r.status_code == 200, r.text[:300]
        d = client.get(f"{PHP_URL}/api/repairs/index.php?id={self.RID}").json()
        assert float(d["service_fee"]) == 75000
        assert float(d["deposit"]) == 10000
        assert d["notes"] == "only notes"
        assert d["device_brand"] == "iPhone"

    def test_04_technician_only_put(self, client):
        r = client.put(f"{PHP_URL}/api/repairs/index.php?id={self.RID}",
                       json={"technician_id": "u2"})
        assert r.status_code == 200, r.text[:300]
        d = client.get(f"{PHP_URL}/api/repairs/index.php?id={self.RID}").json()
        assert str(d["technician_id"]) == "u2"
        assert d["complaint"] == "orig"
        assert float(d["service_fee"]) == 75000

    def test_05_status_only_put_keeps_fields(self, client):
        r = client.put(f"{PHP_URL}/api/repairs/index.php?id={self.RID}",
                       json={"status": "in_progress"})
        assert r.status_code == 200, r.text[:300]
        d = client.get(f"{PHP_URL}/api/repairs/index.php?id={self.RID}").json()
        assert d["status"] == "in_progress"
        assert d["device_brand"] == "iPhone"
        assert d["serial_no"] == "SN1"
        assert float(d["service_fee"]) == 75000
        assert str(d["technician_id"]) == "u2"

    def test_06_empty_string_still_clears_when_explicit(self, client):
        """Explicitly sending "" must clear (partial-merge must not block intentional clears)."""
        r = client.put(f"{PHP_URL}/api/repairs/index.php?id={self.RID}",
                       json={"serial_no": ""})
        assert r.status_code == 200, r.text[:300]
        d = client.get(f"{PHP_URL}/api/repairs/index.php?id={self.RID}").json()
        assert d["serial_no"] == ""
        assert d["device_brand"] == "iPhone"

    def test_07_full_object_put_persists_everything(self, client):
        payload = {"id": self.RID, "customer_id": "c1", "status": "ready",
                   "device_brand": "Samsung", "device_model": "S23", "serial_no": "SN-NEW",
                   "complaint": "EDITED", "notes": "n-new", "service_fee": 999000,
                   "deposit": 111000, "technician_id": "u4",
                   "parts_used": [], "payments": []}
        r = client.put(f"{PHP_URL}/api/repairs/index.php?id={self.RID}", json=payload)
        assert r.status_code == 200, r.text[:300]
        d = client.get(f"{PHP_URL}/api/repairs/index.php?id={self.RID}").json()
        assert d["status"] == "ready"
        assert d["device_brand"] == "Samsung"
        assert d["device_model"] == "S23"
        assert d["serial_no"] == "SN-NEW"
        assert d["complaint"] == "EDITED"
        assert d["notes"] == "n-new"
        assert float(d["service_fee"]) == 999000
        assert float(d["deposit"]) == 111000
        assert str(d["technician_id"]) == "u4"
        assert d["completed_at"]

    def test_08_empty_body_put_is_noop(self, client):
        before = client.get(f"{PHP_URL}/api/repairs/index.php?id={self.RID}").json()
        r = client.put(f"{PHP_URL}/api/repairs/index.php?id={self.RID}", json={})
        assert r.status_code == 200, r.text[:300]
        after = client.get(f"{PHP_URL}/api/repairs/index.php?id={self.RID}").json()
        for k in ("device_brand", "device_model", "serial_no", "complaint", "notes",
                  "service_fee", "deposit", "status", "technician_id", "completed_at"):
            assert str(after[k]) == str(before[k]), f"{k} changed on empty PUT"

    def test_09_cleanup(self, client):
        assert client.delete(f"{PHP_URL}/api/repairs/index.php?id={self.RID}").status_code == 200


# ---------- 2. USERS PUT: SELF PASSWORD CHANGE + PARTIAL MERGE ----------
class TestUsersSelfPut:
    TECH_ID = "u_qa_i12_tech"
    TECH_USER = "qa_i12_tech"
    OTHER_ID = "u_qa_i12_other"
    OTHER_USER = "qa_i12_other"
    PW1 = "QaPass!23"
    PW2 = "NewPass!456"

    def test_01_setup_users(self, client):
        for uid in (self.TECH_ID, self.OTHER_ID):
            client.delete(f"{PHP_URL}/api/users/index.php?id={uid}")
        r = client.post(f"{PHP_URL}/api/users/index.php",
                        json={"id": self.TECH_ID, "username": self.TECH_USER, "password": self.PW1,
                              "full_name": "QA I12 Tech", "role": "technician", "phone": "0811"})
        assert r.status_code == 201, r.text[:300]
        assert r.json()["role"] == "technician"
        r2 = client.post(f"{PHP_URL}/api/users/index.php",
                         json={"id": self.OTHER_ID, "username": self.OTHER_USER,
                               "password": self.PW1, "full_name": "QA I12 Cashier",
                               "role": "cashier"})
        assert r2.status_code == 201, r2.text[:300]

    def test_02_self_password_change_returns_200(self, client):
        sess = _session(_token(self.TECH_USER, self.PW1))
        r = sess.put(f"{PHP_URL}/api/users/index.php?id={self.TECH_ID}",
                     json={"password": self.PW2})
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        d = r.json()
        assert d["id"] == self.TECH_ID
        assert "password_hash" not in d
        assert d["role"] == "technician", "role changed on self password PUT"
        assert d["full_name"] == "QA I12 Tech", "full_name blanked on self password PUT"

    def test_03_login_with_new_password(self):
        assert _login(self.TECH_USER, self.PW2).status_code == 200, "new password does not work"
        assert _login(self.TECH_USER, self.PW1).status_code == 401, "old password still valid"

    def test_04_self_phone_update(self):
        sess = _session(_token(self.TECH_USER, self.PW2))
        r = sess.put(f"{PHP_URL}/api/users/index.php?id={self.TECH_ID}",
                     json={"phone": "089999"})
        assert r.status_code == 200, r.text[:300]
        assert r.json()["phone"] == "089999"

    def test_05_non_admin_put_other_user_403(self):
        sess = _session(_token(self.TECH_USER, self.PW2))
        r = sess.put(f"{PHP_URL}/api/users/index.php?id={self.OTHER_ID}",
                     json={"password": "Hacked!123"})
        assert r.status_code == 403, f"{r.status_code}: {r.text[:200]}"
        # other user's password must be untouched
        assert _login(self.OTHER_USER, self.PW1).status_code == 200
        assert _login(self.OTHER_USER, "Hacked!123").status_code == 401

    def test_06_non_admin_cannot_self_promote_role(self, client):
        sess = _session(_token(self.TECH_USER, self.PW2))
        r = sess.put(f"{PHP_URL}/api/users/index.php?id={self.TECH_ID}",
                     json={"role": "admin", "password": self.PW2})
        assert r.status_code in (200, 403), r.text[:200]
        d = client.get(f"{PHP_URL}/api/users/index.php?id={self.TECH_ID}").json()
        assert d["role"] == "technician", f"non-admin escalated role to {d['role']}"

    def test_07_non_admin_cannot_change_own_full_name_silently_wipe(self, client):
        sess = _session(_token(self.TECH_USER, self.PW2))
        r = sess.put(f"{PHP_URL}/api/users/index.php?id={self.TECH_ID}",
                     json={"full_name": ""})
        assert r.status_code in (200, 403), r.text[:200]
        d = client.get(f"{PHP_URL}/api/users/index.php?id={self.TECH_ID}").json()
        assert d["full_name"] == "QA I12 Tech", f"full_name wiped by non-admin: {d['full_name']!r}"

    def test_08_unauth_put_401(self):
        r = requests.put(f"{PHP_URL}/api/users/index.php?id={self.TECH_ID}",
                         json={"password": "x"}, timeout=15)
        assert r.status_code == 401, f"{r.status_code}: {r.text[:200]}"

    def test_09_admin_partial_put_keeps_role_and_full_name(self, client):
        r = client.put(f"{PHP_URL}/api/users/index.php?id={self.TECH_ID}",
                       json={"phone": "081234"})
        assert r.status_code == 200, r.text[:300]
        d = client.get(f"{PHP_URL}/api/users/index.php?id={self.TECH_ID}").json()
        assert d["phone"] == "081234"
        assert d["role"] == "technician", f"role downgraded to {d['role']}"
        assert d["full_name"] == "QA I12 Tech", f"full_name blanked: {d['full_name']!r}"

    def test_10_admin_password_only_put_keeps_role(self, client):
        r = client.put(f"{PHP_URL}/api/users/index.php?id={self.TECH_ID}",
                       json={"password": self.PW1})
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["role"] == "technician"
        assert d["full_name"] == "QA I12 Tech"
        assert _login(self.TECH_USER, self.PW1).status_code == 200

    def test_11_admin_can_change_role_and_full_name(self, client):
        r = client.put(f"{PHP_URL}/api/users/index.php?id={self.TECH_ID}",
                       json={"role": "cashier", "full_name": "QA I12 Renamed"})
        assert r.status_code == 200, r.text[:300]
        d = client.get(f"{PHP_URL}/api/users/index.php?id={self.TECH_ID}").json()
        assert d["role"] == "cashier"
        assert d["full_name"] == "QA I12 Renamed"

    def test_12_admin_invalid_role_rejected(self, client):
        r = client.put(f"{PHP_URL}/api/users/index.php?id={self.TECH_ID}",
                       json={"role": "superuser"})
        assert r.status_code == 400, f"{r.status_code}: {r.text[:200]}"
        d = client.get(f"{PHP_URL}/api/users/index.php?id={self.TECH_ID}").json()
        assert d["role"] == "cashier"

    def test_13_put_without_id_400(self, client):
        r = client.put(f"{PHP_URL}/api/users/index.php", json={"phone": "1"})
        assert r.status_code == 400, f"{r.status_code}: {r.text[:200]}"

    def test_13b_cashier_self_password_change(self):
        sess = _session(_token(self.OTHER_USER, self.PW1))
        r = sess.put(f"{PHP_URL}/api/users/index.php?id={self.OTHER_ID}",
                     json={"password": self.PW2, "phone": "0877"})
        assert r.status_code == 200, f"cashier self-PUT {r.status_code}: {r.text[:300]}"
        assert r.json()["role"] == "cashier"
        assert r.json()["phone"] == "0877"
        assert _login(self.OTHER_USER, self.PW2).status_code == 200

    def test_14_cleanup(self, client):
        for uid in (self.TECH_ID, self.OTHER_ID):
            assert client.delete(f"{PHP_URL}/api/users/index.php?id={uid}").status_code == 200


# ---------- 3. NO LEAK REGRESSION ON dashboard/stats.php ----------
class TestNoLeakRegression:
    LEAKS = ["Fatal error", "Stack trace", "/app/php-backend", ".php:", "SQLSTATE",
             "PDOException", "Warning:", "<br />"]

    def test_01_stats_generic_error(self, client):
        r = client.get(f"{PHP_URL}/api/dashboard/stats.php")
        if r.status_code == 200:
            pytest.skip("stats.php returned 200 on harness - fatal path not exercised")
        assert r.status_code == 500, r.status_code
        for token in self.LEAKS:
            assert token not in r.text, f"leaked '{token}': {r.text[:300]}"
        assert r.json() == {"error": "Internal server error"}
