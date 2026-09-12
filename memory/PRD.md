# KLINIK SUEL MOTOR — PRD

## Original Problem Statement
Aplikasi mobile (React Native/Expo) "KLINIK SUEL MOTOR" untuk manajemen bengkel motor. 4 role: Owner, Kasir, Mekanik, Partman. Login username/password. Bahasa Indonesia, warna oranye & hitam (tema terang). Workflow transaksi servis lengkap dari pendaftaran → antrian → mekanik → tambahan (persetujuan) → final check → work order → kasir → pembayaran → stok berkurang → cetak nota → WhatsApp → histori servis. Partman: stok + barcode scan + cari part. Owner: semua akses + dashboard omzet harian/bulanan + export/import Excel (pelanggan, jasa, stok, motor).

## User Choices
- Seed accounts: owner/owner123, kasir/kasir123, mekanik/mekanik123, partman/partman123
- Barcode via expo-camera + input manual fallback
- Excel export via share sheet, import via document picker
- Light theme (Brutalist Mobile, orange #FF6B00 / black #111111)

## Architecture
- Backend: FastAPI + MongoDB (motor), JWT (PyJWT) + Argon2 (pwdlib). Single `backend/server.py`. All routes `/api/*`.
- Collections: users, customers, vehicles, services, parts, service_transactions, service_complaints, service_estimations, service_items, service_additional_items, work_orders, payments, invoices, stock_movements, service_history, whatsapp_logs, transaction_status_logs, audit_logs, counters.
- Frontend: Expo Router. Tabs (Beranda/Antrian/Stok/Lainnya, role-gated), stack screens: login, transaksi/baru, transaksi/[id], nota/[id], histori, master/{pelanggan,motor,jasa}, stok/[id], mutasi, laporan, pengguna.
- Theme tokens in `src/theme.ts`; UI kit in `src/components/ui.tsx`; add-item sheet + scanner components.

## Status flow
TERDAFTAR → MENUNGGU_SERVIS → DIPROSES ⇄ MENUNGGU_PERSETUJUAN → MENUNGGU_KASIR → MENUNGGU_PEMBAYARAN → SUDAH_DIBAYAR → NOTA_DICETAK → NOTA_TERKIRIM → SELESAI | DIBATALKAN

## Implemented (2026-06)
- Auth + RBAC, seeded users, user management (owner)
- Customer/vehicle master, search by HP/nama/nopol; multi-vehicle per customer
- Transaksi baru multi-step (pelanggan, motor, keluhan, estimasi, mekanik) → auto queue A-xxx per day, TRX no
- Mekanik: mulai servis, tambah jasa/part (stock check, snapshot price), approval tambahan, final check, work order
- Kasir: checkout, pembayaran (CASH/TRANSFER/QRIS/DEBIT/KREDIT), diskon, kembalian, konfirmasi dialog, atomic lock (anti double-submit), stok berkurang + mutasi SERVIS, invoice NS-xxx
- Nota screen: cetak (expo-print HTML thermal/A4), kirim WhatsApp (wa.me + log status), selesaikan transaksi
- Histori servis (search nota/nopol/nama/HP/tanggal/mekanik; per kendaraan)
- Audit trail per transaksi + status logs; owner price change with reason
- Partman: stok list, low-stock filter, barcode scanner (camera + manual), part CRUD, stok masuk/keluar, mutasi
- Owner dashboard (omzet hari ini/bulan, per metode, performa mekanik, stok menipis), laporan harian/bulanan, export/import Excel 4 entitas
- Tests: /app/tests/test_workflow.py (E2E backend), /app/backend/tests/test_roles_and_export.py

## Implemented (2026-06) — Iterasi 2
- Profil Bengkel (owner): nama/alamat/HP/WhatsApp + logo (Emergent Object Storage, default logo lampiran user); logo di login & nota
- Pengingat servis per kendaraan (next_date final check, fallback +60 hari) + kirim WhatsApp, log terkirim
- Export laporan omzet harian/bulanan ke Excel (2 sheet: ringkasan + rincian transaksi)
- Transaksi: tombol Cari Jasa/Part, edit nama/harga/qty item (pencil), hapus per item, update instan (setQueryData), nama jasa bisa diubah saat tambah
- Edit faktur yang sudah dibayar oleh kasir dengan verifikasi password Owner (unlock mode), stok & total pembayaran ikut disinkronkan, audit INVOICE_EDIT
- Pembatalan faktur berbayar (password Owner) + pengembalian stok; Laporan Pembatalan (owner)
- Pembayaran KREDIT: hutang penuh/sebagian + jatuh tempo; notifikasi in-app Owner (bel + daftar + tombol WA ke Owner); layar Piutang + cicilan pelunasan
- Owner: hapus pengguna (soft delete), hapus semua part/jasa (soft delete, konfirmasi password)
- Stok habis: abu-abu, tidak bisa ditambahkan ke transaksi (semua role)

## Implemented (2026-06) — Iterasi 3
- Notifikasi multi-role (roles + read_by): stok menipis/habis → Owner & Partman; kasbon owner, tools bermasalah → Owner; checklist mingguan → Mekanik (lazy weekly reminder on dashboard)
- Riwayat per mekanik (/reports/mechanics, /laporan-mekanik): servis selesai, omzet, jasa, part per bulan
- Backup semua data ke Excel (/backup/export) dari layar Laporan
- Belanja (/expenses): BENGKEL (Beli Part → stok masuk otomatis, biaya operasional), KELUARGA (kasbon owner), LAINNYA (pinjaman masuk / uang dipinjam keluar); summary omzet, belanja bengkel, laba bersih, kasbon
- Checklist tools mekanik (/tools): master alat, checklist ADA/RUSAK/HILANG, riwayat, banner pengingat 7 hari

## Implemented (2026-06) — Iterasi 4
- Outlet cabang (owner buat cabang; Bengkel Pusat otomatis), stok terpisah per cabang (outlet_stocks) + transfer/retur dari pusat
- Penjualan part langsung (owner & partman) per outlet: keranjang, faktur PJ-xxx, CASH/TRANSFER/QRIS/DEBIT, kembalian, stok outlet berkurang, payment masuk omzet; nota penjualan cetak + WhatsApp; riwayat per cabang
- Lokasi rak pada part (form tambah/edit, list stok, pencarian, add-item sheet, item transaksi untuk mekanik)

## Implemented (2026-09) — Restore & Preview
- Project restored from user-uploaded zip backup into this environment (deps installed, backend .env rebuilt: JWT_SECRET, JWT_EXPIRE_MINUTES, EMERGENT_LLM_KEY untuk object storage)
- Verified end-to-end: 59/59 backend tests pass, login 4 role OK, semua tab & flow transaksi baru berfungsi di preview web

## Implemented (2026-09) — Iterasi 5 (permintaan user)
- Mekanik kini dapat mengerjakan SEMUA tugas kasir & partman (akses penuh operasional): backend deps KasirUser/PartmanUser/StockUser menyertakan mekanik; frontend `can()` memperlakukan mekanik sebagai super-worker → semua menu/tombol kasir & partman muncul untuk mekanik
- Jualan langsung ditingkatkan (owner/kasir/partman/mekanik): input konsumen nama+alamat+HP, per-part harga jual/harga beli/diskon (semua bisa diubah), laba otomatis per item & total, tanggal default hari ini bisa diubah; pembayaran CASH atau KREDIT (kredit → piutang penuh/sebagian + jatuh tempo, muncul di layar Piutang; endpoint POST /sales/{id}/pay-debt untuk cicilan). /debts kini menggabungkan hutang servis + hutang penjualan. Nota jual menampilkan alamat, sisa hutang, dan laba (khusus owner)
- Scanner barcode kini membaca DataMatrix 2D (Honda genuine parts) + PDF417/Aztec/Code93/Codabar/ITF14 selain 1D lama; karakter kontrol GS1 (FNC1) dibersihkan otomatis agar cocok dengan barcode part. Catatan: pemindaian 2D hanya bisa diuji nyata via kamera perangkat (Expo Go/real device), bukan preview web

## Backlog
- P1: WhatsApp API integration (currently wa.me deep link), print via Bluetooth thermal printer natively
- P1: Edit shop profile (nama/alamat/telepon) from app; logo upload
- P2: Laporan export transaksi/omzet ke Excel; filter tanggal laporan
- P2: Piutang (KREDIT) tracking & pelunasan
- P2: Notifikasi pengingat servis berikutnya ke pelanggan

## Bug Fix (2026-09) — Iterasi 5
- FIX: Import Excel stok barang di mobile gagal "Tidak dapat terhubung ke server". Root cause: regresi fetch+FormData file URI di React Native 0.86 (Expo SDK 57). Solusi: `api()` di src/api.ts kini punya opsi `upload` yang memakai native multipart upload expo-file-system (`File.upload`, UploadType.MULTIPART) di iOS/Android; web tetap fetch FormData. importExcel di src/excel.ts memakai path native ini. Diverifikasi testing_agent iterasi 5 (PASS): e2e web import, backend 6/6 pytest, tanpa regresi API lain.
- Cleanup minor: deprecated prop pointerEvents di toast (ui.tsx) dipindah ke style.

## Enhancement (2026-09) — Iterasi 6
- Import Excel stok (parts) tanpa batas jumlah baris: diproses bulk (1 query existing + bulk_write chunk 1000 + insert_many mutasi stok) — 5000 baris < 1 detik, update tetap mencatat mutasi IMPORT EXCEL. Daftar stok /parts kini tanpa batas 1000 item (to_list(None)) agar semua hasil impor tampil.

## Enhancement (2026-09) — Iterasi 7
- Import stok mendukung format Excel user: A=Kode, B=Nama Part, C=Barcode, D=Harga Jual, E=Harga Beli, F=Stok, G=Stok (diabaikan), H=Satuan, I=Lokasi Rak. Kolom header berduplikat kini diabaikan (kemunculan pertama dipakai) sehingga kolom G tidak menimpa stok kolom F. Format export lama (dengan Stok Minimum) tetap kompatibel. Teruji: insert/update/mutasi/3000 baris.

## Housekeeping (2026-09) — Iterasi 8
- Hapus permanen 5001 part uji "Bulk/BULK" (beserta mutasi/stok outlet terkait) dari database atas permintaan user. Diverifikasi: import file berisi kode yang sama setelah penghapusan menghasilkan inserted (bukan updated), tanpa duplikat, tanpa error.

## Fitur (2026-09) — Iterasi 9
- Cek Fisik Stok (stock opname) untuk Owner & Partman: sesi harian (resume otomatis), semua part urut rak alami (A1.01.01.1 dst, tanpa rak di akhir), centang + input jumlah fisik per part, hitung selisih otomatis. Selisih diajukan Partman → notifikasi persetujuan ke Owner (bukan password) → Owner setujui (stok diset = fisik, mutasi reason 'CEK FISIK STOK', notif balik ke Partman) atau tolak (stok tak berubah). Riwayat sesi per tanggal + daftar selisih (nama part, stok sistem, fisik, selisih). Layar: /cek-stok, /cek-stok/[id]; menu di Lainnya; tap notifikasi → detail sesi. Testing agent iterasi 6: 46/46 backend + E2E frontend PASS.


## Restore (2026-09) — Environment Baru (lanjutan kredit)
- Project dipulihkan dari upload zip user (klinik-motor-main.zip) ke environment baru ini. Isi zip diverifikasi = aplikasi user hingga Iterasi 9 (lebih baru dari "pengembangan ke-7" yang user ingat).
- Setup: backend .env dibuat ulang (JWT_SECRET baru, JWT_EXPIRE_MINUTES=43200, DB_NAME=klinik_motor, EMERGENT_LLM_KEY untuk object storage); litellm dihapus dari requirements (konflik dengan emergentintegrations, tidak dipakai server.py); deps diinstal ke /root/.venv (pip venv backend supervisor); argon2-cffi dipasang untuk pwdlib.
- CATATAN PENTING: database environment baru KOSONG. Data servis/transaksi lama berada di MongoDB environment lama dan TIDAK ikut dalam zip. Master data (pelanggan, motor, jasa, stok) bisa dipulihkan via fitur Import Excel jika user punya file export/backup lama; riwayat transaksi servis lama tidak bisa diimpor via Excel.
- Terverifikasi manual: login owner OK (API + UI), dashboard owner render lengkap (omzet, antrian, kasir, piutang, tab bar).