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

## Implemented (2026-02) — Iteration 20 (Bug fix: picker jasa tidak muncul saat edit tiket)
Bug: Di halaman detail/edit tiket, section "Rincian Jasa Servis" hanya menampilkan `<ServiceList>` read-only. Teknisi/admin tidak bisa menambah/mengubah katalog jasa, paket, atau kustom pada tiket lama — hanya bisa di form tiket baru.

- `/app/frontend/src/pages/RepairDetail.jsx`:
  - Import `ServicePicker` selain `ServiceList`
  - Tambah state `services` (init dari `repair.services_json`) + `servicesTotal` derived
  - `saveEdit()` sekarang kirim `services_json` + validasi custom name & preset item_id (mirror pola RepairNew); `service_fee` auto-derived dari `servicesTotal` kalau picker punya isi
  - Field "Biaya Jasa" di section Detail Servis auto-disable + tampilkan total saat picker terisi (konsisten dengan RepairNew)
  - Section "Rincian Jasa Servis" sekarang render `<ServicePicker>` (editable) untuk role yang boleh edit price (admin/cashier). Non-editable role tetap dapat `<ServiceList>` read-only.
  - Tombol "Simpan Jasa" khusus di section (selain "Simpan" utama Detail Servis) supaya user bisa save perubahan katalog langsung
- Deploy: build ulang frontend saja (tidak ada perubahan PHP/schema).


## Implemented (2026-02) — Iteration 19 (Bug fix: total tiket salah + decimal aneh)
Akar masalah: MySQL `DECIMAL(12,2)` dikembalikan PDO sebagai **string** (mis. `"200000.00"`). Di `computeTotal`, ekspresi `(repair.service_fee || 0) + parts` melakukan **string concatenation** → `"200000.00" + 220000 = "200000.00220000"` → di-format `toLocaleString('id-ID')` = `"Rp 200.000,002"` (bukan `Rp 420.000`).

- `/app/frontend/src/lib/store.js` — `computeTotal()`: paksa `Number()` pada `service_fee`, `p.qty`, `p.price`, `p.amount` sebelum arithmetic. Verifikasi Node: bug reproduce `"200000.00220000"` → fix `420000`.
- `/app/frontend/src/lib/utils.js` — `formatIDR()` sekarang pakai `Math.round(Number(n))` agar Rupiah selalu bulat (safety net: kalau ada nilai float dari operasi hitung lain, tidak akan ada `,002` di UI).
- Deploy: build ulang frontend + rsync `build/` ke VPS.


## Implemented (2026-02) — Iteration 18 (Laporan Jasa Terlaris + Preset Paket Jasa)

**Fitur 1 — Top 5 Jasa Bulan Ini (Dashboard):**
- `pages/Dashboard.jsx` — `useMemo topServices` aggregate `services_json` dari repairs `created_at` bulan berjalan, group by nama (case-insensitive), sort by count desc, ambil top 5.
- Section baru "Produk Andalan / Top 5 Jasa Bulan Ini" dengan horizontal BarChart (dataKey=count, warna gradasi rank 1–5) + grid kartu ringkasan 5 kolom menampilkan #rank, nama, count, dan revenue.
- Empty state saat belum ada order jasa bulan ini (icon Trophy + pesan onboarding).

**Fitur 2 — Preset Paket Jasa (Bundel):**
- Backend: tabel baru `service_packages` (id, name, description, items_json TEXT storing array of service_item_id). Endpoint `/api/service-packages/index.php` GET/POST/PUT/DELETE (admin mutasi only, viewer semua role). File migrasi `/app/php-backend/migrations/2026_02_service_packages.sql`. Seed 3 paket populer.
- Frontend: `servicePackagesApi` (localStorage + mirror), `phpServicePackagesApi`, pull sync, seed `SEED_SERVICE_PACKAGES`.
- `components/ServiceCatalogSection.jsx` — ekspor tambahan `<ServicePackageSection>` dan `<PackageModal>`. Grid 2-kolom kartu paket (chip jasa, jumlah, total). Modal buat/edit dengan checklist jasa dikelompokkan per kategori. Validasi min 1 jasa terpilih.
- `pages/Settings.jsx` — mount `<ServicePackageSection />` setelah kategori section (admin only).
- `components/ServicePicker.jsx` — tombol baru "Tambah Paket" (hanya muncul jika ada paket). Modal picker menampilkan setiap paket dengan chip jasa & total. `applyPackage()` expand paket menjadi row-row individual dengan flag `from_package` — user tetap bisa edit harga per baris atau hapus salah satunya. Badge "Paket XYZ" muncul di kolom Kategori row hasil paket.

**Testing:** 100% frontend tests passed (20/20 assertions). Report: `/app/test_reports/iteration_14.json`.

**Deploy:**
1. VPS MySQL: `mysql -u USER -p DB < php-backend/migrations/2026_02_service_packages.sql`
2. Push `php-backend/api/service-packages/` ke VPS
3. `yarn build` di Mac → `rsync build/` ke VPS (tanpa `--delete`)


## Implemented (2026-02) — Iteration 17 (Fitur baru: Skema Harga & Kategori Jasa Servis)
Fitur besar untuk memudahkan teknisi memilih jenis kerusakan umum saat buat tiket, dengan tetap boleh override harga per tiket.

**Backend (PHP + MySQL):**
- Tabel baru `service_categories` (id, name, icon, sort_order) dan `service_items` (id, category_id FK CASCADE, name, default_price, duration_minutes).
- Kolom baru `repairs.services_json` TEXT — menyimpan array {id, category_id, item_id, name, price, is_custom} per tiket.
- Endpoint PHP baru: `/api/service-categories/index.php` dan `/api/service-items/index.php` (GET/POST/PUT/DELETE, admin only untuk mutasi).
- `/api/repairs/index.php` — POST & PUT sekarang terima `services_json` (array atau string), GET auto-decode ke array untuk frontend.
- File migrasi `/app/php-backend/migrations/2026_02_service_catalog.sql` untuk user yang sudah punya DB lama (idempotent CREATE + ALTER + INSERT seed).
- Seed data: 7 kategori (Layar/LCD, Baterai, Port Charging, IC/Motherboard, Software, Speaker/Mic, Kerusakan Air) + 18 jasa preset (harga acuan Rp 50k–850k).

**Frontend (React):**
- `mockData.js` — SEED_SERVICE_CATEGORIES & SEED_SERVICE_ITEMS.
- `store.js` — `serviceCategoriesApi` + `serviceItemsApi` (CRUD via localStorage + write-through phpMirror). Delete kategori cascade delete item lokal.
- `apiPhp.js` — `phpServiceCategoriesApi` + `phpServiceItemsApi`.
- `pullFromServer.js` — fetch kategori & item saat login/mount/sync (normalisasi Number untuk default_price & duration_minutes).
- `phpMirror.js` — `serviceCategory.upsert/remove` & `serviceItem.upsert/remove`.
- **`components/ServicePicker.jsx`** — komponen multi-row: Kategori dropdown → Jasa dropdown → Harga (auto-fill dari default_price, editable) → Trash. Tombol "Tambah dari Katalog" + "Tambah Jasa Custom" (badge Custom, nama & harga bebas). Total auto-sum di footer tabel. Ekspor `<ServiceList>` untuk read-only summary.
- **`components/ServiceCatalogSection.jsx`** — Master data CRUD di halaman Konfigurasi (admin only). Kategori collapsible, tombol tambah/edit/hapus untuk kategori & jasa.
- `pages/RepairNew.jsx` — mount `<ServicePicker>`; jika picker berisi ≥1 row, field "Estimasi Biaya Jasa" auto-disabled dan menampilkan total. `services_json` tersimpan bareng tiket.
- `pages/RepairDetail.jsx` — section baru "Rincian Jasa Servis" (read-only) muncul kalau tiket punya `services_json`.
- `pages/Invoice.jsx` — A4 & thermal keduanya render per-line jasa dari `services_json`; fallback ke 1 baris `service_fee` klasik kalau tidak ada.
- `pages/Settings.jsx` — mount `<ServiceCatalogSection />` hanya untuk admin, di atas section Teks Nota.

**Testing:** 100% frontend tests passed (27/27 assertions) — CRUD katalog, alur end-to-end pilih jasa katalog + custom + edit harga, sum total, invoice per-line, teknisi role hidden dari master data. Report: `/app/test_reports/iteration_13.json`.

**Deploy:**
1. VPS MySQL: jalankan `/app/php-backend/migrations/2026_02_service_catalog.sql` via SSH/phpMyAdmin.
2. VPS PHP: `rsync` folder `php-backend/api/service-categories/`, `php-backend/api/service-items/`, dan file `php-backend/api/repairs/index.php`.
3. Frontend: `yarn build` di Mac → `rsync build/` ke VPS (JANGAN pakai `--delete`).


## Implemented (2026-02) — Iteration 16 (Bug fix: branch_id tiket baru selalu br1)
- **`/app/frontend/src/lib/store.js`** — Tambah helper `resolveBranchIdForNew(dataBranchId)` yang mengembalikan branch berdasarkan prioritas: `data.branch_id` eksplisit → (non-admin) `user.branch_id` → (admin) pilihan BranchSelector aktif → `user.branch_id` admin → `is_default`.
- **`repairsApi.create`** — Pakai helper (bukan lagi baca customer.branch_id yang sering null → jatuh ke `is_default`/br1). Customer.branch_id sekarang hanya jadi last-ditch fallback.
- **`customersApi.create`** dan **`sparepartsApi.create`** — Pakai helper yang sama supaya pola tidak berulang.
- Deploy: build ulang frontend saja (`yarn build` → `rsync build/` ke VPS, tanpa `--delete`).


## Implemented (2026-02) — Iteration 15 (Bug fix: cabang di header selalu Sriwijaya)
- **`/app/php-backend/api/auth/login.php`** — SELECT sekarang include `branch_id` sehingga objek `user` yang dikirim ke frontend membawa cabangnya.
- **`/app/php-backend/includes/auth.php`** — `auth_user()` SELECT include `branch_id` (dipakai oleh `me.php` dan semua endpoint yang panggil `auth_user()`).
- **`/app/frontend/src/contexts/BranchContext.js`** — Admin fallback: pilihan localStorage → `user.branch_id` → "Semua". Non-admin tetap terkunci ke `user.branch_id`.
- **`/app/frontend/src/contexts/AuthContext.js`** — `login()` dan `logout()` menghapus `kk_current_branch` supaya user baru tidak mewarisi pilihan cabang user sebelumnya di device yang sama.
- Deploy: `rsync` `api/auth/login.php`, `includes/auth.php`, dan build frontend baru ke VPS.


## Implemented (2026-02) — Iteration 14 (Bug fix: branch_id user tidak tersinkron)
- **`/app/php-backend/api/users/index.php` GET** — Menambahkan `branch_id` di SELECT (list + single). Sebelumnya UI selalu menampilkan "Semua" walau di DB sudah tersimpan cabang, karena field tidak dikirim ke frontend.
- **`/app/php-backend/api/users/index.php` PUT** — Menambahkan `branch_id` ke `$allowedAdmin`. Sebelumnya admin edit cabang user tidak tersimpan ke MySQL. Sekarang partial PUT dengan `branch_id: null` juga bekerja (di-set NULL).
- **`/app/php-backend/api/users/index.php` POST response** — Sudah include `branch_id` sehingga user baru langsung tampil dengan cabang benar tanpa perlu refresh dari server.
- Deploy: user tinggal `rsync` file `api/users/index.php` ke VPS.


## Implemented (2026-02) — Iteration 13 (Perbaikan PHP Backend untuk Sync MySQL VPS)
Konteks: user melaporkan MySQL di VPS tidak berubah walau UI berjalan. Testing agent (iter 10-12) menemukan sederet defect PHP setelah `phpMirror` diaktifkan. Sekarang semua defect kritis diperbaiki.
- **`repairs/index.php` PUT** — Dulu mutually-exclusive antara update status dan update field; sekarang dua-duanya jalan bareng via cek `hasFields`. SET clause dibangun DINAMIS dari `array_key_exists`, jadi partial PUT (mis. hanya `{notes}`) tidak lagi menghapus kolom lain. `completed_at` / `picked_up_at` di-guard dengan `COALESCE(...)` sehingga tidak di-restamp saat mirror kirim status sama berulang.
- **`repairs/reply.php`** — Ganti `require_auth()` (undefined → 500 fatal) dengan `require_role(['admin'])`. Balasan admin ke ulasan pelanggan sekarang tersimpan ke MySQL.
- **`users/index.php` PUT** — Sekarang mengizinkan **self-edit** (non-admin ganti password sendiri) via cek `$isSelf`; role/full_name tetap admin-only (non-admin tidak bisa escalate). SET clause dinamis, tidak menghapus field yang tidak dikirim.
- **`store.js#changeOwnPassword`** — Sekarang panggil `phpMirror.user.upsert(users[idx])` agar password baru tersinkron ke MySQL.
- **`response.php`** — `display_errors=0` + `set_exception_handler` + `register_shutdown_function` menutup kebocoran stack trace pada error 500 (semua fatal PDO sekarang balas `{"error":"Internal server error"}` tanpa path/file).
- **Verifikasi**: `test_php_string_ids.py` + `test_php_iteration11.py` + `test_php_iteration12.py` — **84 passed, 1 env-skip, 0 failed**. Iter-10 dan iter-11 defects semuanya CONFIRMED FIXED.
- **Env-only (belum diverifikasi di preview, harus dites di VPS MySQL)**: `dashboard/stats.php` (DATE_FORMAT/DATE_SUB), `repairs/parts.php` (FOR UPDATE).


## Implemented (2026-02) — Iteration 12 (Reset Password Sendiri via Profil)
- **Halaman Profil `/profile`** (semua role: admin, teknisi, kasir).
  - Identity card: avatar, nama, username, role badge, cabang, telepon, tanggal dibuat.
  - Form ganti password: input Password Lama + Password Baru + Ulangi Password Baru; toggle show/hide password; disable submit hingga semua syarat terpenuhi dan konfirmasi cocok.
  - Password policy sama dengan Kelola User (6-20 char, uppercase, lowercase, tanda baca) — live checklist hijau real-time.
  - Setelah berhasil ganti → toast + **auto-logout paksa** (redirect ke login) supaya user login ulang dengan password baru.
- **Akses**: klik avatar/nama di footer sidebar untuk buka `/profile` (tombol jadi navigable NavLink).
- **Backend**: `authApi.changeOwnPassword(current, next)` di `/app/frontend/src/lib/store.js` — verifikasi password lama, tolak jika sama dengan baru, update dengan timestamp `password_changed_at`.
- Verifikasi Playwright: (1) kasir login → klik avatar → /profile, (2) input password baru "GoodPass!23" → 4/4 aturan hijau, (3) submit dengan password lama benar → auto-logout, (4) login kembali dengan password baru → sukses, (5) submit disabled saat password baru tidak memenuhi aturan.

## Implemented (2026-02) — Iteration 11 (Menu Pelanggan Teknisi + Password Policy)
- **Menu Pelanggan untuk Teknisi**: Route `/customers` dan sidebar link "Pelanggan" sekarang bisa diakses role `technician` (selain `admin` dan `cashier`). Teknisi kini bisa lihat data pelanggan tanpa harus buka repair detail.
- **Password Policy di Kelola User**: `/app/frontend/src/pages/Users.jsx` sekarang enforce aturan berikut saat buat user baru / ganti password:
  - Panjang **6 – 20 karakter**
  - Wajib ada **huruf besar** (A-Z)
  - Wajib ada **huruf kecil** (a-z)
  - Wajib ada **tanda baca** (non-alphanumeric, mis. `! @ # . ?`)
- **UX**: Live checklist di bawah field password dengan ceklis hijau real-time saat mengetik. Toast error saat submit dengan detail aturan yang belum terpenuhi. Edit user tetap boleh kosongkan password (tidak diubah).
- Verifikasi: Teknisi login → Pelanggan tampil di sidebar → klik → `/customers` load. Modal user password: `abc` gagal (3/4 aturan), `GoodPass!23` lolos semua.

## Implemented (2026-02) — Iteration 10 (Fix: Ulasan Cross-Device Muncul di Admin)
- **User bug FIXED**: "setelah pelanggan memberikan ulasan tidak terupdate di ulasan pelanggan". Root cause: ulasan yang di-submit dari device pelanggan (via `/api/public-sync/{ticket}/rating`) hanya masuk ke Mongo — admin `/reviews` baca localStorage saja.
- **Endpoint baru**:
  - `GET /api/public-sync/reviews` — list semua tiket yang punya rating (source of truth cross-device).
  - `POST /api/public-sync/{ticket_no}/reply` — admin balasan cross-device (kalau tiket tidak ada di localStorage admin). Body kosong = hapus balasan.
- **`/app/frontend/src/lib/publicSync.js`**: `fetchAllReviews`, `submitAdminReplyServer`.
- **`Reviews.jsx`**: fetch server tiap 8 detik + on-focus + tombol manual "Muat ulang". Merge: server otoritatif untuk rating/review/admin_reply, di-overlay ke local repairs per ticket_no. Review yang HANYA ada di server tetap tampil (dengan data customer dari server snapshot).
- **Reply admin sekarang double-write**: local (best-effort, skip kalau tiket tidak lokal) + server (selalu) → balasan langsung muncul di halaman publik pelanggan dan di sesi admin lain.
- **Testing agent verifikasi**: 18/18 backend pytest + full frontend E2E (cross-device propagation, admin reply cross-device, RBAC, LUNAS/rating gate regression) — `iteration_8.json`.

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

