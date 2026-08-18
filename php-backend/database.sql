-- =====================================================================
-- Aplikasi Servis HP - Klinik Kana
-- MySQL Schema + Seed Data
-- =====================================================================
-- Buat database dulu di cPanel/phpMyAdmin lalu import file ini.
-- Default charset: utf8mb4 untuk full unicode support.
-- =====================================================================

SET FOREIGN_KEY_CHECKS=0;

-- Users
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(120) NOT NULL,
  `role` ENUM('admin','technician','cashier') NOT NULL DEFAULT 'cashier',
  `phone` VARCHAR(30) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Customers
CREATE TABLE IF NOT EXISTS `customers` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  `phone` VARCHAR(30) NOT NULL,
  `address` TEXT,
  `notes` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Spare Parts
CREATE TABLE IF NOT EXISTS `spareparts` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `sku` VARCHAR(50) NOT NULL UNIQUE,
  `category` VARCHAR(50) DEFAULT 'Lainnya',
  `stock` INT NOT NULL DEFAULT 0,
  `cost_price` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `selling_price` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `low_stock_threshold` INT NOT NULL DEFAULT 3,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Repairs (Servis)
CREATE TABLE IF NOT EXISTS `repairs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ticket_no` VARCHAR(30) NOT NULL UNIQUE,
  `customer_id` INT UNSIGNED NOT NULL,
  `device_brand` VARCHAR(60) NOT NULL,
  `device_model` VARCHAR(120) NOT NULL,
  `serial_no` VARCHAR(80) DEFAULT NULL,
  `complaint` TEXT NOT NULL,
  `notes` TEXT,
  `status` ENUM('pending','in_progress','ready','picked_up') NOT NULL DEFAULT 'pending',
  `technician_id` INT UNSIGNED DEFAULT NULL,
  `service_fee` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `deposit` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `completed_at` DATETIME DEFAULT NULL,
  `picked_up_at` DATETIME DEFAULT NULL,
  `rating` TINYINT UNSIGNED DEFAULT NULL,
  `review` TEXT DEFAULT NULL,
  `rated_at` DATETIME DEFAULT NULL,
  `admin_reply` TEXT DEFAULT NULL,
  `admin_reply_by` INT UNSIGNED DEFAULT NULL,
  `admin_reply_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_customer` (`customer_id`),
  INDEX `idx_rating` (`rating`),
  CONSTRAINT `fk_repair_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_repair_technician` FOREIGN KEY (`technician_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_repair_reply_user` FOREIGN KEY (`admin_reply_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Repair parts used (many-to-many with qty)
CREATE TABLE IF NOT EXISTS `repair_parts` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `repair_id` INT UNSIGNED NOT NULL,
  `sparepart_id` INT UNSIGNED NOT NULL,
  `qty` INT NOT NULL DEFAULT 1,
  `price` DECIMAL(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX `idx_repair` (`repair_id`),
  CONSTRAINT `fk_rp_repair` FOREIGN KEY (`repair_id`) REFERENCES `repairs`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rp_part` FOREIGN KEY (`sparepart_id`) REFERENCES `spareparts`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Payments per repair
CREATE TABLE IF NOT EXISTS `payments` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `repair_id` INT UNSIGNED NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `method` VARCHAR(30) NOT NULL DEFAULT 'Tunai',
  `note` VARCHAR(255) DEFAULT NULL,
  `paid_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_pay_repair` (`repair_id`),
  CONSTRAINT `fk_pay_repair` FOREIGN KEY (`repair_id`) REFERENCES `repairs`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Application settings (single row: id=1, JSON blob)
CREATE TABLE IF NOT EXISTS `app_settings` (
  `id` INT UNSIGNED NOT NULL DEFAULT 1,
  `data` LONGTEXT NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS=1;

-- =====================================================================
-- SEED DATA
-- =====================================================================
-- Password hash generated with password_hash('admin123', PASSWORD_BCRYPT) etc.
-- Default passwords: admin123, teknisi123, kasir123

INSERT INTO `users` (`username`,`password_hash`,`full_name`,`role`,`phone`) VALUES
('admin',    '$2y$10$rZ7YXwq5vQ5Z3iF6.hK3s.tK5jV7wD9L2X3sQ1yN.mR8fZ0aB1cDe', 'Andi Wijaya',   'admin',      '081234567890'),
('teknisi',  '$2y$10$rZ7YXwq5vQ5Z3iF6.hK3s.tK5jV7wD9L2X3sQ1yN.mR8fZ0aB1cDe', 'Budi Santoso',  'technician', '081298765432'),
('kasir',    '$2y$10$rZ7YXwq5vQ5Z3iF6.hK3s.tK5jV7wD9L2X3sQ1yN.mR8fZ0aB1cDe', 'Citra Lestari', 'cashier',    '081345678901'),
('teknisi2', '$2y$10$rZ7YXwq5vQ5Z3iF6.hK3s.tK5jV7wD9L2X3sQ1yN.mR8fZ0aB1cDe', 'Dedi Kurniawan','technician', '081456789012');
-- NOTE: Password hashes above are placeholders. Setelah import, JALANKAN
-- script /install.php (yang ada di paket) untuk generate hash bcrypt asli
-- dari password default, atau ganti password via aplikasi.

INSERT INTO `customers` (`name`,`phone`,`address`,`notes`) VALUES
('Rina Marlina',   '081211112222', 'Jl. Merdeka No. 12, Jakarta',      'Pelanggan tetap'),
('Fajar Nugroho',  '081233334444', 'Jl. Sudirman No. 45, Bandung',     ''),
('Siti Aminah',    '081255556666', 'Jl. Diponegoro No. 8, Surabaya',   'Karyawan kantor'),
('Hendra Wirawan', '081277778888', 'Jl. Gatot Subroto No. 22, Semarang', ''),
('Maya Sari',      '081299990000', 'Jl. Ahmad Yani No. 5, Yogyakarta', 'Rekomendasi teman');

INSERT INTO `spareparts` (`name`,`sku`,`category`,`stock`,`cost_price`,`selling_price`,`low_stock_threshold`) VALUES
('LCD iPhone 11',                'LCD-IP11',   'Layar',     8,  750000, 1150000, 3),
('LCD Samsung A50',              'LCD-SA50',   'Layar',     2,  450000,  750000, 3),
('Baterai iPhone 8',             'BAT-IP8',    'Baterai',   15, 120000,  250000, 5),
('Baterai Xiaomi Redmi 9',       'BAT-RM9',    'Baterai',   12, 100000,  200000, 5),
('Konektor Charger Type-C',      'KON-TYPEC',  'Konektor',  25,  25000,   75000, 10),
('Speaker Oppo A5s',             'SPK-OA5S',   'Speaker',   1,   45000,  120000, 3),
('Tempered Glass Universal 6.5', 'TG-65',      'Aksesoris', 40,   8000,   35000, 15),
('Kabel Fleksibel Power iPhone X','FLX-IPX',   'Fleksibel', 4,   60000,  175000, 3);

INSERT INTO `repairs`
(`ticket_no`,`customer_id`,`device_brand`,`device_model`,`serial_no`,`complaint`,`notes`,`status`,`technician_id`,`service_fee`,`deposit`,`created_at`,`completed_at`,`picked_up_at`) VALUES
('KK-2501-001', 1, 'iPhone',  'iPhone 11', 'IMEI:353821101234567', 'Layar retak, touchscreen tidak respons di sisi kanan', 'LCD sudah diganti, semua fungsi normal.', 'picked_up', 2, 250000, 300000, DATE_SUB(NOW(), INTERVAL 28 DAY), DATE_SUB(NOW(), INTERVAL 25 DAY), DATE_SUB(NOW(), INTERVAL 24 DAY)),
('KK-2501-002', 2, 'Samsung', 'Galaxy A50', 'IMEI:354123459876543', 'Baterai boros, HP cepat panas',              'Ganti baterai. Selesai.',                'picked_up', 2, 150000, 100000, DATE_SUB(NOW(), INTERVAL 20 DAY), DATE_SUB(NOW(), INTERVAL 18 DAY), DATE_SUB(NOW(), INTERVAL 17 DAY)),
('KK-2501-003', 3, 'Xiaomi',  'Redmi 9',   'IMEI:867543219871234', 'Tidak bisa nyala, sudah dicoba charging',    'IC power diganti, sekarang normal.',      'ready',     4, 200000,  50000, DATE_SUB(NOW(), INTERVAL 5 DAY),  DATE_SUB(NOW(), INTERVAL 2 DAY),  NULL),
('KK-2501-004', 4, 'Oppo',    'Oppo A5s',  'IMEI:355987651234876', 'Speaker pecah, suara serak saat volume tinggi', 'Menunggu speaker sampai.',            'in_progress', 2, 100000, 75000, DATE_SUB(NOW(), INTERVAL 3 DAY),  NULL, NULL),
('KK-2501-005', 5, 'iPhone',  'iPhone 8',  'IMEI:359876541230123', 'Baterai kembung, casing belakang mulai terangkat', '',                                  'in_progress', 4, 150000, 100000, DATE_SUB(NOW(), INTERVAL 2 DAY),  NULL, NULL),
('KK-2501-006', 1, 'Samsung', 'Galaxy A50', 'IMEI:354123459876544', 'Layar kedip-kedip, garis vertikal',          '',                                        'pending',   NULL, 150000, 200000, NOW(), NULL, NULL);

INSERT INTO `repair_parts` (`repair_id`,`sparepart_id`,`qty`,`price`) VALUES
(1, 1, 1, 1150000),
(3, 4, 1,  200000),
(4, 6, 1,  120000),
(5, 3, 1,  250000);


-- ============================================================
-- Migration for existing installs (safe to re-run).
-- Adds rating & review columns to `repairs` if not present.
-- ============================================================
SET @db := DATABASE();
SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA=@db AND TABLE_NAME='repairs' AND COLUMN_NAME='rating');
SET @sql := IF(@col=0,
  'ALTER TABLE `repairs`
     ADD COLUMN `rating` TINYINT UNSIGNED DEFAULT NULL,
     ADD COLUMN `review` TEXT DEFAULT NULL,
     ADD COLUMN `rated_at` DATETIME DEFAULT NULL,
     ADD INDEX `idx_rating` (`rating`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col2 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
              WHERE TABLE_SCHEMA=@db AND TABLE_NAME='repairs' AND COLUMN_NAME='admin_reply');
SET @sql2 := IF(@col2=0,
  'ALTER TABLE `repairs`
     ADD COLUMN `admin_reply` TEXT DEFAULT NULL,
     ADD COLUMN `admin_reply_by` INT UNSIGNED DEFAULT NULL,
     ADD COLUMN `admin_reply_at` DATETIME DEFAULT NULL',
  'SELECT 1');
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;
