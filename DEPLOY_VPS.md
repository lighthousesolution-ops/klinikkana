# 🚀 Panduan Install ke VPS Sendiri (Apache + MySQL + PHP)

Panduan ini untuk pasang Aplikasi Servis HP Klinik Kana ke VPS Anda (Ubuntu/Debian/CentOS dengan LAMP stack). Estimasi waktu: **15–30 menit**.

---

## 📋 Prasyarat di VPS

- Apache 2.4+ (dengan `mod_rewrite` aktif)
- PHP 7.4+ (dengan ekstensi `pdo_mysql`, `mbstring`, `json`)
- MySQL 5.7+ atau MariaDB 10.3+
- SSH access (`root` atau user dengan sudo)
- Domain / subdomain yang sudah pointing ke IP VPS (opsional tapi disarankan untuk SSL)

Cek prasyarat:
```bash
apache2 -v && php -v && mysql --version
sudo a2enmod rewrite && sudo systemctl restart apache2
```

---

## 🗂️ Struktur yang akan dipasang

Rencananya kita pasang **dua bagian di satu domain**:

```
https://servis.domain-anda.com/          → React frontend (build production)
https://servis.domain-anda.com/api/      → PHP backend (REST API)
```

Atau kalau mau **dua subdomain** (frontend & api terpisah), lihat bagian "Alternatif" di bawah.

---

## STEP 1 — Build frontend React ke file statis

Di **komputer lokal** Anda (atau langsung di VPS kalau sudah ada Node.js):

```bash
# 1. Clone / download source code
cd frontend/

# 2. Set backend URL production
# Edit file .env dan ganti REACT_APP_BACKEND_URL ke domain VPS Anda:
echo "REACT_APP_BACKEND_URL=https://servis.domain-anda.com" > .env
echo "REACT_APP_DATA_MODE=php" >> .env   # <-- WAJIB: pakai PHP backend, bukan localStorage

# 3. Install & build
yarn install
yarn build
```

Hasilnya ada di folder `frontend/build/`. Isi folder ini yang nanti kita upload.

---

## STEP 2 — Siapkan MySQL Database

Login ke MySQL sebagai root:

```bash
sudo mysql -u root -p
```

Jalankan:

```sql
CREATE DATABASE klinikkana CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'kliniuser'@'localhost' IDENTIFIED BY 'PasswordKuat!2026';
GRANT ALL PRIVILEGES ON klinikkana.* TO 'kliniuser'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Import schema:

```bash
cd php-backend/
mysql -u kliniuser -p klinikkana < database.sql
```

---

## STEP 3 — Upload file ke VPS

Buat direktori web root (contoh: `/var/www/klinikkana`):

```bash
sudo mkdir -p /var/www/klinikkana
sudo chown $USER:www-data /var/www/klinikkana
```

Upload via `scp` / `rsync` / SFTP:

```bash
# React build
rsync -avz frontend/build/ user@vps:/var/www/klinikkana/

# PHP backend → letakkan di subfolder /api
rsync -avz php-backend/ user@vps:/var/www/klinikkana/api/
```

Struktur akhir:
```
/var/www/klinikkana/
├── index.html              (React build)
├── static/                 (React JS/CSS)
├── .htaccess               (React SPA rewrite — buat di STEP 5)
└── api/                    (PHP backend)
    ├── .htaccess
    ├── config/
    ├── includes/
    ├── api/
    ├── database.sql
    └── install.php
```

---

## STEP 4 — Konfigurasi PHP Backend

Edit `/var/www/klinikkana/api/config/config.php`:

```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'klinikkana');
define('DB_USER', 'kliniuser');
define('DB_PASS', 'PasswordKuat!2026');
define('DB_CHARSET', 'utf8mb4');

// GANTI dengan string acak minimal 32 karakter!
define('JWT_SECRET', 'ganti_dengan_random_hex_super_panjang_disini_jangan_default');

define('JWT_TTL_SECONDS', 60 * 60 * 8);

// Kalau frontend & api sudah 1 domain, boleh spesifik:
define('CORS_ALLOWED_ORIGIN', 'https://servis.domain-anda.com');
// atau '*' kalau mau simple, tapi kurang secure di production
```

Generate JWT secret acak:
```bash
openssl rand -hex 32
# → contoh: 8f4a...9b2c (copy paste ke config.php)
```

Jalankan installer sekali (untuk hash password bcrypt):
```
https://servis.domain-anda.com/api/install.php
```
Setelah tampil "Installation complete", **HAPUS `install.php`** dari server:
```bash
rm /var/www/klinikkana/api/install.php
```

---

## STEP 5 — Buat .htaccess untuk React SPA

Buat file `/var/www/klinikkana/.htaccess` dengan isi dari **`frontend-htaccess-for-vps.txt`** (ada di root repo). Ringkasnya:

```apache
Options -MultiViews
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]
RewriteRule ^ index.html [L]
```

Ini WAJIB — biar route SPA seperti `/status/KK-2501-001`, `/dashboard`, `/reviews` tetap bekerja saat di-refresh.

---

## STEP 6 — Konfigurasi Apache VirtualHost

Buat `/etc/apache2/sites-available/klinikkana.conf`:

```apache
<VirtualHost *:80>
    ServerName servis.domain-anda.com
    DocumentRoot /var/www/klinikkana

    <Directory /var/www/klinikkana>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog ${APACHE_LOG_DIR}/klinikkana-error.log
    CustomLog ${APACHE_LOG_DIR}/klinikkana-access.log combined
</VirtualHost>
```

Aktifkan:
```bash
sudo a2ensite klinikkana
sudo systemctl reload apache2
```

---

## STEP 7 — Set Permission

```bash
sudo chown -R www-data:www-data /var/www/klinikkana
sudo find /var/www/klinikkana -type d -exec chmod 755 {} \;
sudo find /var/www/klinikkana -type f -exec chmod 644 {} \;
# Lindungi config.php dari dibaca publik
sudo chmod 640 /var/www/klinikkana/api/config/config.php
```

---

## STEP 8 — Pasang SSL (HTTPS) dengan Let's Encrypt

```bash
sudo apt install certbot python3-certbot-apache
sudo certbot --apache -d servis.domain-anda.com
```

Ikuti prompt. Sertifikat auto-renew otomatis. Setelah selesai, akses:
```
https://servis.domain-anda.com
```

---

## ✅ Cek instalasi berhasil

1. Buka `https://servis.domain-anda.com/` → seharusnya tampil halaman login Klinik Kana.
2. Login `admin` / `admin123` → masuk ke dashboard.
3. Test cek status publik: `https://servis.domain-anda.com/status/KK-2501-001`.
4. Test API langsung:
   ```bash
   curl https://servis.domain-anda.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"admin123"}'
   ```
   Harus dapat response `{ "token": "eyJhbG...", "user": {...} }`.

---

## 🔧 Update / redeploy setelah ada perubahan

```bash
# Di lokal
cd frontend/
yarn build
rsync -avz --delete build/ user@vps:/var/www/klinikkana/

# Kalau ada perubahan skema DB
mysql -u kliniuser -p klinikkana < php-backend/database.sql
```

---

## 🌐 Alternatif: Frontend & API di subdomain terpisah

Kalau mau `app.domain.com` (frontend) dan `api.domain.com` (PHP):

1. Buat 2 VirtualHost terpisah, masing-masing DocumentRoot berbeda.
2. Set di `frontend/.env`: `REACT_APP_BACKEND_URL=https://api.domain.com`
3. Set di `api/config/config.php`: `CORS_ALLOWED_ORIGIN = 'https://app.domain.com'`

---

## 🐛 Troubleshooting umum

| Masalah | Solusi |
|---------|--------|
| Login gagal "Invalid credentials" walaupun password benar | Belum jalankan `install.php` untuk hash password |
| Refresh halaman /dashboard → 404 | `.htaccess` React SPA belum dipasang atau `AllowOverride All` belum aktif |
| API CORS error di browser console | Set `CORS_ALLOWED_ORIGIN` di `config.php` ke domain frontend |
| 500 error saat panggil API | Cek `/var/log/apache2/klinikkana-error.log`, biasanya DB connection |
| QR scan public status tampil kosong | Set `REACT_APP_DATA_MODE=php` sebelum `yarn build` |
| Halaman putih blank | Cek console browser (F12), biasanya `REACT_APP_BACKEND_URL` salah |

---

## 📞 Dukungan

Aplikasi juga tetap bisa diakses via preview & production Emergent — self-host ini opsional kalau Anda ingin data 100% di server sendiri.
