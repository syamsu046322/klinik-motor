"""Iteration 4: outlets, transfer, direct part sales, rack location."""
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
        print("FAIL", method, path, r.status_code, r.text[:300])
        sys.exit(1)
    return r


mek = login("mekanik", "mekanik123")
kas = login("kasir", "kasir123")
own = login("owner", "owner123")
prt = login("partman", "partman123")
pid = os.getpid() % 100000

# --- Role gates on /outlets
r = call("GET", "/outlets", mek, ok=False)
assert r.status_code == 403, f"mekanik should NOT list outlets, got {r.status_code}"
r = call("GET", "/outlets", kas, ok=False)
assert r.status_code == 403, f"kasir should NOT list outlets, got {r.status_code}"
outs_prt = call("GET", "/outlets", prt).json()
assert any(o.get("is_main") and o.get("name") == "Bengkel Pusat" for o in outs_prt), "Bengkel Pusat must auto-exist"
outs_own = call("GET", "/outlets", own).json()
assert any(o.get("is_main") for o in outs_own)
main_outlet = [o for o in outs_own if o.get("is_main")][0]

# owner only can create outlet
r = call("POST", "/outlets", prt, ok=False, json={"name": f"Cabang T {pid}"})
assert r.status_code == 403, f"partman should NOT create outlet, got {r.status_code}"
cab = call("POST", "/outlets", own, json={"name": f"Cabang T {pid}", "address": "Jl. Uji", "phone": "081200000000"}).json()
assert cab["is_main"] is False and cab["name"].startswith("Cabang T")
print("outlets ok")

# --- Rack on parts
part = call("POST", "/parts", prt, json={"code": f"R{pid}", "name": f"Rack Part {pid}", "price": 10000, "stock": 20, "min_stock": 1, "rack": "R2-B1"}).json()
assert part["rack"] == "R2-B1"
# search by rack
found = call("GET", "/parts?q=R2-B1", mek).json()
assert any(p["id"] == part["id"] for p in found), "search parts by rack"
# rack surfaces on outlet stock
os_pusat = call("GET", f"/outlets/{main_outlet['id']}/stock?q=R2-B1", prt).json()
assert any(p["id"] == part["id"] and p.get("rack") == "R2-B1" and p["outlet_stock"] == 20 for p in os_pusat)
os_cab = call("GET", f"/outlets/{cab['id']}/stock?q=R{pid}", prt).json()
assert any(p["id"] == part["id"] and p["outlet_stock"] == 0 for p in os_cab)
print("rack ok")

# --- Transfer pusat -> cabang
# Transfer to main outlet must fail
r = call("POST", f"/outlets/{main_outlet['id']}/transfer", prt, ok=False, json={"part_id": part["id"], "qty": 1})
assert r.status_code == 400
# transfer 5 -> cabang
call("POST", f"/outlets/{cab['id']}/transfer", prt, json={"part_id": part["id"], "qty": 5, "note": "test"})
# pusat stock should drop
p_after = call("GET", f"/parts?q=R{pid}", prt).json()[0]
assert p_after["stock"] == 15, f"pusat stock expected 15 got {p_after['stock']}"
os_cab2 = call("GET", f"/outlets/{cab['id']}/stock?q=R{pid}", prt).json()
assert os_cab2[0]["outlet_stock"] == 5
# Return 2 back
call("POST", f"/outlets/{cab['id']}/transfer", prt, json={"part_id": part["id"], "qty": -2})
assert call("GET", f"/parts?q=R{pid}", prt).json()[0]["stock"] == 17
assert call("GET", f"/outlets/{cab['id']}/stock?q=R{pid}", prt).json()[0]["outlet_stock"] == 3
# Cannot return more than available
r = call("POST", f"/outlets/{cab['id']}/transfer", prt, ok=False, json={"part_id": part["id"], "qty": -99})
assert r.status_code == 400
# Cannot transfer more than pusat has
r = call("POST", f"/outlets/{cab['id']}/transfer", prt, ok=False, json={"part_id": part["id"], "qty": 9999})
assert r.status_code == 400
print("transfer ok")

# --- Direct sale at cabang
# stock check
r = call("POST", "/sales", prt, ok=False, json={
    "outlet_id": cab["id"], "items": [{"part_id": part["id"], "qty": 999}],
    "customer_name": "Umum", "method": "CASH", "amount_paid": 10_000_000,
})
assert r.status_code == 400 and "STOK TIDAK CUKUP" in r.json()["detail"]
# amount short
r = call("POST", "/sales", prt, ok=False, json={
    "outlet_id": cab["id"], "items": [{"part_id": part["id"], "qty": 1}],
    "method": "CASH", "amount_paid": 5,
})
assert r.status_code == 400
# ok sale at cabang
sale_cab = call("POST", "/sales", prt, json={
    "outlet_id": cab["id"], "items": [{"part_id": part["id"], "qty": 2}],
    "customer_name": "Iwan", "customer_phone": "081234567890",
    "discount": 1000, "method": "CASH", "amount_paid": 25000, "note": "beli langsung",
}).json()
assert sale_cab["sale_no"].startswith("PJ-")
assert sale_cab["total"] == 2 * 10000 - 1000
assert sale_cab["change"] == 25000 - sale_cab["total"]
# cabang stock reduced, pusat unchanged (was 17)
assert call("GET", f"/outlets/{cab['id']}/stock?q=R{pid}", prt).json()[0]["outlet_stock"] == 1
assert call("GET", f"/parts?q=R{pid}", prt).json()[0]["stock"] == 17
print("sale cabang ok")

# --- Direct sale at pusat reduces main part stock
sale_pusat = call("POST", "/sales", prt, json={
    "outlet_id": main_outlet["id"], "items": [{"part_id": part["id"], "qty": 3}],
    "customer_name": "Umum", "method": "TRANSFER", "amount_paid": 30000,
}).json()
assert sale_pusat["sale_no"].startswith("PJ-")
assert call("GET", f"/parts?q=R{pid}", prt).json()[0]["stock"] == 14

# --- list & filter
lst_all = call("GET", "/sales", prt).json()
assert any(s["id"] == sale_cab["id"] for s in lst_all)
lst_cab = call("GET", f"/sales?outlet_id={cab['id']}", prt).json()
assert all(s["outlet_id"] == cab["id"] for s in lst_cab) and any(s["id"] == sale_cab["id"] for s in lst_cab)

# --- detail
det = call("GET", f"/sales/{sale_cab['id']}", prt).json()
assert det["sale"]["id"] == sale_cab["id"] and "shop" in det
# rack snapshot on sale items
assert det["sale"]["items"][0].get("rack") == "R2-B1"

# --- role gates on sales
r = call("GET", "/sales", mek, ok=False)
assert r.status_code == 403
r = call("GET", "/sales", kas, ok=False)
assert r.status_code == 403

# --- whatsapp
wa = call("POST", f"/sales/{sale_cab['id']}/whatsapp", prt).json()
assert wa["status"] == "TERKIRIM" and wa["url"].startswith("https://wa.me/6281234567890")

# --- omzet dashboard should include sales
dash = call("GET", "/dashboard", own).json()
assert dash["omzet_hari_ini"] >= sale_cab["total"] + sale_pusat["total"], "dashboard omzet must include sales"

print("ALL ITERATION-4 BACKEND CHECKS PASSED")
