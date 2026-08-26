<?php
/**
 * Customers API - GET list, POST create, PUT update, DELETE.
 * Query: ?id=123 for single item on GET/PUT/DELETE.
 */
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../config/database.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = isset($_GET['id']) ? trim((string)$_GET['id']) : '';

switch ($method) {
    case 'GET': {
        auth_user();
        if ($id) {
            $stmt = db()->prepare('SELECT * FROM customers WHERE id = ?');
            $stmt->execute([$id]);
            $c = $stmt->fetch();
            if (!$c) json_error('Pelanggan tidak ditemukan', 404);
            json_response($c);
        }
        $rows = db()->query('SELECT * FROM customers ORDER BY created_at DESC')->fetchAll();
        json_response($rows);
    }
    case 'POST': {
        require_role(['admin', 'cashier', 'technician']);
        $b = json_body();
        if (empty($b['name']) || empty($b['phone'])) json_error('Nama dan telepon wajib diisi');
        $newId = !empty($b['id']) ? trim((string)$b['id']) : uniqid('c_', true);
        $stmt = db()->prepare('INSERT INTO customers (id, name, phone, address, notes, branch_id) VALUES (?,?,?,?,?,?)');
        $stmt->execute([$newId, $b['name'], $b['phone'], $b['address'] ?? '', $b['notes'] ?? '', $b['branch_id'] ?? null]);
        $stmt = db()->prepare('SELECT * FROM customers WHERE id = ?');
        $stmt->execute([$newId]);
        json_response($stmt->fetch(), 201);
    }
    case 'PUT': {
        require_role(['admin', 'cashier', 'technician']);
        if (!$id) json_error('id wajib');
        $b = json_body();
        $stmt = db()->prepare('UPDATE customers SET name=?, phone=?, address=?, notes=? WHERE id=?');
        $stmt->execute([$b['name'] ?? '', $b['phone'] ?? '', $b['address'] ?? '', $b['notes'] ?? '', $id]);
        $stmt = db()->prepare('SELECT * FROM customers WHERE id = ?');
        $stmt->execute([$id]);
        json_response($stmt->fetch());
    }
    case 'DELETE': {
        require_role(['admin']);
        if (!$id) json_error('id wajib');
        $stmt = db()->prepare('DELETE FROM customers WHERE id = ?');
        $stmt->execute([$id]);
        json_response(['deleted' => $id]);
    }
    default: json_error('Method not allowed', 405);
}
