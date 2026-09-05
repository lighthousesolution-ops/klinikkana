<?php
/**
 * Service Categories API — kategori master jasa servis (global, tidak per cabang).
 * GET    /api/service-categories/index.php          -> list
 * GET    /api/service-categories/index.php?id=X     -> single
 * POST   /api/service-categories/index.php          -> upsert (used by phpMirror)
 * PUT    /api/service-categories/index.php?id=X     -> update
 * DELETE /api/service-categories/index.php?id=X     -> delete (cascade ke service_items)
 */
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../config/database.php';

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? null;

switch ($method) {
    case 'GET': {
        auth_user();
        if ($id) {
            $stmt = db()->prepare('SELECT id, name, icon, sort_order, created_at FROM service_categories WHERE id=?');
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            if (!$row) json_error('Kategori tidak ditemukan', 404);
            json_response($row);
        }
        $rows = db()->query('SELECT id, name, icon, sort_order, created_at FROM service_categories ORDER BY sort_order ASC, name ASC')->fetchAll();
        json_response($rows);
    }
    case 'POST': {
        require_role(['admin']);
        $b = json_body();
        $cid = $b['id'] ?? null;
        if (!$cid) json_error('id wajib');
        if (empty($b['name'])) json_error('name wajib');

        // Upsert semantics — ignore any client-side created_at (JS ISO
        // strings crash MySQL TIMESTAMP). Let the column default kick in.
        $stmt = db()->prepare(
            'INSERT INTO service_categories (id, name, icon, sort_order)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               name = VALUES(name),
               icon = VALUES(icon),
               sort_order = VALUES(sort_order)'
        );
        $stmt->execute([
            $cid,
            $b['name'],
            $b['icon'] ?? null,
            isset($b['sort_order']) ? (int)$b['sort_order'] : 0,
        ]);
        $stmt = db()->prepare('SELECT id, name, icon, sort_order, created_at FROM service_categories WHERE id=?');
        $stmt->execute([$cid]);
        json_response($stmt->fetch(), 201);
    }
    case 'PUT': {
        require_role(['admin']);
        if (!$id) json_error('id wajib');
        $b = json_body();

        $sets = [];
        $vals = [];
        $map = [
            'name'       => fn($v) => (string)$v,
            'icon'       => fn($v) => $v === '' ? null : $v,
            'sort_order' => fn($v) => (int)$v,
        ];
        foreach ($map as $col => $cast) {
            if (array_key_exists($col, $b)) {
                $sets[] = "$col=?";
                $vals[] = $cast($b[$col]);
            }
        }
        if ($sets) {
            $vals[] = $id;
            $stmt = db()->prepare('UPDATE service_categories SET ' . implode(', ', $sets) . ' WHERE id=?');
            $stmt->execute($vals);
        }
        $stmt = db()->prepare('SELECT id, name, icon, sort_order, created_at FROM service_categories WHERE id=?');
        $stmt->execute([$id]);
        json_response($stmt->fetch());
    }
    case 'DELETE': {
        require_role(['admin']);
        if (!$id) json_error('id wajib');
        // service_items FK is ON DELETE CASCADE, so deleting a category
        // also removes its items automatically.
        db()->prepare('DELETE FROM service_categories WHERE id=?')->execute([$id]);
        json_response(['ok' => true]);
    }
    default: json_error('Method not allowed', 405);
}
