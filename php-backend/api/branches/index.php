<?php
/**
 * Branches API — string ids (UUID-like from the frontend).
 * GET    /api/branches/index.php          -> list
 * GET    /api/branches/index.php?id=X     -> single
 * POST   /api/branches/index.php          -> upsert (used by phpMirror)
 * PUT    /api/branches/index.php?id=X     -> update
 * DELETE /api/branches/index.php?id=X     -> delete
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
            $stmt = db()->prepare('SELECT * FROM branches WHERE id=?');
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            if (!$row) json_error('Cabang tidak ditemukan', 404);
            json_response($row);
        }
        $rows = db()->query('SELECT * FROM branches ORDER BY is_default DESC, name ASC')->fetchAll();
        json_response($rows);
    }
    case 'POST': {
        require_role(['admin']);
        $b = json_body();
        $bid = $b['id'] ?? null;
        if (!$bid) json_error('id wajib');

        // Upsert semantics — used by phpMirror push.
        $stmt = db()->prepare(
            'INSERT INTO branches (id, code, name, address, phone, is_default, created_at)
             VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
             ON DUPLICATE KEY UPDATE
               code = VALUES(code),
               name = VALUES(name),
               address = VALUES(address),
               phone = VALUES(phone),
               is_default = VALUES(is_default)'
        );
        $stmt->execute([
            $bid,
            $b['code'] ?? '',
            $b['name'] ?? '',
            $b['address'] ?? null,
            $b['phone'] ?? null,
            !empty($b['is_default']) ? 1 : 0,
            $b['created_at'] ?? null,
        ]);

        $stmt = db()->prepare('SELECT * FROM branches WHERE id=?');
        $stmt->execute([$bid]);
        json_response($stmt->fetch(), 201);
    }
    case 'PUT': {
        require_role(['admin']);
        if (!$id) json_error('id wajib');
        $b = json_body();

        // Build SET clause dynamically so partial PUTs never blank other cols.
        $sets = [];
        $vals = [];
        $map = [
            'code'       => fn($v) => (string)$v,
            'name'       => fn($v) => (string)$v,
            'address'    => fn($v) => $v === '' ? null : $v,
            'phone'      => fn($v) => $v === '' ? null : $v,
            'is_default' => fn($v) => $v ? 1 : 0,
        ];
        foreach ($map as $col => $cast) {
            if (array_key_exists($col, $b)) {
                $sets[] = "$col=?";
                $vals[] = $cast($b[$col]);
            }
        }
        if ($sets) {
            $vals[] = $id;
            $stmt = db()->prepare('UPDATE branches SET ' . implode(', ', $sets) . ' WHERE id=?');
            $stmt->execute($vals);
        }
        $stmt = db()->prepare('SELECT * FROM branches WHERE id=?');
        $stmt->execute([$id]);
        json_response($stmt->fetch());
    }
    case 'DELETE': {
        require_role(['admin']);
        if (!$id) json_error('id wajib');
        // Frontend already blocks deleting a default branch or one with data;
        // enforce again server-side so direct API calls cannot bypass.
        $row = db()->prepare('SELECT is_default FROM branches WHERE id=?');
        $row->execute([$id]);
        $b = $row->fetch();
        if (!$b) json_error('Cabang tidak ditemukan', 404);
        if ((int)$b['is_default'] === 1) json_error('Cabang default tidak dapat dihapus');

        $cnt = db()->prepare('SELECT
            (SELECT COUNT(*) FROM repairs   WHERE branch_id=?) AS repairs,
            (SELECT COUNT(*) FROM spareparts WHERE branch_id=?) AS parts');
        $cnt->execute([$id, $id]);
        $c = $cnt->fetch();
        if ((int)$c['repairs'] > 0 || (int)$c['parts'] > 0) {
            json_error('Cabang masih memiliki data tiket atau sparepart.');
        }

        db()->prepare('DELETE FROM branches WHERE id=?')->execute([$id]);
        json_response(['ok' => true]);
    }
    default: json_error('Method not allowed', 405);
}
