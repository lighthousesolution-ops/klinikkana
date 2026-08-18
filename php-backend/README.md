# Aplikasi Servis HP — Klinik Kana

Manajemen bengkel servis handphone dengan React + Tailwind (frontend) dan PHP + MySQL (backend siap-cPanel).

## Struktur Paket

```
/app
├── frontend/           React app (jalan di preview Emergent)
└── php-backend/        Source PHP + MySQL siap upload ke hosting
    ├── config/         Konfigurasi database & JWT
    ├── includes/       Helper (JWT, auth middleware, response)
    ├── api/            REST endpoints
    │   ├── auth/       login.php, me.php
    │   ├── customers/  index.php
    │   ├── spareparts/ index.php
    │   ├── users/      index.php
    │   ├── repairs/    index.php, parts.php
    │   └── dashboard/  stats.php
    ├── database.sql    Schema + seed data
    ├── install.php     One-time installer (hash password)
    └── .htaccess
```

## Login Demo (Frontend)

| Role     | Username  | Password    |
|----------|-----------|-------------|
| Admin    | admin     | admin123    |
| Teknisi  | teknisi   | teknisi123  |
| Kasir    | kasir     | kasir123    |

## Cara Deploy ke Hosting cPanel

### 1. Siapkan Database
1. Login ke cPanel → **MySQL Databases**.
2. Buat database baru (mis. `kliniikkana`) dan user yang punya akses penuh.
3. Buka **phpMyAdmin**, pilih database itu, tab **Import**, upload `database.sql`.

### 2. Upload Backend PHP
1. Zip folder `php-backend/`, upload ke `public_html/servishp/` (atau nama lain).
2. Edit `config/config.php`:
   - `DB_NAME`, `DB_USER`, `DB_PASS` sesuai kredensial cPanel.
   - `JWT_SECRET` ganti dengan string acak panjang (minimal 32 char).
   - `CORS_ALLOWED_ORIGIN` ganti dengan domain frontend Anda (mis. `https://klinikana.com`).
3. Buka `https://yourdomain.com/servishp/install.php` **sekali** untuk generate hash bcrypt password default.
4. **HAPUS** `install.php` setelah selesai.

### 3. Build & Upload Frontend
```bash
cd frontend
# Edit .env: REACT_APP_BACKEND_URL=https://yourdomain.com/servishp
yarn build
# Upload folder frontend/build/ ke public_html/
```

Atau frontend bisa dijadikan file statis di subdomain / static hosting terpisah.

### 4. Sambungkan Frontend ke Backend PHP
Frontend saat ini menggunakan localStorage (mock) untuk demo cepat. Untuk connect ke PHP, override fungsi API di `frontend/src/lib/store.js` menggunakan axios yang memanggil endpoint PHP. Contoh:

```js
// Ganti authApi.login menjadi:
login: async (username, password) => {
  const { data } = await axios.post(`${API}/api/auth/login.php`, { username, password });
  localStorage.setItem('kk_token', data.token);
  return data;
}
```

Tambahkan interceptor axios untuk kirim `Authorization: Bearer <token>` di setiap request.

## Endpoints Ringkas

| Method | Path                                                | Role         |
|--------|-----------------------------------------------------|--------------|
| POST   | /api/auth/login.php                                 | public       |
| GET    | /api/auth/me.php                                    | any          |
| GET/POST/PUT/DELETE | /api/customers/index.php[?id=]         | admin,cashier |
| GET/POST/PUT/DELETE | /api/spareparts/index.php[?id=]        | admin,technician |
| GET/POST/PUT/DELETE | /api/repairs/index.php[?id=]           | mixed        |
| POST/DELETE | /api/repairs/parts.php?id=REPAIR&part_id=PID    | admin,technician |
| GET/POST/PUT/DELETE | /api/users/index.php[?id=]             | admin only   |
| GET    | /api/dashboard/stats.php                            | any          |

## Fitur Utama

- 🔐 **Autentikasi & RBAC**: Admin, Teknisi, Kasir dengan restricted views
- 📊 **Dashboard**: KPI, grafik pendapatan 6-bulan, distribusi status pie chart
- 👤 **Pelanggan**: CRUD + search + riwayat servis per pelanggan
- 🛠 **Tiket Servis**: Alur status (Pending → In Progress → Ready → Picked Up), assign teknisi, catatan
- 📦 **Sparepart**: Stok, harga modal & jual, alert stok rendah, otomatis kurangi stok saat dipakai
- 📱 **WhatsApp**: Kirim invoice/status via `wa.me` deep-link (tanpa API berbayar)
- 📈 **Laporan**: Pendapatan vs biaya, estimasi laba, top pelanggan
- 🎨 **Design**: Swiss high-contrast, Manrope + IBM Plex Sans, fully responsive

## Notes

- Password default: bcrypt via PHP `password_hash()` (dilakukan oleh `install.php`).
- JWT HS256 disimpan di localStorage frontend (untuk simplicity). Untuk keamanan lebih baik, pindah ke HTTP-only cookie.
- Semua timestamps disimpan dalam timezone `Asia/Jakarta`.
