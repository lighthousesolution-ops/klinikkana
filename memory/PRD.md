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
- P1: Konektor axios untuk switch antara localStorage mock ↔ PHP backend endpoint (saat ini masih hardcoded ke localStorage)
- P1: Print/PDF invoice yang rapi (saat ini menggunakan window.print browser default)
- P2: Payment tracking (partial payments log)
- P2: Warranty/garansi tracking untuk servis selesai
- P2: Barcode/QR code generator untuk tiket
- P3: Multi-cabang (multi-outlet)
- P3: Notifikasi WhatsApp otomatis via Twilio (opsional, saat ini manual wa.me)
- P3: Export laporan ke Excel/PDF
