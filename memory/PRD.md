# Aplikasi Servis HP - Klinik Kana

## Problem Statement (Original)
Create a comprehensive Mobile Phone Repair Management Web Application (Aplikasi Servis HP - Klinik Kana). Tech stack: PHP, React, Tailwind CSS. MySQL for production. Source PHP untuk upload ke hosting webserver. Fitur: RBAC (Admin/Teknisi/Kasir), Dashboard, Customer CRUD, Repair Tracking, Sparepart & Price Management. Design modern clean dengan sidebar navigation, responsive, Lucide icons.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Radix UI + Lucide icons + Recharts + Sonner. Uses localStorage for immediate demo. Located at `/app/frontend`.
- **Backend (siap-cPanel)**: PHP 7.4+ (PDO MySQL) + JWT (HS256, no library). Located at `/app/php-backend`. Endpoints REST di `/api/*`.
- **Database**: MySQL schema in `/app/php-backend/database.sql` with seed data.

## User Choices
- Tech stack: PHP native + MySQL untuk deployment ke cPanel; React+Tailwind frontend siap statis di preview
- Auth: JWT custom (username/password), 3 role: admin/technician/cashier
- WhatsApp: wa.me deep-link (tanpa API berbayar)
- Seed data: Ya, 4 user, 5 pelanggan, 8 sparepart, 8 servis
- Design: Modern clean sidebar (Swiss & High-Contrast archetype, Manrope + IBM Plex Sans)

## User Personas
1. **Admin (Owner)** - Melihat semua, kelola user, laporan keuangan.
2. **Teknisi** - Hanya lihat tugas servis, update status, gunakan sparepart.
3. **Kasir** - Melihat pelanggan & billing, buat tiket, kelola pembayaran.

## Implemented (2026-02) — Iteration 9 (Preferensi Ukuran Nota + Ekspor Laporan)
- **Preferensi Ukuran Nota Default (per user)**: Section baru "Preferensi Cetak (per user)" di halaman Konfigurasi. User pilih default A4 / Thermal 58mm / Thermal 80mm; disimpan di `localStorage.kk_pref_{user_id}` via `preferencesApi`. Halaman Invoice auto-load mode default sesuai preferensi user aktif.
- **Ekspor Laporan Excel & PDF** untuk keperluan pajak/akuntansi:
  - Panel "Unduh Laporan Bulanan" di halaman Laporan dengan month picker + tombol Excel (emerald) dan PDF (rose).
  - **Excel** (2 sheet: Ringkasan + Detail Tiket): 19 kolom termasuk tgl selesai, tiket, cabang, pelanggan, HP, perangkat, keluhan, teknisi, jasa, sparepart, total, DP, cicilan, sisa, HPP, laba, detail sparepart. Currency stored sebagai angka Excel-native. Total row auto.
  - **PDF** (landscape A4, jsPDF + autotable): header toko, box ringkasan (tiket, pendapatan, HPP, laba), tabel detail dengan header biru + total row + page numbering.
  - Filter otomatis pakai branch scope aktif (per cabang atau gabungan). Kalau tidak ada tiket selesai di bulan tersebut → toast warning.
- **File**: `/app/frontend/src/lib/reportExport.js`.
- Dependencies baru: `xlsx`, `jspdf`, `jspdf-autotable`.
- Verifikasi: Excel 22.8KB, 3 tiket ter-list, Ringkasan sheet lengkap dengan margin 56.62%. PDF 16.4KB.

## Implemented (2026-02) — Iteration 8 (Nota Thermal 80mm + Teknisi)
- **Nota Thermal 80mm** ditambahkan sebagai opsi cetak baru di halaman Invoice. Tombol pilihan sekarang: A4 · Thermal 58mm · Thermal 80mm.
- **80mm version**: layout scaled up (fontSize base 11px, QR 100px, padding 5mm, logo 38px) — cocok untuk printer thermal POS standar 80mm.
- **Teknisi ditampilkan di kedua nota thermal**: baris baru "Teknisi: {nama}" di section informasi tiket (58mm & 80mm).
- **Catatan Teknisi ditampilkan** (kalau ada) sebagai section terpisah dengan judul "Catatan Teknisi:" di italic — muncul di 58mm & 80mm.
- **Dynamic `@page` size injection**: karena `@page` CSS tidak bisa di-scope oleh class, halaman Invoice inject `<style>` element dinamis sesuai mode (`58mm auto` / `80mm auto` / `A4`) supaya printer dialog otomatis pilih ukuran kertas yang benar.
- Verified via Playwright: kedua mode render, `data-testid='thermal-technician'` = "Budi Santoso", `data-testid='thermal-technician-notes'` visible, width 80mm = 302px sesuai ekspektasi.

## Implemented (2026-02) — Iteration 7 (Cross-Device Public Status)
- **User-reported bug FIXED**: "pada status ready for pickup status di halaman publik masih In progress". Root cause: mock DB adalah localStorage-only, sehingga scan QR dari device lain (mis. HP pelanggan) tidak pernah lihat update admin.
- **Solusi**: Sinkronisasi ringan via FastAPI + MongoDB backend.
  - Endpoint baru `POST/GET /api/public-sync/{ticket_no}` (dengan `?only_if_new=true` untuk seed) dan `POST /api/public-sync/{ticket_no}/rating` (submit rating cross-device).
  - Setiap mutasi tiket di admin app (create, update, changeStatus, addPart, removePart, addPayment, removePayment, addRating, replyReview, deleteReply) sekarang mem-mirror snapshot publik ke server via `/app/frontend/src/lib/publicSync.js`.
  - Halaman publik `/status/:ticket_no` fetch server tiap 4 detik + on-focus + on-storage; fallback ke localStorage bila server offline. Rating dari HP pelanggan langsung masuk ke MongoDB (dan admin app di device lain lihatnya via server).
  - `ensureSeed` menggunakan `only_if_new` sehingga localStorage yang di-reset tidak akan menimpa data admin di server.
- **Verifikasi**: 11/11 backend tests PASS + cross-device propagation CONFIRMED oleh testing agent di isolated browser context (`iteration_7.json`). Admin ubah KK-2501-005 → Ready for Pickup → fresh context (no localStorage) → chip tampil "Ready for Pickup" dalam ≤5 detik.
- **Defensif**: `updateStatus` di RepairDetail sekarang memverifikasi return value dari `repairsApi.changeStatus` sebelum toast success, mencegah "silent no-op" toast bohong.

## Implemented (2026-02) — Iteration 6 (Reply Ulasan)
- **Admin balasan pada ulasan**: Di halaman `/reviews`, admin bisa klik "Balas Ulasan" pada setiap ulasan → tampil textarea (max 500 char) → simpan. Balasan ditampilkan sebagai blockquote biru dengan nama admin & tanggal. Admin bisa Edit/Hapus balasan.
- **Balasan tampil di halaman publik**: Card "Terima kasih atas ulasannya!" di `/status/:ticket_no` sekarang menampilkan blok "💬 Balasan dari toko" berisi balasan admin (auto-refresh mengikuti mekanisme yang sudah ada).
- **Persistensi**: field baru `admin_reply`, `admin_reply_by`, `admin_reply_at` di data repair (localStorage + PHP schema).
- **RBAC**: Hanya `admin` yang bisa membalas/edit/hapus. Kasir bisa melihat ulasan & balasan tapi tidak bisa membalas.
- **PHP backend**:
  - Kolom baru + migration ALTER TABLE aman-re-run di `/app/php-backend/database.sql`.
  - Endpoint `POST /api/repairs/reply.php?id={id}` dan `DELETE /api/repairs/reply.php?id={id}` (admin-only).
  - `GET /api/public/status.php` mengembalikan `admin_reply` + `admin_reply_at`.
- Smoke-tested end-to-end via Playwright: rating submit → admin login → reply submit → verify tampil di halaman publik pelanggan. ✅

## Implemented (2026-02) — Iteration 5 (Rating & Auto-Refresh)
- **Bug fix: Public status auto-refresh**. Halaman `/status/:ticket_no` sekarang re-read localStorage setiap 4 detik (setInterval), listen `storage` event (sync antar tab), `visibilitychange`, dan `focus` event. Ditambah tombol manual refresh (`btn-refresh-status`) di header publik. Status di halaman pelanggan otomatis update saat admin mengubah status di tab lain.
- **Rating Pelanggan (fitur baru)**:
  - Form rating (5 bintang interaktif + textarea ulasan max 500 karakter + label sematik "Sangat Kurang → Sangat Baik") muncul di halaman `/status/:ticket_no` hanya jika status = `picked_up` dan belum ada rating.
  - Setelah submit → card "Terima kasih atas ulasannya!" dengan bintang yang dipilih & kutipan ulasan. Rating final, tidak bisa diubah.
  - Persisted ke localStorage (fields baru di repair: `rating`, `review`, `rated_at`).
  - `repairsApi.addRating`, `addRatingByTicket`, `withReviews` di `/app/frontend/src/lib/store.js`.
- **Halaman "Ulasan Pelanggan" (admin/cashier)** di `/reviews`:
  - Stats cards: rata-rata rating, total ulasan, % ulasan positif (rating 4-5).
  - Distribusi rating (progress bar per bintang, klik untuk filter).
  - Search (nama pelanggan / tiket / perangkat / isi ulasan) + filter dropdown by rating.
  - List ulasan dengan avatar, star chip, kutipan, link ke detail tiket.
- **PHP backend siap-cPanel**:
  - Kolom `rating`, `review`, `rated_at` + index di tabel `repairs` (`/app/php-backend/database.sql`).
  - Migration ALTER TABLE aman-re-run untuk install lama.
  - Endpoint publik `POST /api/public/rating.php` dengan validasi (rating 1-5, status harus picked_up, one-shot).
  - `GET /api/public/status.php` mengembalikan `rating`/`review`/`rated_at`.
- Testing 7/7 skenario PASSED (iteration_5.json).


- **Branches CRUD** (admin only) di `/branches`: kelola nama, kode, alamat, telepon, set default cabang
- **BranchProvider + BranchSelector**: dropdown di topbar kanan atas untuk switch "Semua Cabang" atau pilih cabang spesifik. Non-admin (teknisi/kasir) LOCKED ke cabang mereka.
- **Data scoping otomatis**: Dashboard KPI, Repairs list, Customers, Sparepart, RepairNew customer dropdown — semua auto-filter by selected branch. New records inherit branch dari selected/customer branch.
- **Kontribusi Cabang** section di Reports: progress bar horizontal menampilkan pendapatan & tiket per cabang saat "Semua Cabang" dipilih.
- **User branch assignment**: field `branch_id` di user form + tabel kolom Cabang. Kosong = admin/owner (semua cabang).
- **Seed v2**: 2 cabang default (Cabang Utama HQ, Cabang Bandung BDG), data distribusi realistis.
- Fixed: BranchSelector auto-refresh setelah create/update/delete cabang via `kk_branch_changed` event.
- Testing 13/13 skenario PASSED.

## Implemented (2026-01-18) — Iteration 3
- **Cek Status Publik**: Halaman publik `/status/:ticket_no` — pelanggan scan QR dari nota → langsung lihat status tanpa login. Tampilan mobile-first dengan hero card status berwarna, timeline 4-step, detail perangkat, keluhan, rincian biaya, kontak toko dengan tombol WhatsApp.
- **Privasi**: Nama pelanggan & telepon di-mask (Rina M*****a, 0812****2222). Cost prices, notes teknisi internal disembunyikan.
- **QR di invoice A4 & Thermal** sekarang encode URL `/status/{ticket_no}` (bukan JSON). Thermal receipt juga menampilkan URL sebagai fallback jika QR tidak bisa di-scan.
- **Tombol Salin Link Status** di RepairDetail header - staff bisa copy URL untuk kirim via SMS/WA manual.
- **Placeholder `{status_url}`** di template WhatsApp — link cek status otomatis masuk ke pesan WA yang dikirim ke pelanggan.
- **PHP endpoint publik** `/api/public/status.php?ticket=...` dengan masking sanitized, tanpa require auth token.
- **Handling not found** dengan CTA kontak WA toko

## Implemented (2026-01-18) — Iteration 2
- Sidebar berwarna navy blue (`--sidebar-bg`), branding dinamis dari settings
- Halaman **Konfigurasi** (admin only): upload logo (base64), edit nama toko/tagline/alamat/telepon, footer nota, template WhatsApp dengan placeholder ({customer_name}, {shop_name}, {ticket_no}, {device}, {status}, {total}, {deposit}, {balance}, {status_message}), + 4 template pesan status khusus
- **Cetak Nota**: Halaman `/repairs/:id/invoice` — toggle A4 vs Thermal 58mm, siap print, dengan logo, QR code, info lengkap
- **QR Code** di invoice A4 & thermal (via `qrcode.react`), berisi JSON ticket_no + id + shop
- **Riwayat Pembayaran** di RepairDetail: catat cicilan/pelunasan multi-metode (Tunai/Transfer/QRIS/E-Wallet/Kartu), balance auto-update (deposit + payments = paid), tampil di invoice
- **Konektor PHP** (`/app/frontend/src/lib/apiPhp.js` + `/app/frontend/src/lib/dataMode.js`): axios wrappers untuk semua endpoint PHP, toggle via `REACT_APP_DATA_MODE=local|php` di `.env`
- PHP backend expanded: endpoint `/api/settings/index.php`, `/api/repairs/payments.php`, tabel `payments` + `app_settings` di schema
- Fixed: Sidebar & Topbar sekarang auto-refresh saat settings di-save via custom event `kk_settings_changed`

## Implemented (2026-01-18) — Iteration 1
- Autentikasi & RBAC (admin/teknisi/kasir) dengan protected routes
- Dashboard: 4 KPI + revenue bar chart 6 bulan + pie chart status + recent tickets + low stock list
- Customer CRUD (search, edit, delete, riwayat servis modal) dengan WhatsApp button
- Repair tickets: create form, list dengan filter status & search, detail page dengan status workflow (4-step), teknisi assignment, add/remove sparepart (auto-adjust stock), catatan teknisi
- Sparepart CRUD dengan low-stock alert (threshold) & filter
- User management (admin only)
- Reports: revenue vs cost + estimated profit + top customers, range selector 3/6/12 bulan
- Responsive sidebar + hamburger menu mobile
- PHP + MySQL source lengkap di `/app/php-backend/` dengan install.php, README, .htaccess

## Testing Status
- Iteration 1: 22/22 E2E passed (100%)
- Iteration 2: 15/15 new features passed (100%)

## Backlog / Next Actions
- P0: **Cari Pelanggan Cepat** — auto-fill data pelanggan saat mengetik nomor HP di form buat tiket baru (jika pelanggan sudah ada di sistem).
- P1: **Notifikasi Stok** — email/WA ke admin ketika stok sparepart di bawah threshold.
- P1: **Twilio WA Otomatis** — kirim WA otomatis saat status berubah ke "Ready" (butuh `integration_playbook_expert_v2`).
- P2: Warranty/garansi tracking untuk servis selesai.
- P2: Dashboard widget "Rating rata-rata bulan ini".

