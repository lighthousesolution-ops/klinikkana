# 🔄 Panduan Redeploy Update ke VPS via GitHub

Panduan ini untuk **menerapkan update kode** (misalnya perbaikan PHP backend, patch frontend, dll.) ke VPS yang sudah pernah di-install pakai `DEPLOY_VPS.md`. Estimasi waktu: **3–5 menit**.

> Diasumsikan Anda sudah:
> - Punya akses SSH ke VPS
> - VPS sudah berjalan (Apache + MySQL + PHP) dari deploy pertama
> - Punya repo GitHub berisi kode aplikasi ini (via fitur **Save to GitHub** di Emergent)

---

## 🅰️ Bagian 1 — Push update dari Emergent ke GitHub

Setiap kali agent Emergent selesai memperbaiki bug atau menambah fitur:

1. Buka chat Emergent → klik tombol **"Save to GitHub"** di input bar
2. Pilih repo Anda (mis. `username/klinik-kana`) dan branch (`main`)
3. Emergent akan commit + push semua perubahan otomatis

Verifikasi di GitHub: cek commit terbaru muncul di tab **Commits**.

---

## 🅱️ Bagian 2 — Setup repo di VPS (SEKALI SAJA, skip kalau sudah)

Kalau ini pertama kali VPS Anda pakai `git`, siapkan dulu:

```bash
# SSH ke VPS
ssh root@IP_VPS_ANDA

# Install git kalau belum ada
sudo apt update && sudo apt install -y git

# Clone repo ke folder kerja (BUKAN ke /var/www langsung)
mkdir -p ~/apps && cd ~/apps
git clone https://github.com/USERNAME/klinik-kana.git
cd klinik-kana

# Kalau repo private, pakai Personal Access Token (PAT):
#   git clone https://USERNAME:GHP_xxxxx@github.com/USERNAME/klinik-kana.git
# PAT dibuat di GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
```

Untuk repo private, simpan credential supaya tidak perlu ketik ulang tiap `git pull`:
```bash
git config --global credential.helper store
# Lain kali `git pull` akan tanya user+PAT sekali, lalu disimpan
```

---

## 🅲️ Bagian 3 — Redeploy update (JALANKAN TIAP ADA UPDATE)

Ini alur yang akan Anda ulangi setiap ada update baru.

### ✅ Langkah 1 — Tarik update terbaru

```bash
ssh root@IP_VPS_ANDA
cd ~/apps/klinik-kana
git pull origin main
```

Contoh output yang wajar:
```
Fast-forward
 php-backend/api/repairs/index.php  | 24 ++++++++----
 php-backend/api/users/index.php    | 38 ++++++++++++-----
 php-backend/includes/response.php  | 30 +++++++++++++
 frontend/src/pages/Login.jsx       | 26 -----------
 4 files changed, 74 insertions(+), 44 deletions(-)
```

### ✅ Langkah 2 — Deploy PHP backend (kalau ada perubahan di `/php-backend/`)

Copy folder `php-backend` ke lokasi yang di-serve Apache (dari deploy pertama biasanya `/var/www/html/api` atau `/var/www/servis/api`):

```bash
# Sesuaikan path tujuan dengan setup DEPLOY_VPS.md Anda
DEST=/var/www/servis

# Backup dulu (aman kalau perlu rollback)
sudo cp -r $DEST/api $DEST/api.bak.$(date +%Y%m%d_%H%M%S)

# Copy source PHP baru (kecuali config yang sudah disesuaikan)
sudo rsync -av --delete \
  --exclude 'config/config.php' \
  --exclude 'config/database.php' \
  ~/apps/klinik-kana/php-backend/ $DEST/api/

# Set ownership ke user Apache
sudo chown -R www-data:www-data $DEST/api
sudo find $DEST/api -type d -exec chmod 755 {} \;
sudo find $DEST/api -type f -exec chmod 644 {} \;
```

> ⚠️ **Kenapa exclude `config/*.php`?** Karena di dalamnya ada kredensial MySQL + JWT secret Anda yang khas VPS ini. Kalau ikut ke-overwrite, aplikasi mati.

Kalau update kali ini **mengubah `config/config.php` atau `database.php`** (agent akan bilang di summary), buka file baru, lalu edit ulang dengan kredensial VPS Anda:
```bash
sudo nano $DEST/api/config/config.php
sudo nano $DEST/api/config/database.php
```

### ✅ Langkah 3 — Jalankan migration MySQL (kalau ada perubahan schema)

Cek di commit terakhir apakah `php-backend/database.sql` berubah:
```bash
cd ~/apps/klinik-kana
git log -1 --name-only | grep database.sql
```

Kalau ada, jalankan migrasi. **⚠️ HATI-HATI**: `database.sql` di repo berisi `CREATE TABLE` (bukan `ALTER`). Jangan langsung `mysql < database.sql` — itu akan menimpa data Anda!

Cara aman:
```bash
# 1. Backup DB dulu
mysqldump -u root -p klinik_kana > ~/backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Bandingkan schema lama vs baru
diff <(mysqldump -u root -p --no-data klinik_kana 2>/dev/null) \
     ~/apps/klinik-kana/php-backend/database.sql

# 3. Buat migration ALTER manual sesuai perbedaan, lalu jalankan:
mysql -u root -p klinik_kana -e "ALTER TABLE repairs ADD COLUMN admin_reply TEXT NULL;"
```

Untuk update ini (Iteration 13) **tidak ada perubahan schema** — skip langkah ini.

### ✅ Langkah 4 — Rebuild frontend React (kalau ada perubahan di `/frontend/`)

Frontend adalah SPA yang di-build jadi file statis. Setiap ada perubahan di `frontend/src/`, harus di-build ulang.

**Opsi A — Build di komputer lokal Anda** (rekomendasi kalau VPS RAM kecil):
```bash
# Di laptop Anda
git pull origin main
cd frontend
yarn install    # kalau package.json berubah
yarn build

# Upload folder build/ ke VPS via scp / rsync
rsync -av --delete build/ root@IP_VPS:/var/www/servis/public/
```

**Opsi B — Build langsung di VPS** (butuh Node.js 18+, RAM ≥ 2 GB):
```bash
# Di VPS
cd ~/apps/klinik-kana/frontend
yarn install
yarn build

# Copy hasil build ke docroot
sudo rsync -av --delete build/ /var/www/servis/public/
sudo chown -R www-data:www-data /var/www/servis/public
```

> ℹ️ Kalau `.env` frontend belum ada di VPS, buat dulu sebelum `yarn build`:
> ```bash
> cat > .env <<EOF
> REACT_APP_BACKEND_URL=https://servis.domain-anda.com
> REACT_APP_DATA_MODE=php
> EOF
> ```

### ✅ Langkah 5 — Reload Apache & bersihkan cache

```bash
sudo systemctl reload apache2
```

Buka browser di **incognito / private mode** dan hard-reload dengan `Ctrl+Shift+R` supaya cache lama tidak ganggu.

---

## 🧪 Bagian 4 — Verifikasi setelah redeploy

Test cepat via curl (dari komputer lokal Anda):

```bash
# 1. API alive?
curl https://servis.domain-anda.com/api/auth/login.php \
  -X POST -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
# Harus balas: {"token":"...","user":{...}}

# 2. Login via browser di https://servis.domain-anda.com/
#    - Login admin
#    - Edit 1 tiket servis (ubah catatan) → cek MySQL langsung:
mysql -u root -p klinik_kana -e "SELECT id, notes, updated_at FROM repairs ORDER BY updated_at DESC LIMIT 3;"
#    Nilai `notes` HARUS berubah sesuai edit tadi.

# 3. Test reply ulasan (kalau ada tiket yang sudah di-rating):
#    - Buka halaman /reviews
#    - Kirim balasan admin → refresh → balasan harus muncul (dulu 500)

# 4. Test ganti password teknisi (fix baru iterasi 13):
#    - Login sebagai teknisi
#    - Buka /profile → ganti password
#    - Logout → login pakai password baru → HARUS berhasil
```

Kalau ada langkah yang gagal, lihat log:
```bash
sudo tail -f /var/log/apache2/error.log
# atau kalau pakai virtualhost sendiri:
sudo tail -f /var/log/apache2/servis-error.log
```

---

## 🔁 Bagian 5 — Cheat sheet redeploy 1-liner

Setelah Anda familiar, seluruh alur bisa dipadatkan jadi script berikut. Simpan sebagai `~/redeploy.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO=~/apps/klinik-kana
DEST=/var/www/servis
DOMAIN=servis.domain-anda.com

echo "▶ 1/5  Pull latest from GitHub..."
cd "$REPO" && git pull --ff-only origin main

echo "▶ 2/5  Backup PHP API..."
sudo cp -r "$DEST/api" "$DEST/api.bak.$(date +%Y%m%d_%H%M%S)" || true

echo "▶ 3/5  Deploy PHP API (preserve local config)..."
sudo rsync -av --delete \
  --exclude 'config/config.php' \
  --exclude 'config/database.php' \
  "$REPO/php-backend/" "$DEST/api/"
sudo chown -R www-data:www-data "$DEST/api"

echo "▶ 4/5  Rebuild frontend..."
cd "$REPO/frontend"
yarn install --frozen-lockfile
yarn build
sudo rsync -av --delete build/ "$DEST/public/"
sudo chown -R www-data:www-data "$DEST/public"

echo "▶ 5/5  Reload Apache..."
sudo systemctl reload apache2

echo "✅ Done. Test at https://$DOMAIN"
```

Setelah itu tinggal:
```bash
chmod +x ~/redeploy.sh
~/redeploy.sh
```

---

## 🆘 Rollback cepat (kalau redeploy bikin error)

```bash
# Cari backup terakhir
ls -lt /var/www/servis/api.bak.* | head -3

# Restore
DEST=/var/www/servis
LATEST_BAK=$(ls -td $DEST/api.bak.* | head -1)
sudo rm -rf $DEST/api
sudo mv $LATEST_BAK $DEST/api
sudo systemctl reload apache2
```

Atau `git reset` di folder repo dulu, baru re-run `~/redeploy.sh` dari commit sebelumnya:
```bash
cd ~/apps/klinik-kana
git log --oneline -5           # lihat 5 commit terakhir
git reset --hard <commit-sha>  # kembali ke commit yang stabil
~/redeploy.sh
```

---

## 📝 Checklist khusus untuk update Iteration 13 ini

Update terbaru hanya menyentuh **PHP backend + halaman Login**. Alur singkatnya:

1. ✅ Emergent → Save to GitHub
2. ✅ SSH VPS → `cd ~/apps/klinik-kana && git pull`
3. ✅ Copy `php-backend/` ke `/var/www/servis/api/` (skip config)
4. ✅ Rebuild frontend (`yarn build`) → copy ke `/var/www/servis/public/`
5. ✅ `sudo systemctl reload apache2`
6. ✅ Test: edit 1 tiket → cek MySQL berubah, reply ulasan → tidak 500 lagi, teknisi ganti password → bisa login ulang

**Tidak perlu** migrasi MySQL karena tidak ada perubahan schema.
