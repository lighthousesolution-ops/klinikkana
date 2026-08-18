<?php
/**
 * Settings API (single row store).
 * GET  /api/settings/index.php         -> current settings
 * PUT  /api/settings/index.php         -> merge patch
 */
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../config/database.php';

$method = $_SERVER['REQUEST_METHOD'];
$pdo = db();

function default_settings(): array {
    return [
        'shop_name'         => 'Klinik Kana',
        'shop_tagline'      => 'Servis HP Profesional',
        'shop_address'      => 'Jl. Contoh No. 123, Jakarta',
        'shop_phone'        => '021-1234567 / 0812-3456-7890',
        'logo_url'          => '',
        'invoice_footer'    => "Terima kasih atas kepercayaan Anda.\nGaransi servis 14 hari untuk sparepart yang diganti.",
        'wa_template'       => "Halo {customer_name},\n\nDari {shop_name}. Info servis Anda:\n\n• Tiket: {ticket_no}\n• Perangkat: {device}\n• Status: {status}\n• Total: {total}\n• DP: {deposit}\n• Sisa: {balance}\n\n{status_message}\n\nTerima kasih!",
        'wa_status_pending'     => 'Perangkat Anda telah kami terima dan sedang antre pemeriksaan.',
        'wa_status_in_progress' => 'Perangkat Anda sedang dalam proses perbaikan.',
        'wa_status_ready'       => 'Perangkat Anda sudah selesai dan siap diambil! Silakan datang ke toko kami.',
        'wa_status_picked_up'   => 'Perangkat Anda sudah diambil. Semoga puas dengan layanan kami!',
    ];
}

function load_settings(PDO $pdo): array {
    $row = $pdo->query('SELECT data FROM app_settings WHERE id=1')->fetch();
    if (!$row) return default_settings();
    $stored = json_decode($row['data'], true) ?: [];
    return array_merge(default_settings(), $stored);
}

function save_settings(PDO $pdo, array $data): void {
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $stmt = $pdo->prepare('INSERT INTO app_settings (id, data) VALUES (1, ?)
                           ON DUPLICATE KEY UPDATE data = VALUES(data)');
    $stmt->execute([$json]);
}

switch ($method) {
    case 'GET': {
        auth_user();
        json_response(load_settings($pdo));
    }
    case 'PUT': {
        require_role(['admin']);
        $patch = json_body();
        $current = load_settings($pdo);
        $merged = array_merge($current, $patch);
        save_settings($pdo, $merged);
        json_response($merged);
    }
    default: json_error('Method not allowed', 405);
}
