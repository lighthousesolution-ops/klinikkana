<?php
/**
 * Aplikasi Servis HP - Klinik Kana
 * Application configuration.
 * Edit values di bawah sesuai kredensial hosting Anda.
 */

// Database (MySQL) config -----------------------------------------------------
define('DB_HOST', 'localhost');
define('DB_NAME', 'kliniikkana');   // Nama database di cPanel
define('DB_USER', 'root');          // Username database
define('DB_PASS', '');              // Password database
define('DB_CHARSET', 'utf8mb4');

// JWT secret -- WAJIB diganti dengan string acak yang panjang saat production!
define('JWT_SECRET', 'GANTI_DENGAN_STRING_PANJANG_ACAK_MINIMAL_32_KARAKTER_ASDF1234');
define('JWT_TTL_SECONDS', 60 * 60 * 8); // 8 jam

// CORS - domain frontend yang diizinkan. '*' untuk semua (development only).
define('CORS_ALLOWED_ORIGIN', '*');

// Timezone
date_default_timezone_set('Asia/Jakarta');
