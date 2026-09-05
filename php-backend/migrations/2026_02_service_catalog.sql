-- =====================================================================
-- MIGRATION: Skema Harga & Kategori Jasa Servis (Iteration 17)
-- Jalankan di database MySQL VPS Anda via SSH / phpMyAdmin.
-- Aman: hanya CREATE TABLE baru + ALTER TABLE (ADD COLUMN) untuk repairs.
-- =====================================================================

-- 1. Tabel kategori servis (global, tidak per cabang)
CREATE TABLE IF NOT EXISTS `service_categories` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `icon` VARCHAR(60) DEFAULT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Tabel jasa/layanan di bawah kategori
CREATE TABLE IF NOT EXISTS `service_items` (
  `id` VARCHAR(64) NOT NULL,
  `category_id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `default_price` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `duration_minutes` INT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_service_category` (`category_id`),
  CONSTRAINT `fk_service_category`
    FOREIGN KEY (`category_id`) REFERENCES `service_categories`(`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Kolom services_json di tabel repairs (menyimpan rincian jasa per tiket)
--    Gunakan ALTER TABLE ... ADD COLUMN IF NOT EXISTS jika MySQL 8+; jika
--    MySQL < 8, jalankan ALTER TABLE ... ADD COLUMN saja (skip kalau error kolom ada).
ALTER TABLE `repairs` ADD COLUMN `services_json` TEXT DEFAULT NULL;

-- 4. Seed data awal (7 kategori + 18 jasa preset)
INSERT INTO `service_categories` (`id`,`name`,`icon`,`sort_order`) VALUES
('sc_layar',     'Layar / LCD',        'monitor-smartphone', 1),
('sc_baterai',   'Baterai',            'battery-charging',    2),
('sc_charging',  'Port Charging',      'plug',                3),
('sc_ic',        'IC / Motherboard',   'cpu',                 4),
('sc_software',  'Software',           'smartphone',          5),
('sc_speaker',   'Speaker / Mic',      'volume-2',            6),
('sc_air',       'Kerusakan Air',      'droplets',            7);

INSERT INTO `service_items` (`id`,`category_id`,`name`,`default_price`,`duration_minutes`) VALUES
('si_lcd_ori',    'sc_layar',    'Ganti LCD Original',              850000, 60),
('si_lcd_copy',   'sc_layar',    'Ganti LCD Copy / Aftermarket',    450000, 60),
('si_tg',         'sc_layar',    'Pasang Tempered Glass',            50000, 15),
('si_bat_std',    'sc_baterai',  'Ganti Baterai Standar',           250000, 30),
('si_bat_high',   'sc_baterai',  'Ganti Baterai High Capacity',     400000, 45),
('si_port_std',   'sc_charging', 'Ganti Konektor Charger',          150000, 45),
('si_port_clean', 'sc_charging', 'Bersih Port Charger',              50000, 20),
('si_ic_power',   'sc_ic',       'Reball IC Power',                 350000, 180),
('si_ic_signal',  'sc_ic',       'Reball IC Sinyal',                400000, 180),
('si_ic_wifi',    'sc_ic',       'Reball IC WiFi',                  350000, 180),
('si_flash',      'sc_software', 'Flash Ulang / Reinstall OS',      150000, 90),
('si_bypass',     'sc_software', 'Bypass iCloud / FRP',             500000, 120),
('si_unlock',     'sc_software', 'Unlock Pola / Sandi',             100000, 45),
('si_speaker',    'sc_speaker',  'Ganti Speaker',                   120000, 45),
('si_mic',        'sc_speaker',  'Ganti Mikrofon',                  100000, 45),
('si_speaker_ear','sc_speaker',  'Ganti Earpiece / Speaker Telinga', 100000, 45),
('si_air_service','sc_air',      'Service Kena Air (Ultrasonic Cleaning)', 200000, 120),
('si_air_check',  'sc_air',      'Cek Kerusakan Akibat Air',         50000, 30);
