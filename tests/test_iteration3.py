"""Iteration 3: low-stock notifications, expenses, tools checklist, mechanic report, backup."""
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


mek, kas, own, prt = login("mekanik", "mekanik123"), login("kasir", "kasir123"), login("owner", "owner123"), login("partman", "partman123")
pid = os.getpid() % 100000

# low stock notification to owner + partman
p = call("POST", "/parts", prt, json={"code": f"L{pid}", "name": f"Part Low {pid}", "price": 1000, "stock": 3, "min_stock": 2}).json()
call("POST", f"/parts/{p['id']}/adjust", prt, json={"qty": -2, "reason": "RUSAK"})
n_prt = call("GET", "/notifications", prt).json()
assert n_prt["items"] and n_prt["items"][0]["kind"] == "STOK MENIPIS" and f"Part Low {pid}" in n_prt["items"][0]["title"]
n_own = call("GET", "/notifications", own).json()
assert any(f"Part Low {pid}" in n["title"] for n in n_own["items"])
before = call("GET", "/notifications", prt).json()["unread"]
call("POST", f"/notifications/{n_prt['items'][0]['id']}/read", prt)
assert call("GET", "/notifications", prt).json()["unread"] == before - 1
print("low stock ok")

# expenses
cats = call("GET", "/expenses/categories", kas).json()
assert "Beli Part" in cats["BENGKEL"] and "Sekolah" in cats["KELUARGA"]
stock0 = call("GET", f"/parts?q=L{pid}", kas).json()[0]["stock"]
e = call("POST", "/expenses", kas, json={"group": "BENGKEL", "category": "Beli Part", "amount": 50000, "part_id": p["id"], "qty": 5, "note": "restock"}).json()
assert e["part_name"] == p["name"]
assert call("GET", f"/parts?q=L{pid}", kas).json()[0]["stock"] == stock0 + 5
call("POST", "/expenses", kas, json={"group": "KELUARGA", "category": "Sekolah", "amount": 200000, "note": "SPP"})
assert any(n["kind"] == "KASBON OWNER" for n in call("GET", "/notifications", own).json()["items"])
call("POST", "/expenses", kas, json={"group": "LAINNYA", "category": "Pinjaman Uang: Bank", "amount": 1000000, "counterparty": "BRI"})
assert call("POST", "/expenses", kas, ok=False, json={"group": "BENGKEL", "category": "Sekolah", "amount": 1}).status_code == 400
assert call("GET", "/expenses", mek, ok=False).status_code == 403
month = e["date"][:7]
s = call("GET", f"/expenses/summary?month={month}", own).json()
assert s["belanja_bengkel"] >= 50000 and s["kasbon_owner"] >= 200000 and s["pinjaman_masuk"] >= 1000000 and s["laba_bersih"] == s["omzet"] - s["belanja_bengkel"]
lst = call("GET", f"/expenses?group=BENGKEL&month={month}", kas).json()
assert any(x["id"] == e["id"] for x in lst)
call("DELETE", f"/expenses/{e['id']}", kas)
assert call("GET", f"/parts?q=L{pid}", kas).json()[0]["stock"] == stock0
print("expenses ok")

# tools checklist
t1 = call("POST", "/tools", mek, json={"name": f"Kunci Ring {pid}"}).json()
t2 = call("POST", "/tools", mek, json={"name": f"Obeng {pid}"}).json()
assert call("GET", "/tools", kas, ok=False).status_code == 403
st = call("GET", "/tools/status", mek).json()
assert "due" in st
cl = call("POST", "/tools/checklists", mek, json={"items": [{"tool_id": t1["id"], "status": "ADA"}, {"tool_id": t2["id"], "status": "HILANG", "note": "hilang"}], "note": "cek"}).json()
assert cl["ok"] == 1 and cl["total"] == 2
assert call("GET", "/tools/status", mek).json()["due"] is False
assert any(n["kind"] == "TOOLS BERMASALAH" for n in call("GET", "/notifications", own).json()["items"])
assert call("GET", "/tools/checklists", mek).json()[0]["id"] == cl["id"]
call("DELETE", f"/tools/{t2['id']}", mek)
dash = call("GET", "/dashboard", mek).json()
assert dash["tools"]["due"] is False
print("tools ok")

# mechanic report + backup
rep = call("GET", "/reports/mechanics", own).json()
assert "rows" in rep and "total_revenue" in rep
assert call("GET", "/reports/mechanics", kas, ok=False).status_code == 403
b = call("GET", "/backup/export", own)
assert b.headers["content-type"].startswith("application/vnd.openxml") and len(b.content) > 5000
print("ALL ITERATION-3 BACKEND CHECKS PASSED")
