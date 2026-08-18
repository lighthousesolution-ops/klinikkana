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

echo "\nSelesai. HAPUS file install.php ini dari server sekarang!\n";
