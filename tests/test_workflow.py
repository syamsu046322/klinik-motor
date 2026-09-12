"""End-to-end workflow smoke test for Klinik Suel Motor backend."""
import os
import sys

import requests

BASE = os.environ.get("BASE", "http://localhost:8001") + "/api"


def login(u, p):
    r = requests.post(f"{BASE}/auth/login", json={"username": u, "password": p})
    r.raise_for_status()
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def call(method, path, h, **kw):
    r = requests.request(method, f"{BASE}{path}", headers=h, **kw)
    if r.status_code >= 400:
        print("FAIL", method, path, r.status_code, r.text[:300])
        sys.exit(1)
    return r.json() if r.content else None


mek = login("mekanik", "mekanik123")
kas = login("kasir", "kasir123")
own = login("owner", "owner123")
part = login("partman", "partman123")

cust = call("POST", "/customers", mek, json={"name": "Budi Test", "phone": "081234567890", "address": "Mataram"})
veh = call("POST", "/vehicles", mek, json={"customer_id": cust["id"], "plate": f"DR {os.getpid() % 10000} XX", "brand": "Honda", "model": "Vario 125", "year": "2020"})
found = call("GET", f"/customers?q={cust['phone']}", mek)
assert any(c["id"] == cust["id"] for c in found), "search customer by phone"
services = call("GET", "/services", mek)
parts = call("GET", "/parts?q=Bearing", mek)
bearing = parts[0]
if bearing["stock"] < 5:
    call("POST", f"/parts/{bearing['id']}/adjust", own, json={"qty": 20, "reason": "PEMBELIAN", "note": "test seed"})
    bearing = call("GET", "/parts?q=Bearing", mek)[0]
stock_before = bearing["stock"]

trx = call("POST", "/transactions", mek, json={
    "customer_id": cust["id"], "vehicle_id": veh["id"], "km_in": 12000, "complaint_main": "CVT berisik",
    "items": [{"kind": "jasa", "ref_id": services[0]["id"], "name": services[0]["name"], "code": services[0]["code"], "price": services[0]["price"], "qty": 1}],
})
print("Queue:", trx["queue_no"], trx["trx_no"], trx["status"])
assert trx["status"] == "MENUNGGU_SERVIS"
tid = trx["id"]

# kasir cannot start service
r = requests.post(f"{BASE}/transactions/{tid}/start", headers=kas, json={})
assert r.status_code == 403, "kasir must not start service"

trx = call("POST", f"/transactions/{tid}/start", mek, json={})
assert trx["status"] == "DIPROSES"
trx = call("POST", f"/transactions/{tid}/items", mek, json={"kind": "jasa", "name": "Ganti kampas rem", "price": 35000, "qty": 1})
assert trx["status"] == "MENUNGGU_PERSETUJUAN"
item = [i for i in trx["items"] if i["source"] == "TAMBAHAN"][0]
assert item["approval"] == "MENUNGGU_PERSETUJUAN"
# finish blocked while pending
r = requests.post(f"{BASE}/transactions/{tid}/finish", headers=mek, json={})
assert r.status_code == 400
trx = call("POST", f"/transactions/{tid}/items/{item['id']}/approve", mek)
assert trx["status"] == "DIPROSES"
# add part (stock check)
r = requests.post(f"{BASE}/transactions/{tid}/items", headers=mek, json={"kind": "part", "ref_id": bearing["id"], "name": "x", "price": 1, "qty": 999})
assert r.status_code == 400 and "STOK" in r.json()["detail"], "stock check"
trx = call("POST", f"/transactions/{tid}/items", mek, json={"kind": "part", "ref_id": bearing["id"], "name": "x", "price": bearing["price"], "qty": 1})
pitem = [i for i in trx["items"] if i["kind"] == "part"][0]
assert pitem["name"] == bearing["name"] and pitem["price"] == bearing["price"], "snapshot from master"
trx = call("POST", f"/transactions/{tid}/items/{pitem['id']}/approve", mek)
assert call("GET", "/parts?q=Bearing", mek)[0]["stock"] == stock_before, "stock must not change before payment"

trx = call("POST", f"/transactions/{tid}/finish", mek, json={"work_done": "Servis CVT, ganti kampas", "next_recommendation": "Ganti oli", "next_km": 15000})
assert trx["status"] == "MENUNGGU_KASIR"
total = trx["totals"]["total"]
print("Total:", total, trx["totals"])

trx = call("POST", f"/transactions/{tid}/checkout", kas)
assert trx["status"] == "MENUNGGU_PEMBAYARAN"
# mekanik cannot pay
assert requests.post(f"{BASE}/transactions/{tid}/pay", headers=mek, json={"method": "CASH", "amount_paid": total}).status_code == 403
# underpay rejected
assert requests.post(f"{BASE}/transactions/{tid}/pay", headers=kas, json={"method": "CASH", "amount_paid": total - 1}).status_code == 400
trx = call("POST", f"/transactions/{tid}/pay", kas, json={"method": "CASH", "amount_paid": total + 50000, "discount": 0})
assert trx["status"] == "SUDAH_DIBAYAR" and trx["payment"]["change"] == 50000 and trx["invoice"]["invoice_no"].startswith("NS-")
# double submit prevented
assert requests.post(f"{BASE}/transactions/{tid}/pay", headers=kas, json={"method": "CASH", "amount_paid": total}).status_code == 400
assert call("GET", "/parts?q=Bearing", mek)[0]["stock"] == stock_before - 1, "stock decreased once"
moves = call("GET", f"/parts/{bearing['id']}/movements", part)
assert moves[0]["reason"] == "SERVIS" and moves[0]["qty"] == -1
# locked for mekanik
assert requests.post(f"{BASE}/transactions/{tid}/items", headers=mek, json={"kind": "jasa", "name": "x", "price": 1}).status_code == 400

trx = call("POST", f"/transactions/{tid}/print", kas)
assert trx["status"] == "NOTA_DICETAK"
wa = call("POST", f"/transactions/{tid}/whatsapp", kas)
assert wa["status"] == "TERKIRIM" and wa["url"].startswith("https://wa.me/6281234567890")
trx = call("POST", f"/transactions/{tid}/complete", kas)
assert trx["status"] == "SELESAI"
hist = call("GET", f"/history?vehicle_id={veh['id']}", kas)
assert hist and hist[0]["id"] == tid
assert len(trx["audit_logs"]) >= 8
rec = call("GET", f"/transactions/{tid}/receipt", kas)
assert "No Nota" in rec["whatsapp_message"]

dash = call("GET", "/dashboard", own)
assert dash["omzet_hari_ini"] >= total
rep = call("GET", "/reports/omzet?mode=daily", own)
assert rep["rows"]
assert requests.get(f"{BASE}/reports/omzet", headers=kas).status_code == 403

# excel export/import roundtrip
x = requests.get(f"{BASE}/export/parts", headers=own)
assert x.status_code == 200 and x.headers["content-type"].startswith("application/vnd.openxml")
imp = requests.post(f"{BASE}/import/parts", headers=own, files={"file": ("parts.xlsx", x.content, x.headers["content-type"])}).json()
print("Import:", imp)
assert imp["updated"] >= 1
x = requests.get(f"{BASE}/export/vehicles", headers=own)
imp = requests.post(f"{BASE}/import/vehicles", headers=own, files={"file": ("v.xlsx", x.content, x.headers["content-type"])}).json()
assert imp["updated"] >= 1
print("ALL BACKEND WORKFLOW CHECKS PASSED")
