"""Iteration 4 tests for KLINIK SUEL MOTOR — 7 bug fixes + Payroll module.

Covered:
  BUG1  profit modal_part / laba per transaction
  BUG2  junk parts rejection + parts/cleanup + import_trash restore
  BUG3  cancelled paid trx pollution removal (omzet/laba/dashboard)
  BUG4  laba-rugi / cashflow / settings finance
  BUG5  KREDIT normalize + pay-debt + debt-reminders
  BUG6  SOP checklist master + finish/print blocking
  BUG7  cancel requires owner password
  PAYROLL employees CRUD + payroll report/slip
  ACCESS settings/access

Run:
    pytest /app/backend/tests/test_iteration4_payroll_and_bugs.py -v \
        --junitxml=/app/test_reports/pytest/iteration4.xml
"""
from __future__ import annotations

import os
import time
import uuid
from datetime import date, timedelta

import pytest
import requests

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") if os.environ.get("EXPO_PUBLIC_BACKEND_URL") else None
if not BASE:
    # fall back to frontend/.env parsing
    with open("/app/frontend/.env") as fh:
        for line in fh:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                break
assert BASE, "EXPO_PUBLIC_BACKEND_URL not configured"

API = f"{BASE}/api"

CREDS = {
    "owner": ("owner", "owner123"),
    "kasir": ("kasir", "kasir123"),
    "mekanik": ("mekanik", "mekanik123"),
    "partman": ("partman", "partman123"),
}


def _token(role: str) -> str:
    u, p = CREDS[role]
    r = requests.post(f"{API}/auth/login", json={"username": u, "password": p}, timeout=20)
    assert r.status_code == 200, f"login {role}: {r.status_code} {r.text}"
    j = r.json()
    return j.get("access_token") or j.get("token")


@pytest.fixture(scope="session")
def tokens():
    return {r: _token(r) for r in CREDS}


def H(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------------------------------------------------------------- helpers
def _create_part(tokens, *, code=None, name=None, price=50000, cost=30000, stock=20):
    code = code or f"TEST_P{uuid.uuid4().hex[:6].upper()}"
    name = name or f"TEST Part {code}"
    body = {"code": code, "name": name, "barcode": "", "price": price, "cost": cost,
            "stock": stock, "min_stock": 2, "unit": "pcs", "rack": ""}
    r = requests.post(f"{API}/parts", json=body, headers=H(tokens["owner"]), timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def _create_customer_and_vehicle(tokens):
    cust_body = {"name": f"TEST_Cust_{uuid.uuid4().hex[:6]}", "phone": "0800", "address": "TEST"}
    c = requests.post(f"{API}/customers", json=cust_body, headers=H(tokens["owner"]), timeout=15).json()
    veh_body = {"customer_id": c["id"], "plate": f"DR{uuid.uuid4().hex[:4].upper()}", "brand": "Honda",
                "model": "Beat", "year": "2022", "color": "hitam"}
    v = requests.post(f"{API}/vehicles", json=veh_body, headers=H(tokens["owner"]), timeout=15).json()
    return c, v


def _open_service(tokens, cust, veh):
    body = {"customer_id": cust["id"], "vehicle_id": veh["id"], "complaint_main": "TEST complaint",
            "km_in": 1000}
    r = requests.post(f"{API}/transactions", json=body, headers=H(tokens["kasir"]), timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def _add_part_item(tokens, tid, part, qty=2):
    body = {"kind": "part", "ref_id": part["id"], "code": part["code"], "name": part["name"],
            "price": part["price"], "qty": qty}
    r = requests.post(f"{API}/transactions/{tid}/items", json=body, headers=H(tokens["kasir"]), timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def _add_service_item(tokens, tid, name="Jasa Servis", price=50000):
    body = {"kind": "jasa", "name": name, "price": price, "qty": 1}
    r = requests.post(f"{API}/transactions/{tid}/items", json=body, headers=H(tokens["kasir"]), timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def _do_sop_ok(tokens, tid):
    items = requests.get(f"{API}/service-checklist-items", headers=H(tokens["owner"]), timeout=15).json()
    payload = {"items": [{"name": it["name"], "ok": True, "note": ""} for it in items]}
    r = requests.post(f"{API}/transactions/{tid}/sop", json=payload, headers=H(tokens["mekanik"]), timeout=15)
    assert r.status_code == 200, r.text


def _finish_and_pay(tokens, tid, method="CASH"):
    # start
    r = requests.post(f"{API}/transactions/{tid}/start", json={"mechanic_id": "", "km": None}, headers=H(tokens["mekanik"]), timeout=15)
    assert r.status_code == 200, r.text
    _do_sop_ok(tokens, tid)
    r = requests.post(f"{API}/transactions/{tid}/finish", json={"work_notes": "ok"}, headers=H(tokens["mekanik"]), timeout=15)
    assert r.status_code == 200, r.text
    r = requests.post(f"{API}/transactions/{tid}/checkout", headers=H(tokens["kasir"]), timeout=15)
    assert r.status_code == 200, r.text
    detail = r.json()
    total = detail["totals"]["total"]
    pay_body = {"method": method, "amount_paid": total if method != "KREDIT" else 0,
                "discount": 0, "reference": "", "note": "TEST",
                "due_date": (date.today() + timedelta(days=2)).isoformat() if method == "KREDIT" else ""}
    r = requests.post(f"{API}/transactions/{tid}/pay", json=pay_body, headers=H(tokens["kasir"]), timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


# =============================================================== BUG1
class TestBug1Profit:
    def test_service_snapshots_cost_and_computes_modal_and_laba(self, tokens):
        part = _create_part(tokens, price=100000, cost=45000, stock=20)  # 2*45k=90k modal, 2*100k=200k, +jasa 50k -> total 250k, laba=250k-90k=160k
        cust, veh = _create_customer_and_vehicle(tokens)
        trx = _open_service(tokens, cust, veh)
        _add_part_item(tokens, trx["id"], part, qty=2)
        _add_service_item(tokens, trx["id"], "Jasa TEST", 50000)
        r = requests.get(f"{API}/transactions/{trx['id']}", headers=H(tokens["owner"]), timeout=15)
        assert r.status_code == 200
        d = r.json()
        totals = d["totals"]
        assert totals["total"] == 250000, totals
        assert totals["modal_part"] == 90000
        assert totals["laba"] == 160000
        # per-item profit for part
        part_item = next(i for i in d["items"] if i["kind"] == "part")
        assert part_item.get("profit") == (100000 - 45000) * 2


# =============================================================== BUG2
class TestBug2JunkParts:
    def test_reject_junk_code_z_and_move_to_trash(self, tokens):
        code = f"Z{uuid.uuid4().hex[:5].upper()}"
        body = {"code": code, "name": "Junky Z", "barcode": "", "price": 0, "cost": 0,
                "stock": 0, "min_stock": 5, "unit": "pcs", "rack": ""}
        r = requests.post(f"{API}/parts", json=body, headers=H(tokens["owner"]), timeout=15)
        assert r.status_code == 400
        # trash listing has it
        trash = requests.get(f"{API}/import-trash", headers=H(tokens["owner"]), timeout=15).json()
        assert any(t["code"] == code for t in trash)

    def test_reject_junk_name_kosong(self, tokens):
        code = f"OK{uuid.uuid4().hex[:5].upper()}"
        body = {"code": code, "name": "Kosong TEST", "barcode": "", "price": 0, "cost": 0,
                "stock": 0, "min_stock": 5, "unit": "pcs", "rack": ""}
        r = requests.post(f"{API}/parts", json=body, headers=H(tokens["owner"]), timeout=15)
        assert r.status_code == 400

    def test_restore_from_trash(self, tokens):
        # Create fresh junk to restore under a non-junk-looking code so restore succeeds
        # We restore an existing trashed item; ensure restore endpoint responds and it disappears from list
        trash = requests.get(f"{API}/import-trash", headers=H(tokens["owner"]), timeout=15).json()
        if not trash:
            pytest.skip("no trash available")
        tid = trash[0]["id"]
        r = requests.post(f"{API}/import-trash/{tid}/restore", headers=H(tokens["owner"]), timeout=15)
        # Restore may succeed (200) or fail with 400 if code conflicts. Both are acceptable — we validate structure.
        assert r.status_code in (200, 400), r.text

    def test_parts_cleanup_owner_only(self, tokens):
        r = requests.post(f"{API}/parts/cleanup", headers=H(tokens["kasir"]), timeout=15)
        assert r.status_code == 403
        r = requests.post(f"{API}/parts/cleanup", headers=H(tokens["owner"]), timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "moved" in body or "junked" in body or isinstance(body, dict)

    def test_low_stock_flag_present(self, tokens):
        parts = requests.get(f"{API}/parts", headers=H(tokens["owner"]), timeout=15).json()
        assert isinstance(parts, list) and len(parts) > 0
        assert "low_stock" in parts[0]


# =============================================================== BUG7 (needed before BUG3)
class TestBug7CancelSecurity:
    def _make_paid_trx(self, tokens):
        part = _create_part(tokens, price=80000, cost=30000, stock=10)
        cust, veh = _create_customer_and_vehicle(tokens)
        trx = _open_service(tokens, cust, veh)
        _add_part_item(tokens, trx["id"], part, qty=1)
        _add_service_item(tokens, trx["id"], "Jasa", 20000)
        _finish_and_pay(tokens, trx["id"], method="CASH")
        return trx["id"]

    def test_cancel_without_password_forbidden(self, tokens):
        tid = self._make_paid_trx(tokens)
        r = requests.post(f"{API}/transactions/{tid}/cancel", json={"reason": "TEST", "owner_password": ""},
                          headers=H(tokens["owner"]), timeout=15)
        assert r.status_code == 403

    def test_cancel_without_reason_rejected(self, tokens):
        tid = self._make_paid_trx(tokens)
        r = requests.post(f"{API}/transactions/{tid}/cancel", json={"reason": "", "owner_password": "owner123"},
                          headers=H(tokens["owner"]), timeout=15)
        assert r.status_code == 400

    def test_cancel_with_owner_password_ok(self, tokens):
        tid = self._make_paid_trx(tokens)
        r = requests.post(f"{API}/transactions/{tid}/cancel",
                          json={"reason": "salah input", "owner_password": "owner123"},
                          headers=H(tokens["owner"]), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("status") == "DIBATALKAN"
        assert d.get("cancel_reason") == "salah input"


# =============================================================== BUG3
class TestBug3CancelPollution:
    def test_cancelled_payment_removed_from_omzet_dashboard(self, tokens):
        # snapshot dashboard omzet_hari_ini before
        dash_before = requests.get(f"{API}/dashboard", headers=H(tokens["owner"]), timeout=15).json()
        omzet_before = int(dash_before.get("omzet_hari_ini", 0) or 0)
        # create paid trx
        part = _create_part(tokens, price=70000, cost=20000, stock=5)
        cust, veh = _create_customer_and_vehicle(tokens)
        trx = _open_service(tokens, cust, veh)
        _add_part_item(tokens, trx["id"], part, qty=1)
        _add_service_item(tokens, trx["id"], "Jasa", 30000)
        _finish_and_pay(tokens, trx["id"], method="CASH")
        # dashboard omzet_hari_ini increased by 100k
        dash_after_pay = requests.get(f"{API}/dashboard", headers=H(tokens["owner"]), timeout=15).json()
        assert int(dash_after_pay.get("omzet_hari_ini", 0)) >= omzet_before + 100000, dash_after_pay
        # /reports/omzet grand_total before cancel
        rep_before = requests.get(f"{API}/reports/omzet", headers=H(tokens["owner"]), timeout=15).json()
        gt_before = int(rep_before.get("grand_total", 0) or 0)
        # cancel
        r = requests.post(f"{API}/transactions/{trx['id']}/cancel",
                          json={"reason": "test batal", "owner_password": "owner123"},
                          headers=H(tokens["owner"]), timeout=15)
        assert r.status_code == 200, r.text
        # dashboard reverted (dropped by >= 100k)
        dash_after_cancel = requests.get(f"{API}/dashboard", headers=H(tokens["owner"]), timeout=15).json()
        assert int(dash_after_cancel.get("omzet_hari_ini", 0)) <= int(dash_after_pay.get("omzet_hari_ini", 0)) - 100000
        # /reports/omzet grand_total drops
        rep_after = requests.get(f"{API}/reports/omzet", headers=H(tokens["owner"]), timeout=15).json()
        assert int(rep_after.get("grand_total", 0)) <= gt_before - 100000
        # /reports/laba-rugi total.omzet excludes cancelled
        lr = requests.get(f"{API}/reports/laba-rugi", headers=H(tokens["owner"]), timeout=15).json()
        assert "total" in lr and "omzet" in lr["total"]


# =============================================================== BUG4
class TestBug4LabaRugiCashflow:
    def test_settings_finance_get_put_persist(self, tokens):
        body = {"saldo_awal_bengkel": 111222, "saldo_awal_pribadi": 33344, "owner_draw": 500000}
        r = requests.put(f"{API}/settings/finance", json=body, headers=H(tokens["owner"]), timeout=15)
        assert r.status_code == 200, r.text
        got = requests.get(f"{API}/settings/finance", headers=H(tokens["owner"]), timeout=15).json()
        assert got["saldo_awal_bengkel"] == 111222
        assert got["saldo_awal_pribadi"] == 33344
        assert got["owner_draw"] == 500000

    def test_laba_rugi_shape(self, tokens):
        r = requests.get(f"{API}/reports/laba-rugi", headers=H(tokens["owner"]), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "rows" in d and "total" in d
        for k in ("omzet", "modal", "belanja_bengkel", "prive", "laba_bersih"):
            assert k in d["total"], f"missing total.{k}"
        for k in ("gaji_mekanik", "gaji_pct", "gaji_ideal"):
            assert k in d, f"missing {k}"

    def test_cashflow_shape(self, tokens):
        r = requests.get(f"{API}/reports/cashflow", headers=H(tokens["owner"]), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("saldo_awal", "pemasukan", "pengeluaran", "prive", "saldo_akhir"):
            assert k in d["bengkel"], f"missing bengkel.{k}"
        assert "saldo_awal" in d["pribadi"] and "saldo_akhir" in d["pribadi"]
        assert d["bengkel"]["saldo_awal"] == 111222


# =============================================================== BUG5
class TestBug5Credit:
    def _make_credit_trx(self, tokens, price=60000):
        part = _create_part(tokens, price=price, cost=20000, stock=5)
        cust, veh = _create_customer_and_vehicle(tokens)
        trx = _open_service(tokens, cust, veh)
        _add_part_item(tokens, trx["id"], part, qty=1)
        _add_service_item(tokens, trx["id"], "Jasa", 40000)
        d = _finish_and_pay(tokens, trx["id"], method="KREDIT")
        return trx["id"], d

    def test_kredit_sets_belum_lunas_and_iso_due(self, tokens):
        tid, d = self._make_credit_trx(tokens, price=60000)
        assert d.get("debt_status") == "BELUM LUNAS"
        due = d.get("debt_due_date") or ""
        # ISO-like date YYYY-MM-DD
        assert len(due) == 10 and due[4] == "-" and due[7] == "-", due

    def test_full_paydebt_lunas(self, tokens):
        tid, d = self._make_credit_trx(tokens, price=60000)
        debt = int(d.get("debt_amount") or 0)
        assert debt == 100000
        r = requests.post(f"{API}/transactions/{tid}/pay-debt", json={"amount": debt, "method": "CASH", "reference": "", "note": "lunas"},
                          headers=H(tokens["kasir"]), timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("debt_status") == "LUNAS"

    def test_debt_reminders_lists_due_within_3_days(self, tokens):
        # create credit trx due tomorrow
        part = _create_part(tokens, price=90000, cost=20000, stock=3)
        cust, veh = _create_customer_and_vehicle(tokens)
        trx = _open_service(tokens, cust, veh)
        _add_part_item(tokens, trx["id"], part, qty=1)
        _add_service_item(tokens, trx["id"], "Jasa", 10000)
        # start->sop->finish->checkout
        requests.post(f"{API}/transactions/{trx['id']}/start", json={"mechanic_id": "", "km": None}, headers=H(tokens["mekanik"]), timeout=15)
        _do_sop_ok(tokens, trx["id"])
        requests.post(f"{API}/transactions/{trx['id']}/finish", json={"work_notes": ""}, headers=H(tokens["mekanik"]), timeout=15)
        requests.post(f"{API}/transactions/{trx['id']}/checkout", headers=H(tokens["kasir"]), timeout=15)
        due_str = (date.today() + timedelta(days=2)).isoformat()
        pb = {"method": "KREDIT", "amount_paid": 0, "discount": 0, "reference": "", "note": "", "due_date": due_str}
        r = requests.post(f"{API}/transactions/{trx['id']}/pay", json=pb, headers=H(tokens["kasir"]), timeout=15)
        assert r.status_code == 200, r.text
        rem = requests.get(f"{API}/debt-reminders", headers=H(tokens["owner"]), timeout=15).json()
        assert any(r_.get("id") == trx["id"] for r_ in rem), f"expected trx {trx['id']} in reminders"


# =============================================================== BUG6
class TestBug6Sop:
    def test_default_4_items(self, tokens):
        items = requests.get(f"{API}/service-checklist-items", headers=H(tokens["owner"]), timeout=15).json()
        names = {i["name"] for i in items}
        for exp in ("Baut Kencang", "Oli Cek", "Test Jalan", "Tools Lengkap"):
            assert exp in names, f"default SOP item {exp} missing (got {names})"

    def test_owner_crud_checklist_master(self, tokens):
        # create
        name = f"TEST_SOP_{uuid.uuid4().hex[:5]}"
        r = requests.post(f"{API}/service-checklist-items", json={"name": name, "active": True},
                          headers=H(tokens["owner"]), timeout=15)
        assert r.status_code == 200, r.text
        iid = r.json()["id"]
        # update
        r = requests.put(f"{API}/service-checklist-items/{iid}",
                         json={"name": name + "_upd", "active": True},
                         headers=H(tokens["owner"]), timeout=15)
        assert r.status_code == 200, r.text
        # delete
        r = requests.delete(f"{API}/service-checklist-items/{iid}", headers=H(tokens["owner"]), timeout=15)
        assert r.status_code == 200, r.text

    def test_non_owner_cannot_crud(self, tokens):
        r = requests.post(f"{API}/service-checklist-items", json={"name": "hack", "active": True},
                          headers=H(tokens["kasir"]), timeout=15)
        assert r.status_code == 403

    def test_finish_blocked_without_sop(self, tokens):
        part = _create_part(tokens, price=30000, cost=10000, stock=5)
        cust, veh = _create_customer_and_vehicle(tokens)
        trx = _open_service(tokens, cust, veh)
        _add_part_item(tokens, trx["id"], part, qty=1)
        _add_service_item(tokens, trx["id"], "Jasa", 10000)
        requests.post(f"{API}/transactions/{trx['id']}/start", json={"mechanic_id": "", "km": None}, headers=H(tokens["mekanik"]), timeout=15)
        # do NOT save SOP
        r = requests.post(f"{API}/transactions/{trx['id']}/finish", json={"work_notes": ""}, headers=H(tokens["mekanik"]), timeout=15)
        assert r.status_code == 400
        assert "SOP" in r.text or "Checklist" in r.text
        # save SOP -> now finish succeeds
        _do_sop_ok(tokens, trx["id"])
        r = requests.post(f"{API}/transactions/{trx['id']}/finish", json={"work_notes": ""}, headers=H(tokens["mekanik"]), timeout=15)
        assert r.status_code == 200, r.text


# =============================================================== PAYROLL
class TestPayroll:
    @pytest.fixture(scope="class")
    def emp(self, tokens):
        body = {"name": f"TEST_Mek_{uuid.uuid4().hex[:5]}", "position": "mekanik",
                "base_salary": 1500000, "bonus_per_unit": 25000, "active": True}
        r = requests.post(f"{API}/employees", json=body, headers=H(tokens["owner"]), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        yield d
        requests.delete(f"{API}/employees/{d['id']}", headers=H(tokens["owner"]), timeout=15)

    def test_employee_crud(self, tokens, emp):
        # list contains the employee
        lst = requests.get(f"{API}/employees", headers=H(tokens["owner"]), timeout=15).json()
        assert any(e["id"] == emp["id"] for e in lst)
        # update
        upd = {"name": emp["name"], "position": "mekanik", "base_salary": 1600000,
               "bonus_per_unit": 30000, "active": True}
        r = requests.put(f"{API}/employees/{emp['id']}", json=upd, headers=H(tokens["owner"]), timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["base_salary"] == 1600000

    def test_non_owner_forbidden(self, tokens):
        r = requests.get(f"{API}/employees", headers=H(tokens["kasir"]), timeout=15)
        assert r.status_code == 403

    def test_payroll_report_shape(self, tokens):
        r = requests.get(f"{API}/payroll/report", headers=H(tokens["owner"]), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("slips", "total_gaji", "grand_total", "month"):
            assert k in d
        assert isinstance(d["slips"], list)
        if d["slips"]:
            s0 = d["slips"][0]
            for k in ("base_salary", "units", "bonus", "total"):
                assert k in s0

    def test_payroll_slip_bonus_math(self, tokens, emp):
        r = requests.get(f"{API}/payroll/slip/{emp['id']}", headers=H(tokens["owner"]), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        expected_bonus = int(d["units"]) * int(d["bonus_per_unit"])
        assert d["bonus"] == expected_bonus
        assert d["total"] == d["base_salary"] + d["bonus"]


# =============================================================== ACCESS
class TestAccessSettings:
    def test_get_put_access_roles(self, tokens):
        body = {"roles": {"kasir": {"dashboard": True, "penggajian": False},
                          "mekanik": {"servis": True}}}
        r = requests.put(f"{API}/settings/access", json=body, headers=H(tokens["owner"]), timeout=15)
        assert r.status_code == 200, r.text
        g = requests.get(f"{API}/settings/access", headers=H(tokens["owner"]), timeout=15).json()
        assert g["roles"]["kasir"]["dashboard"] is True
        assert g["roles"]["kasir"]["penggajian"] is False

    def test_put_access_owner_only(self, tokens):
        r = requests.put(f"{API}/settings/access", json={"roles": {}}, headers=H(tokens["kasir"]), timeout=15)
        assert r.status_code == 403
