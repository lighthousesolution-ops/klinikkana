-- =====================================================================
-- Aplikasi Servis HP - Klinik Kana
-- MySQL Schema + Seed Data — STRING IDs (v2)
-- =====================================================================
-- Buat database dulu di cPanel/phpMyAdmin lalu import file ini.
-- Default charset: utf8mb4 untuk full unicode support.
--
-- CATATAN PENTING:
-- Semua kolom `id` sekarang VARCHAR(64) supaya cocok dengan id yang
-- di-generate frontend (uid('c') -> 'c_l9xa..'). Ini menghilangkan
-- masalah "MySQL tidak berubah" karena PHP endpoint kini menerima
-- id apa adanya tanpa cast (int).
-- =====================================================================

SET FOREIGN_KEY_CHECKS=0;

DROP TABLE IF EXISTS `payments`;
DROP TABLE IF EXISTS `repair_parts`;
DROP TABLE IF EXISTS `repairs`;
DROP TABLE IF EXISTS `spareparts`;
DROP TABLE IF EXISTS `customers`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `branches`;
DROP TABLE IF EXISTS `app_settings`;

-- Branches (cabang toko)
CREATE TABLE `branches` (
  `id` VARCHAR(64) NOT NULL,
  `code` VARCHAR(30) NOT NULL UNIQUE,
  `name` VARCHAR(120) NOT NULL,
  `address` TEXT DEFAULT NULL,
  `phone` VARCHAR(30) DEFAULT NULL,
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Users
CREATE TABLE `users` (
  `id` VARCHAR(64) NOT NULL,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(120) NOT NULL,
  `role` ENUM('admin','technician','cashier') NOT NULL DEFAULT 'cashier',
  `phone` VARCHAR(30) DEFAULT NULL,
  `branch_id` VARCHAR(64) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_user_branch` (`branch_id`),
  CONSTRAINT `fk_user_branch`
    FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Customers (global, tidak per cabang; unique phone)
CREATE TABLE `customers` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `phone` VARCHAR(30) NOT NULL,
  `address` TEXT,
  `notes` VARCHAR(255) DEFAULT NULL,
  `branch_id` VARCHAR(64) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_phone` (`phone`),
  INDEX `idx_phone` (`phone`),
  INDEX `idx_customer_branch` (`branch_id`),
  CONSTRAINT `fk_customer_branch`
    FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Spare Parts
CREATE TABLE `spareparts` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `sku` VARCHAR(50) NOT NULL UNIQUE,
  `category` VARCHAR(50) DEFAULT 'Lainnya',
  `stock` INT NOT NULL DEFAULT 0,
  `cost_price` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `selling_price` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `low_stock_threshold` INT NOT NULL DEFAULT 3,
  `branch_id` VARCHAR(64) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_sparepart_branch` (`branch_id`),
  CONSTRAINT `fk_sparepart_branch`
    FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Repairs (Servis)
CREATE TABLE `repairs` (
  `id` VARCHAR(64) NOT NULL,
  `ticket_no` VARCHAR(30) NOT NULL UNIQUE,
  `customer_id` VARCHAR(64) NOT NULL,
  `device_brand` VARCHAR(60) NOT NULL,
  `device_model` VARCHAR(120) NOT NULL,
  `serial_no` VARCHAR(80) DEFAULT NULL,
  `complaint` TEXT NOT NULL,
  `notes` TEXT,
  `status` ENUM('pending','in_progress','ready','picked_up') NOT NULL DEFAULT 'pending',
  `technician_id` VARCHAR(64) DEFAULT NULL,
  `service_fee` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `deposit` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `branch_id` VARCHAR(64) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `completed_at` DATETIME DEFAULT NULL,
  `picked_up_at` DATETIME DEFAULT NULL,
  `rating` TINYINT UNSIGNED DEFAULT NULL,
  `review` TEXT DEFAULT NULL,
  `rated_at` DATETIME DEFAULT NULL,
  `admin_reply` TEXT DEFAULT NULL,
  `admin_reply_by` VARCHAR(64) DEFAULT NULL,
  `admin_reply_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_customer` (`customer_id`),
  INDEX `idx_rating` (`rating`),
  INDEX `idx_repair_branch` (`branch_id`),
  INDEX `idx_repair_technician` (`technician_id`),
  INDEX `idx_repair_reply_by` (`admin_reply_by`),
  CONSTRAINT `fk_repair_customer`
    FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_repair_technician`
    FOREIGN KEY (`technician_id`) REFERENCES `users`(`id`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_repair_branch`
    FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_repair_reply_by`
    FOREIGN KEY (`admin_reply_by`) REFERENCES `users`(`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Repair parts used
CREATE TABLE `repair_parts` (
  `id` VARCHAR(64) NOT NULL,
  `repair_id` VARCHAR(64) NOT NULL,
  `sparepart_id` VARCHAR(64) NOT NULL,
  `qty` INT NOT NULL DEFAULT 1,
  `price` DECIMAL(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX `idx_repair` (`repair_id`),
  INDEX `idx_repair_part` (`repair_id`, `sparepart_id`),
  INDEX `idx_rp_sparepart` (`sparepart_id`),
  CONSTRAINT `fk_rp_repair`
    FOREIGN KEY (`repair_id`) REFERENCES `repairs`(`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_rp_sparepart`
    FOREIGN KEY (`sparepart_id`) REFERENCES `spareparts`(`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Payments per repair
CREATE TABLE `payments` (
  `id` VARCHAR(64) NOT NULL,
  `repair_id` VARCHAR(64) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `method` VARCHAR(30) NOT NULL DEFAULT 'Tunai',
  `note` VARCHAR(255) DEFAULT NULL,
  `paid_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_pay_repair` (`repair_id`),
  CONSTRAINT `fk_pay_repair`
    FOREIGN KEY (`repair_id`) REFERENCES `repairs`(`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Application settings (single row: id=1, JSON blob)
CREATE TABLE `app_settings` (
  `id` INT UNSIGNED NOT NULL DEFAULT 1,
  `data` LONGTEXT NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS=1;

-- =====================================================================
-- SEED DATA — id string cocok dengan mockData.js frontend
-- =====================================================================
-- Password hash placeholder — jalankan install.php SETELAH import untuk
-- generate bcrypt asli dari password default (admin123 / teknisi123 / kasir123).

INSERT INTO `branches` (`id`,`code`,`name`,`address`,`phone`,`is_default`) VALUES
('br_main', 'MAIN', 'Cabang Utama', 'Jl. Contoh No. 123, Jakarta', '021-1234567', 1);

INSERT INTO `users` (`id`,`username`,`password_hash`,`full_name`,`role`,`phone`) VALUES
('u1', 'admin',    '$2y$10$1zjumd/YoFHzsGp413biBuY28F917f1zGMC/v3GmyF0ttwiuxQV/q', 'Andi Wijaya',    'admin',      '081234567890'),
('u2', 'teknisi',  '$2y$10$1zjumd/YoFHzsGp413biBuY28F917f1zGMC/v3GmyF0ttwiuxQV/q', 'Budi Santoso',   'technician', '081298765432'),
('u3', 'kasir',    '$2y$10$1zjumd/YoFHzsGp413biBuY28F917f1zGMC/v3GmyF0ttwiuxQV/q', 'Citra Lestari',  'cashier',    '081345678901'),
('u4', 'teknisi2', '$2y$10$1zjumd/YoFHzsGp413biBuY28F917f1zGMC/v3GmyF0ttwiuxQV/q', 'Dedi Kurniawan', 'technician', '081456789012');

INSERT INTO `customers` (`id`,`name`,`phone`,`address`,`notes`) VALUES
('c1', 'Rina Marlina',   '081211112222', 'Jl. Merdeka No. 12, Jakarta',        'Pelanggan tetap'),
('c2', 'Fajar Nugroho',  '081233334444', 'Jl. Sudirman No. 45, Bandung',       ''),
('c3', 'Siti Aminah',    '081255556666', 'Jl. Diponegoro No. 8, Surabaya',     'Karyawan kantor'),
('c4', 'Hendra Wirawan', '081277778888', 'Jl. Gatot Subroto No. 22, Semarang', ''),
('c5', 'Maya Sari',      '081299990000', 'Jl. Ahmad Yani No. 5, Yogyakarta',   'Rekomendasi teman');

INSERT INTO `spareparts` (`id`,`name`,`sku`,`category`,`stock`,`cost_price`,`selling_price`,`low_stock_threshold`) VALUES
('sp1','LCD iPhone 11',                'LCD-IP11',   'Layar',     8,  750000, 1150000, 3),
('sp2','LCD Samsung A50',              'LCD-SA50',   'Layar',     2,  450000,  750000, 3),
('sp3','Baterai iPhone 8',             'BAT-IP8',    'Baterai',   15, 120000,  250000, 5),
('sp4','Baterai Xiaomi Redmi 9',       'BAT-RM9',    'Baterai',   12, 100000,  200000, 5),
('sp5','Konektor Charger Type-C',      'KON-TYPEC',  'Konektor',  25,  25000,   75000, 10),
('sp6','Speaker Oppo A5s',             'SPK-OA5S',   'Speaker',   1,   45000,  120000, 3),
('sp7','Tempered Glass Universal 6.5', 'TG-65',      'Aksesoris', 40,   8000,   35000, 15),
('sp8','Kabel Fleksibel Power iPhone X','FLX-IPX',   'Fleksibel', 4,   60000,  175000, 3);

INSERT INTO `repairs`
(`id`,`ticket_no`,`customer_id`,`device_brand`,`device_model`,`serial_no`,`complaint`,`notes`,`status`,`technician_id`,`service_fee`,`deposit`,`created_at`,`completed_at`,`picked_up_at`) VALUES
('r1','KK-2501-001','c1','iPhone', 'iPhone 11', 'IMEI:353821101234567', 'Layar retak, touchscreen tidak respons di sisi kanan',    'LCD sudah diganti, semua fungsi normal.', 'picked_up',   'u2', 250000, 300000, DATE_SUB(NOW(), INTERVAL 28 DAY), DATE_SUB(NOW(), INTERVAL 25 DAY), DATE_SUB(NOW(), INTERVAL 24 DAY)),
('r2','KK-2501-002','c2','Samsung','Galaxy A50','IMEI:354123459876543', 'Baterai boros, HP cepat panas',                            'Ganti baterai. Selesai.',                 'picked_up',   'u2', 150000, 100000, DATE_SUB(NOW(), INTERVAL 20 DAY), DATE_SUB(NOW(), INTERVAL 18 DAY), DATE_SUB(NOW(), INTERVAL 17 DAY)),
('r3','KK-2501-003','c3','Xiaomi', 'Redmi 9',   'IMEI:867543219871234', 'Tidak bisa nyala, sudah dicoba charging',                  'IC power diganti, sekarang normal.',      'ready',       'u4', 200000,  50000, DATE_SUB(NOW(), INTERVAL 5 DAY),  DATE_SUB(NOW(), INTERVAL 2 DAY),  NULL),
('r4','KK-2501-004','c4','Oppo',   'Oppo A5s',  'IMEI:355987651234876', 'Speaker pecah, suara serak saat volume tinggi',            'Menunggu speaker sampai.',                'in_progress', 'u2', 100000,  75000, DATE_SUB(NOW(), INTERVAL 3 DAY),  NULL, NULL),
('r5','KK-2501-005','c5','iPhone', 'iPhone 8',  'IMEI:359876541230123', 'Baterai kembung, casing belakang mulai terangkat',         '',                                        'in_progress', 'u4', 150000, 100000, DATE_SUB(NOW(), INTERVAL 2 DAY),  NULL, NULL),
('r6','KK-2501-006','c1','Samsung','Galaxy A50','IMEI:354123459876544', 'Layar kedip-kedip, garis vertikal',                        '',                                        'pending',     NULL, 150000, 200000, NOW(), NULL, NULL);

INSERT INTO `repair_parts` (`id`,`repair_id`,`sparepart_id`,`qty`,`price`) VALUES
('rp1', 'r1', 'sp1', 1, 1150000),
('rp2', 'r3', 'sp4', 1,  200000),
('rp3', 'r4', 'sp6', 1,  120000),
('rp4', 'r5', 'sp3', 1,  250000);
