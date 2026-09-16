"""Iteration 5 backend tests.
Focus:
- Owner login end-to-end via public preview URL.
- GET /api/reports/dashboard-bengkel returns today/trend/prive_7d/month(target)/kas.
- GET/PUT /api/settings/finance persists target_laba_bulanan.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL")
if not BASE_URL:
    # fallback used by prior iterations
    BASE_URL = os.environ.get("EXPO_BACKEND_URL")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL must be set (see /app/frontend/.env)"
BASE_URL = BASE_URL.rstrip("/")


# ------------------------------------------------------------------ Fixtures / auth
@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def owner_token(api):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"username": "owner", "password": "owner123"}, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    body = r.json()
    assert "access_token" in body and body["access_token"], "missing access_token"
    assert body.get("user", {}).get("role") == "owner"
    return body["access_token"]


@pytest.fixture(scope="module")
def owner_headers(owner_token):
    return {"Content-Type": "application/json", "Authorization": f"Bearer {owner_token}"}


# ------------------------------------------------------------------ Auth tests
class TestAuth:
    def test_login_owner_success(self, owner_token):
        assert owner_token and len(owner_token) > 10

    def test_login_wrong_password_401(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login", json={"username": "owner", "password": "WRONG"}, timeout=20)
        assert r.status_code in (400, 401), f"expected 401, got {r.status_code}"
        # ensure server returns a JSON error body, not a connection error surrogate
        try:
            data = r.json()
        except Exception:
            pytest.fail("Non-JSON error body on wrong password")
        assert isinstance(data, dict)


# ------------------------------------------------------------------ Finance settings (target_laba_bulanan)
class TestFinanceSettings:
    original: dict = {}

    def test_get_finance_shape(self, owner_headers):
        r = requests.get(f"{BASE_URL}/api/settings/finance", headers=owner_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("saldo_awal_bengkel", "saldo_awal_pribadi", "owner_draw", "target_laba_bulanan"):
            assert k in data, f"missing field {k}"
            assert isinstance(data[k], int)
        TestFinanceSettings.original = data

    def test_put_finance_persists_target(self, owner_headers):
        payload = {**TestFinanceSettings.original, "target_laba_bulanan": 5_000_000}
        r = requests.put(f"{BASE_URL}/api/settings/finance", headers=owner_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json().get("target_laba_bulanan") == 5_000_000

        # GET verify persistence
        r2 = requests.get(f"{BASE_URL}/api/settings/finance", headers=owner_headers, timeout=20)
        assert r2.status_code == 200
        assert r2.json().get("target_laba_bulanan") == 5_000_000

    def test_restore_original_target(self, owner_headers):
        payload = {**TestFinanceSettings.original}
        r = requests.put(f"{BASE_URL}/api/settings/finance", headers=owner_headers, json=payload, timeout=20)
        assert r.status_code == 200


# ------------------------------------------------------------------ Dashboard bengkel
class TestDashboardBengkel:
    def test_dashboard_bengkel_shape(self, owner_headers):
        r = requests.get(f"{BASE_URL}/api/reports/dashboard-bengkel", headers=owner_headers, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()

        # today
        assert "today" in d and isinstance(d["today"], dict)
        for k in ("date", "omzet", "modal_part", "belanja_bengkel", "laba_bersih", "prive"):
            assert k in d["today"], f"today missing {k}"

        # trend (7 days)
        assert isinstance(d.get("trend"), list) and len(d["trend"]) == 7
        for row in d["trend"]:
            for k in ("date", "omzet", "modal", "belanja_bengkel", "prive", "laba_bersih"):
                assert k in row

        assert "prive_7d" in d and isinstance(d["prive_7d"], int)

        # month with target
        m = d.get("month")
        assert isinstance(m, dict)
        for k in ("period", "laba_bersih", "target", "target_pct", "tercapai"):
            assert k in m, f"month missing {k}"
        assert isinstance(m["target"], int)
        assert isinstance(m["tercapai"], bool)

        # kas warning object
        kas = d.get("kas")
        assert isinstance(kas, dict)
        for k in ("saldo_bengkel", "belanja_bulan", "level", "message"):
            assert k in kas, f"kas missing {k}"
        assert kas["level"] in ("ok", "warning", "danger")

    def test_dashboard_target_reflects_setting(self, owner_headers):
        # Set target then check target_pct math
        payload = {"saldo_awal_bengkel": 0, "saldo_awal_pribadi": 0, "owner_draw": 0, "target_laba_bulanan": 10_000_000}
        # preserve original first
        cur = requests.get(f"{BASE_URL}/api/settings/finance", headers=owner_headers, timeout=20).json()
        try:
            payload = {**cur, "target_laba_bulanan": 10_000_000}
            r = requests.put(f"{BASE_URL}/api/settings/finance", headers=owner_headers, json=payload, timeout=20)
            assert r.status_code == 200

            r2 = requests.get(f"{BASE_URL}/api/reports/dashboard-bengkel", headers=owner_headers, timeout=30)
            assert r2.status_code == 200
            m = r2.json()["month"]
            assert m["target"] == 10_000_000
            # target_pct may be None if laba=0 or a rounded float
            if m["target_pct"] is not None:
                assert isinstance(m["target_pct"], (int, float))
            # tercapai boolean consistent with values
            assert m["tercapai"] == (m["target"] > 0 and m["laba_bersih"] >= m["target"])
        finally:
            requests.put(f"{BASE_URL}/api/settings/finance", headers=owner_headers, json=cur, timeout=20)

    def test_requires_owner_auth(self, api):
        r = api.get(f"{BASE_URL}/api/reports/dashboard-bengkel", timeout=20)
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"
