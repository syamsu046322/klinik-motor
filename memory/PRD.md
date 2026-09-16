# KLINIK SUEL MOTOR — Bengkel Motor Management (Expo + FastAPI + MongoDB)

## Original Problem (Iterasi 5 — perbaikan bug dari backup Excel)
Perbaiki 7 bug kritis + tambah modul Penggajian & Pengaturan. UI bahasa Indonesia.

## Arsitektur
- Backend: FastAPI + Motor (MongoDB), JWT auth (owner/kasir/mekanik/partman), seed users & master data on startup.
- Frontend: Expo Router (file-based), @tanstack/react-query, tema oranye/hitam di src/theme.ts, komponen di src/components/ui.tsx.
- Roles: owner penuh; mekanik = superset kasir+partman operasional.

## User Personas
- Owner (pemilik): laporan, keuangan, penggajian, pengaturan, pembatalan.
- Kasir: pembayaran, piutang, belanja, outlet.
- Mekanik: servis, checklist SOP, tools.
- Partman: stok, cek fisik.

## Implemented — Iterasi 5 (2026-06) — 7 Bug Fixes + Payroll
- BUG1 Laba: service_items simpan `cost` (snapshot Part.cost) + `profit`; build_detail totals tambah `modal_part` & `laba`. "LABA PER NOTA" tampil di detail transaksi (owner).
- BUG2 Part sampah: `is_junk_part` (kode Z*/L*, nama Kosong/Low) → POST /parts tolak & masuk `import_trash`. POST /parts/cleanup (owner) pindah sampah + gabung kode duplikat. GET /import-trash, restore, delete. list_parts kirim `low_stock`. Tombol "Bersihkan Part Sampah" (ikon sparkles) di Stok + halaman Sampah Import.
- BUG3 Transaksi batal: pembayaran ditandai `cancelled:true`; semua laporan (dashboard omzet, /reports/omzet, laba-rugi, expense_summary, profit-trend) filter `cancelled != true`. Migrasi seed menandai pembayaran trx DIBATALKAN lama.
- BUG4 Kas & Laba Rugi: GET /reports/laba-rugi (harian + total: omzet, modal, belanja bengkel, prive, laba bersih, gaji mekanik %, ideal ≤30%). GET /reports/cashflow (Kas Bengkel & Kas Pribadi). Pengaturan saldo awal (GET/PUT /settings/finance). Dashboard owner: kartu "Laba Bersih Real".
- BUG5 Hutang: due_date dinormalisasi ke ISO date; pay-debt penuh → LUNAS; GET /debt-reminders (jatuh tempo ≤3 hari) + dashboard `debt_reminders_due`.
- BUG6 SOP mekanik: master `service_checklist_items` (default: Baut Kencang, Oli Cek, Test Jalan, Tools Lengkap), owner CRUD di Pengaturan. POST /transactions/{id}/sop simpan checklist; finish & print DIBLOKIR jika belum 100% OK. UI checklist di detail transaksi.
- BUG7 Keamanan batal: SEMUA pembatalan wajib password Owner (403 tanpa password); alasan wajib teks; migrasi bersihkan cancel_reason berisi password.
- PENGGAJIAN (owner): CRUD /employees (nama, jabatan, gaji pokok, bonus/unit). Mekanik = gaji pokok + (unit servis selesai bulan ini × bonus/unit). Kasir/Partman gaji tetap. Owner draw. GET /payroll/report (rekap + slip), GET /payroll/slip/{id}. Halaman /penggajian (kartu, slip, tambah/ubah/hapus).
- HAK AKSES: GET/PUT /settings/access (matriks fitur per jabatan). Menu Lainnya + hormati akses via src/access.ts.

## Test
- /app/backend/tests/test_iteration4_payroll_and_bugs.py — 26/26 PASS (JUnit iteration4.xml). Frontend: 4 layar baru render, dashboard Laba Bersih, menu owner lengkap.

## Backlog / Next
- P2: label teks di samping ikon "Bersihkan Part Sampah".
- P2: normalisasi due_date & LUNAS untuk penjualan langsung (sales) seperti servis.
- P2: slip gaji export PDF/WhatsApp.
- P2: split server.py per domain.
