"""Tests for iteration 2 features: debt, invoice edit w/ owner password, cancellations, reminders, shop, notifications."""
import os
import sys

import requests

BASE = os.environ.get("BASE", "http://localhost:8001") + "/api"


def login(u, p):
    r = requests.post(f"{BASE}/auth/login", json={"username": u, "password": p})
    r.raise_for_status()
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def call(method, path, h, ok=True, **kw):
    r = requests.request(method, f"{BASE}{path}", headers=h, **kw)
    if ok and r.status_code >= 400:
        print("FAIL", method, path, r.status_code, r.text[:300]); sys.exit(1)
    return r


mek, kas, own = login("mekanik", "mekanik123"), login("kasir", "kasir123"), login("owner", "owner123")
pid = os.getpid() % 100000

# shop profile
shop = call("PUT", "/shop", own, json={"name": "KLINIK SUEL MOTOR", "address": "Jl. Puyung-Bonjeruk, Bunkate", "phone": "081917106463", "whatsapp": "081917106463", "postal_code": "83561"}).json()
assert shop["phone"] == "081917106463"
assert call("PUT", "/shop", kas, ok=False, json={"name": "x"}).status_code == 403
# logo upload (1x1 png)
png = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000155a4b9a50000000049454e44ae426082")
r = call("POST", "/shop/logo", own, files={"file": ("logo.png", png, "image/png")})
assert r.json()["logo_path"], r.text
r = requests.get(f"{BASE}/shop/logo")
assert r.status_code == 200 and r.headers["content-type"].startswith("image/"), r.headers
assert call("DELETE", "/shop/logo", own).json()["logo_path"] is None
print("shop/logo ok")

# create trx with a part
cust = call("POST", "/customers", mek, json={"name": f"Hutang {pid}", "phone": "081234000111"}).json()
veh = call("POST", "/vehicles", mek, json={"customer_id": cust["id"], "plate": f"DR {pid} HT", "brand": "Yamaha", "model": "NMAX"}).json()
parts = call("GET", "/parts?q=Busi", mek).json(); busi = parts[0]; stock0 = busi["stock"]
svc = call("GET", "/services", mek).json()[0]
trx = call("POST", "/transactions", mek, json={"customer_id": cust["id"], "vehicle_id": veh["id"], "complaint_main": "Servis rutin",
           "items": [{"kind": "jasa", "ref_id": svc["id"], "name": svc["name"], "price": svc["price"], "qty": 1},
                     {"kind": "part", "ref_id": busi["id"], "name": "", "price": busi["price"], "qty": 1}]}).json()
tid = trx["id"]
assert [i for i in trx["items"] if i["kind"] == "part"][0]["name"] == busi["name"]
# edit item name/price (unlocked, mekanik)
jasa_item = [i for i in trx["items"] if i["kind"] == "jasa"][0]
trx = call("PUT", f"/transactions/{tid}/items/{jasa_item['id']}", mek, json={"name": "Servis Rutin Custom", "price": 60000}).json()
ji = [i for i in trx["items"] if i["id"] == jasa_item["id"]][0]
assert ji["name"] == "Servis Rutin Custom" and ji["price"] == 60000 and ji["subtotal"] == 60000
call("POST", f"/transactions/{tid}/start", mek, json={})
trx = call("POST", f"/transactions/{tid}/finish", mek, json={"work_done": "ok", "next_date": "01/01/2020"}).json()
total = trx["totals"]["total"]
# KREDIT partial
trx = call("POST", f"/transactions/{tid}/pay", kas, json={"method": "KREDIT", "amount_paid": 20000, "due_date": "30/06/2026"}).json()
assert trx["status"] == "SUDAH_DIBAYAR" and trx["debt_amount"] == total - 20000 and trx["debt_status"] == "BELUM LUNAS"
assert call("GET", "/parts?q=Busi", mek).json()[0]["stock"] == stock0 - 1
notes = call("GET", "/notifications", own).json()
assert notes["unread"] >= 1 and notes["items"][0]["kind"] == "HUTANG" and "wa.me" in notes["items"][0]["wa_url"]
assert call("GET", "/notifications", kas).json()["items"] == [] or all("kasir" in n.get("roles", []) for n in call("GET", "/notifications", kas).json()["items"])
debts = call("GET", "/debts", kas).json()
assert any(d["id"] == tid for d in debts)
# pay debt partially then fully
trx = call("POST", f"/transactions/{tid}/pay-debt", kas, json={"amount": 10000, "method": "CASH"}).json()
assert trx["debt_amount"] == total - 30000 and trx["payment"]["amount_paid"] == 30000 and len(trx["payment"]["installments"]) == 1
trx = call("POST", f"/transactions/{tid}/pay-debt", kas, json={"amount": 999999, "method": "TRANSFER"}).json()
assert trx["debt_amount"] == 0 and trx["debt_status"] == "LUNAS" and trx["payment"]["amount_paid"] == total
print("debt flow ok")

# locked invoice edit: kasir without password -> 400; with owner password -> ok
r = call("PUT", f"/transactions/{tid}/items/{jasa_item['id']}", kas, ok=False, json={"price": 70000})
assert r.status_code == 400
assert call("POST", "/auth/verify-owner", kas, ok=False, json={"owner_password": "salah"}).status_code == 400
call("POST", "/auth/verify-owner", kas, json={"owner_password": "owner123"})
trx = call("PUT", f"/transactions/{tid}/items/{jasa_item['id']}", kas, json={"price": 70000, "reason": "koreksi", "owner_password": "owner123"}).json()
assert trx["totals"]["total"] == total + 10000 and trx["payment"]["total"] == total + 10000 and trx["debt_amount"] == 10000
# add part on locked invoice reduces stock
trx = call("POST", f"/transactions/{tid}/items", kas, json={"kind": "part", "ref_id": busi["id"], "name": "", "price": busi["price"], "qty": 1, "owner_password": "owner123"}).json()
assert call("GET", "/parts?q=Busi", mek).json()[0]["stock"] == stock0 - 2
new_part_item = [i for i in trx["items"] if i["kind"] == "part"][-1]
trx = call("DELETE", f"/transactions/{tid}/items/{new_part_item['id']}?owner_password=owner123", kas).json()
assert call("GET", "/parts?q=Busi", mek).json()[0]["stock"] == stock0 - 1
assert any(a["action"].startswith("INVOICE_EDIT") for a in trx["audit_logs"])
print("locked invoice edit ok")

# reminders: next_date 01/01/2020 -> TERLAMBAT
rem = call("GET", "/reminders", own).json()
mine = [r for r in rem if r["vehicle_id"] == veh["id"]]
assert mine and mine[0]["status"] == "TERLAMBAT" and "wa.me" in mine[0]["wa_url"]
call("POST", f"/reminders/{veh['id']}/sent?due_date={mine[0]['due_date']}", kas)
rem = call("GET", "/reminders", own).json()
assert [r for r in rem if r["vehicle_id"] == veh["id"]][0]["reminder_sent_at"]
print("reminders ok")

# cancel paid trx by kasir with owner password -> stock restored
r = call("POST", f"/transactions/{tid}/cancel", kas, ok=False, json={"reason": "salah input"})
assert r.status_code == 400
trx = call("POST", f"/transactions/{tid}/cancel", kas, json={"reason": "salah input", "owner_password": "owner123"}).json()
assert trx["status"] == "DIBATALKAN"
assert call("GET", "/parts?q=Busi", mek).json()[0]["stock"] == stock0
canc = call("GET", "/reports/cancellations", own).json()
assert any(r["id"] == tid and r["cancel_reason"] == "salah input" for r in canc["rows"])
print("cancellation ok")

# stock 0 part cannot be added (create a part with 0 stock)
p0 = call("POST", "/parts", own, json={"code": f"Z{pid}", "name": "Part Kosong", "price": 1000, "stock": 0}).json()
t2 = call("POST", "/transactions", mek, json={"customer_id": cust["id"], "vehicle_id": veh["id"], "complaint_main": "x"}).json()
r = call("POST", f"/transactions/{t2['id']}/items", own, ok=False, json={"kind": "part", "ref_id": p0["id"], "name": "", "price": 1000, "qty": 1})
assert r.status_code == 400 and "HABIS" in r.json()["detail"]
call("POST", f"/transactions/{t2['id']}/cancel", mek, json={"reason": "test"})

# report export
r = call("GET", "/export/report/omzet?mode=monthly", own)
assert r.headers["content-type"].startswith("application/vnd.openxml")
# users delete (soft)
u = call("POST", "/users", own, json={"username": f"tmp{pid}", "password": "x12345", "name": "Tmp", "role": "kasir"}).json()
call("DELETE", f"/users/{u['id']}", own)
assert not any(x["id"] == u["id"] for x in call("GET", "/users", own).json())
assert requests.post(f"{BASE}/auth/login", json={"username": f"tmp{pid}", "password": "x12345"}).status_code == 401
# delete-all requires correct password (do NOT actually wipe seeded data: use wrong password only)
assert call("POST", "/parts/delete-all", own, ok=False, json={"owner_password": "salah"}).status_code == 400
dash = call("GET", "/dashboard", own).json()
assert "notif_unread" in dash and "reminders_due" in dash
print("ALL ITERATION-2 BACKEND CHECKS PASSED")
