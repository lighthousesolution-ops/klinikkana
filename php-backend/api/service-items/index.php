<?php
/**
 * Service Items API — daftar jasa/layanan di bawah tiap kategori (global).
 * GET    /api/service-items/index.php                      -> list all
 * GET    /api/service-items/index.php?category_id=X        -> filter by category
 * GET    /api/service-items/index.php?id=X                 -> single
 * POST   /api/service-items/index.php                      -> upsert (used by phpMirror)
 * PUT    /api/service-items/index.php?id=X                 -> update
 * DELETE /api/service-items/index.php?id=X                 -> delete
 */
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../config/database.php';

$method      = $_SERVER['REQUEST_METHOD'];
$id          = $_GET['id'] ?? null;
$category_id = $_GET['category_id'] ?? null;

switch ($method) {
    case 'GET': {
        auth_user();
        if ($id) {
            $stmt = db()->prepare('SELECT id, category_id, name, default_price, duration_minutes, created_at FROM service_items WHERE id=?');
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            if (!$row) json_error('Jasa tidak ditemukan', 404);
            json_response($row);
        }
        if ($category_id) {
            $stmt = db()->prepare('SELECT id, category_id, name, default_price, duration_minutes, created_at FROM service_items WHERE category_id=? ORDER BY name ASC');
            $stmt->execute([$category_id]);
            json_response($stmt->fetchAll());
        }
        $rows = db()->query('SELECT id, category_id, name, default_price, duration_minutes, created_at FROM service_items ORDER BY category_id ASC, name ASC')->fetchAll();
        json_response($rows);
    }
    case 'POST': {
        require_role(['admin']);
        $b   = json_body();
        $sid = $b['id'] ?? null;
        if (!$sid) json_error('id wajib');
        if (empty($b['name'])) json_error('name wajib');
        if (empty($b['category_id'])) json_error('category_id wajib');

        try {
            $stmt = db()->prepare(
                'INSERT INTO service_items (id, category_id, name, default_price, duration_minutes)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                   category_id = VALUES(category_id),
                   name = VALUES(name),
                   default_price = VALUES(default_price),
                   duration_minutes = VALUES(duration_minutes)'
            );
            $stmt->execute([
                $sid,
                $b['category_id'],
                $b['name'],
                isset($b['default_price']) ? (float)$b['default_price'] : 0,
                isset($b['duration_minutes']) && $b['duration_minutes'] !== '' ? (int)$b['duration_minutes'] : null,
            ]);
        } catch (PDOException $e) {
            json_error('Gagal simpan jasa (cek category_id valid)', 400);
        }
        $stmt = db()->prepare('SELECT id, category_id, name, default_price, duration_minutes, created_at FROM service_items WHERE id=?');
        $stmt->execute([$sid]);
        json_response($stmt->fetch(), 201);
    }
    case 'PUT': {
        require_role(['admin']);
        if (!$id) json_error('id wajib');
        $b = json_body();

        $sets = [];
        $vals = [];
        $map = [
            'category_id'      => fn($v) => (string)$v,
            'name'             => fn($v) => (string)$v,
            'default_price'    => fn($v) => (float)$v,
            'duration_minutes' => fn($v) => ($v === '' || $v === null) ? null : (int)$v,
        ];
        foreach ($map as $col => $cast) {
            if (array_key_exists($col, $b)) {
                $sets[] = "$col=?";
                $vals[] = $cast($b[$col]);
            }
        }
        if ($sets) {
            $vals[] = $id;
            $stmt = db()->prepare('UPDATE service_items SET ' . implode(', ', $sets) . ' WHERE id=?');
            $stmt->execute($vals);
        }
        $stmt = db()->prepare('SELECT id, category_id, name, default_price, duration_minutes, created_at FROM service_items WHERE id=?');
        $stmt->execute([$id]);
        json_response($stmt->fetch());
    }
    case 'DELETE': {
        require_role(['admin']);
        if (!$id) json_error('id wajib');
        db()->prepare('DELETE FROM service_items WHERE id=?')->execute([$id]);
        json_response(['ok' => true]);
    }
    default: json_error('Method not allowed', 405);
}
