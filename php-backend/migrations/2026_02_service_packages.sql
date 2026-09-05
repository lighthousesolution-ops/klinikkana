-- =====================================================================
-- MIGRATION: Preset Paket Jasa (Iteration 18)
-- Jalankan di database MySQL VPS Anda via SSH / phpMyAdmin.
-- Aman: hanya CREATE TABLE baru + seed INSERT.
-- =====================================================================

-- Tabel paket jasa (bundel service_items). items_json: JSON array of ids.
CREATE TABLE IF NOT EXISTS `service_packages` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `items_json` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed 3 paket populer (mengacu ke service_item id dari migrasi sebelumnya).
INSERT INTO `service_packages` (`id`,`name`,`description`,`items_json`) VALUES
('sp_pkt_full',   'Paket LCD + Baterai',   'Paket lengkap ganti layar + baterai',   '["si_lcd_ori","si_bat_std"]'),
('sp_pkt_charge', 'Paket Charging Bersih', 'Bersih port + ganti konektor jika perlu','["si_port_clean","si_port_std"]'),
('sp_pkt_soft',   'Paket Software Bersih', 'Flash ulang + unlock pola',              '["si_flash","si_unlock"]');
