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

## Implemented (2026-01-18)
- Autentikasi & RBAC (admin/teknisi/kasir) dengan protected routes
- Dashboard: 4 KPI (servis aktif, revenue bulan, servis selesai, sparepart menipis) + revenue bar chart 6 bulan + pie chart status + recent tickets + low stock list
- Customer CRUD (search, edit, delete, riwayat servis modal) dengan WhatsApp button
- Repair tickets: create form (customer, brand, model, IMEI, keluhan, DP, biaya jasa), list dengan filter status & search, detail page dengan status workflow (4-step), teknisi assignment, add/remove sparepart (auto-adjust stock), catatan teknisi, invoice via WhatsApp
- Sparepart CRUD dengan low-stock alert (threshold) & filter
- User management (admin only) - create/edit/delete role
- Reports: revenue vs cost + estimated profit + top customers, range selector 3/6/12 bulan
- Responsive sidebar (desktop) + hamburger menu (mobile)
- PHP + MySQL source lengkap di `/app/php-backend/` dengan install.php, README, .htaccess

## Testing Status (iteration_1)
- 22/22 frontend E2E checks passed (100%)
- All flows working: auth, RBAC, CRUD operations, status workflow, sparepart deduction, WhatsApp link, mobile responsive

## Backlog / Next Actions
- P1: Konektor axios untuk switch antara localStorage mock ↔ PHP backend endpoint (saat ini masih hardcoded ke localStorage)
- P1: Print/PDF invoice yang rapi (saat ini menggunakan window.print browser default)
- P2: Payment tracking (partial payments log)
- P2: Warranty/garansi tracking untuk servis selesai
- P2: Barcode/QR code generator untuk tiket
- P3: Multi-cabang (multi-outlet)
- P3: Notifikasi WhatsApp otomatis via Twilio (opsional, saat ini manual wa.me)
- P3: Export laporan ke Excel/PDF
