<?php
/**
 * ONE-TIME installer:
 *  - Verify DB connection.
 *  - Reset default user passwords (admin/teknisi/kasir/teknisi2) to plaintext
 *    values, generating proper bcrypt hashes.
 *
 * Usage: Buka https://yourdomain/servishp/install.php di browser SEKALI, lalu
 *        HAPUS file ini dari server untuk keamanan.
 */
require_once __DIR__ . '/config/database.php';
header('Content-Type: text/plain; charset=utf-8');

echo "=== Klinik Kana - Installer ===\n\n";

try {
    $pdo = db();
    echo "[OK] Koneksi database berhasil.\n";
} catch (Exception $e) {
    echo "[ERR] " . $e->getMessage() . "\n";
    exit;
}

$defaults = [
    'admin'    => 'admin123',
    'teknisi'  => 'teknisi123',
    'kasir'    => 'kasir123',
    'teknisi2' => 'teknisi123',
];

echo "\nReset password default:\n";
foreach ($defaults as $u => $p) {
    $hash = password_hash($p, PASSWORD_BCRYPT);
    $stmt = $pdo->prepare('UPDATE users SET password_hash=? WHERE username=?');
    $stmt->execute([$hash, $u]);
    echo "  - $u => $p ({$stmt->rowCount()} row)\n";
}

// Seed default settings if empty
echo "\nSeeding default settings...\n";
$exists = (int)$pdo->query('SELECT COUNT(*) FROM app_settings WHERE id=1')->fetchColumn();
if (!$exists) {
    $defaultSettings = [
        'shop_name' => 'Klinik Kana',
        'shop_tagline' => 'Servis HP Profesional',
        'shop_address' => 'Jl. Contoh No. 123, Jakarta',
        'shop_phone' => '021-1234567 / 0812-3456-7890',
        'logo_url' => '',
        'invoice_footer' => "Terima kasih atas kepercayaan Anda.\nGaransi servis 14 hari untuk sparepart yang diganti.",
        'wa_template' => "Halo {customer_name},\n\nDari {shop_name}. Info servis Anda:\n\n• Tiket: {ticket_no}\n• Perangkat: {device}\n• Status: {status}\n• Total: {total}\n• DP: {deposit}\n• Sisa: {balance}\n\n{status_message}\n\nTerima kasih!",
        'wa_status_pending'     => 'Perangkat Anda telah kami terima dan sedang antre pemeriksaan.',
        'wa_status_in_progress' => 'Perangkat Anda sedang dalam proses perbaikan.',
        'wa_status_ready'       => 'Perangkat Anda sudah selesai dan siap diambil! Silakan datang ke toko kami.',
        'wa_status_picked_up'   => 'Perangkat Anda sudah diambil. Semoga puas dengan layanan kami!',
    ];
    $stmt = $pdo->prepare('INSERT INTO app_settings (id, data) VALUES (1, ?)');
    $stmt->execute([json_encode($defaultSettings, JSON_UNESCAPED_UNICODE)]);
    echo "  - Default settings created.\n";
} else {
    echo "  - Settings already exist, skipped.\n";
}

echo "\nSelesai. HAPUS file install.php ini dari server sekarang!\n";
