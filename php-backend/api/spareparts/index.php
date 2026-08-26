<?php
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../config/database.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = isset($_GET['id']) ? trim((string)$_GET['id']) : '';

switch ($method) {
    case 'GET': {
        auth_user();
        if ($id) {
            $stmt = db()->prepare('SELECT * FROM spareparts WHERE id=?');
            $stmt->execute([$id]);
            $s = $stmt->fetch();
            if (!$s) json_error('Sparepart tidak ditemukan', 404);
            json_response($s);
        }
        json_response(db()->query('SELECT * FROM spareparts ORDER BY name')->fetchAll());
    }
    case 'POST': {
        require_role(['admin', 'technician']);
        $b = json_body();
        foreach (['name','sku'] as $r) if (empty($b[$r])) json_error("Field $r wajib");
        $newId = !empty($b['id']) ? trim((string)$b['id']) : uniqid('sp_', true);
        $stmt = db()->prepare('INSERT INTO spareparts (id, name, sku, category, stock, cost_price, selling_price, low_stock_threshold, branch_id) VALUES (?,?,?,?,?,?,?,?,?)');
        try {
            $stmt->execute([
                $newId, $b['name'], strtoupper($b['sku']), $b['category'] ?? 'Lainnya',
                (int)($b['stock'] ?? 0),
                (float)($b['cost_price'] ?? 0), (float)($b['selling_price'] ?? 0),
                (int)($b['low_stock_threshold'] ?? 3),
                $b['branch_id'] ?? null,
            ]);
        } catch (PDOException $e) {
            json_error('SKU sudah dipakai atau data tidak valid', 400);
        }
        $stmt = db()->prepare('SELECT * FROM spareparts WHERE id=?');
        $stmt->execute([$newId]);
        json_response($stmt->fetch(), 201);
    }
    case 'PUT': {
        require_role(['admin', 'technician']);
        if (!$id) json_error('id wajib');
        $b = json_body();
        $stmt = db()->prepare('UPDATE spareparts SET name=?, sku=?, category=?, stock=?, cost_price=?, selling_price=?, low_stock_threshold=? WHERE id=?');
        $stmt->execute([
            $b['name'] ?? '', strtoupper($b['sku'] ?? ''), $b['category'] ?? 'Lainnya',
            (int)($b['stock'] ?? 0), (float)($b['cost_price'] ?? 0),
            (float)($b['selling_price'] ?? 0), (int)($b['low_stock_threshold'] ?? 3), $id,
        ]);
        $stmt = db()->prepare('SELECT * FROM spareparts WHERE id=?');
        $stmt->execute([$id]);
        json_response($stmt->fetch());
    }
    case 'DELETE': {
        require_role(['admin']);
        if (!$id) json_error('id wajib');
        $stmt = db()->prepare('DELETE FROM spareparts WHERE id=?');
        $stmt->execute([$id]);
        json_response(['deleted' => $id]);
    }
    default: json_error('Method not allowed', 405);
}
