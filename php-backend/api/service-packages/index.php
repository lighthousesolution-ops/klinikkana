<?php
/**
 * Service Packages API — bundel jasa (mis. "Paket Ganti LCD + Baterai").
 * items_json TEXT menyimpan array of service_item_id (referensi ke katalog).
 *
 * GET    /api/service-packages/index.php          -> list
 * GET    /api/service-packages/index.php?id=X     -> single
 * POST   /api/service-packages/index.php          -> upsert
 * PUT    /api/service-packages/index.php?id=X     -> update
 * DELETE /api/service-packages/index.php?id=X     -> delete
 */
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../config/database.php';

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? null;

function decode_items(array &$pkg): void {
    if (isset($pkg['items_json']) && is_string($pkg['items_json']) && $pkg['items_json'] !== '') {
        $decoded = json_decode($pkg['items_json'], true);
        $pkg['items_json'] = is_array($decoded) ? $decoded : [];
    } else {
        $pkg['items_json'] = [];
    }
}

switch ($method) {
    case 'GET': {
        auth_user();
        if ($id) {
            $stmt = db()->prepare('SELECT id, name, description, items_json, created_at FROM service_packages WHERE id=?');
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            if (!$row) json_error('Paket tidak ditemukan', 404);
            decode_items($row);
            json_response($row);
        }
        $rows = db()->query('SELECT id, name, description, items_json, created_at FROM service_packages ORDER BY name ASC')->fetchAll();
        foreach ($rows as &$r) decode_items($r);
        json_response($rows);
    }
    case 'POST': {
        require_role(['admin']);
        $b   = json_body();
        $pid = $b['id'] ?? null;
        if (!$pid) json_error('id wajib');
        if (empty($b['name'])) json_error('name wajib');

        $items = array_key_exists('items_json', $b)
            ? (is_array($b['items_json']) ? json_encode($b['items_json']) : $b['items_json'])
            : '[]';

        $stmt = db()->prepare(
            'INSERT INTO service_packages (id, name, description, items_json)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               name = VALUES(name),
               description = VALUES(description),
               items_json = VALUES(items_json)'
        );
        $stmt->execute([$pid, $b['name'], $b['description'] ?? null, $items]);

        $stmt = db()->prepare('SELECT id, name, description, items_json, created_at FROM service_packages WHERE id=?');
        $stmt->execute([$pid]);
        $row = $stmt->fetch();
        decode_items($row);
        json_response($row, 201);
    }
    case 'PUT': {
        require_role(['admin']);
        if (!$id) json_error('id wajib');
        $b = json_body();

        $sets = [];
        $vals = [];
        $map = [
            'name'        => fn($v) => (string)$v,
            'description' => fn($v) => $v === '' ? null : $v,
            'items_json'  => fn($v) => is_array($v) ? json_encode($v) : $v,
        ];
        foreach ($map as $col => $cast) {
            if (array_key_exists($col, $b)) {
                $sets[] = "$col=?";
                $vals[] = $cast($b[$col]);
            }
        }
        if ($sets) {
            $vals[] = $id;
            $stmt = db()->prepare('UPDATE service_packages SET ' . implode(', ', $sets) . ' WHERE id=?');
            $stmt->execute($vals);
        }
        $stmt = db()->prepare('SELECT id, name, description, items_json, created_at FROM service_packages WHERE id=?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        decode_items($row);
        json_response($row);
    }
    case 'DELETE': {
        require_role(['admin']);
        if (!$id) json_error('id wajib');
        db()->prepare('DELETE FROM service_packages WHERE id=?')->execute([$id]);
        json_response(['ok' => true]);
    }
    default: json_error('Method not allowed', 405);
}
