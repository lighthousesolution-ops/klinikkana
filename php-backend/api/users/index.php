<?php
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../config/database.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

switch ($method) {
    case 'GET': {
        require_role(['admin']);
        if ($id) {
            $stmt = db()->prepare('SELECT id, username, full_name, role, phone, created_at FROM users WHERE id=?');
            $stmt->execute([$id]);
            $u = $stmt->fetch();
            if (!$u) json_error('User tidak ditemukan', 404);
            json_response($u);
        }
        json_response(db()->query('SELECT id, username, full_name, role, phone, created_at FROM users ORDER BY created_at')->fetchAll());
    }
    case 'POST': {
        require_role(['admin']);
        $b = json_body();
        foreach (['username','password','full_name','role'] as $r) if (empty($b[$r])) json_error("Field $r wajib");
        if (!in_array($b['role'], ['admin','technician','cashier'], true)) json_error('Role tidak valid');
        $hash = password_hash($b['password'], PASSWORD_BCRYPT);
        try {
            $stmt = db()->prepare('INSERT INTO users (username, password_hash, full_name, role, phone) VALUES (?,?,?,?,?)');
            $stmt->execute([$b['username'], $hash, $b['full_name'], $b['role'], $b['phone'] ?? null]);
        } catch (PDOException $e) {
            json_error('Username sudah dipakai', 400);
        }
        $newId = db()->lastInsertId();
        $stmt = db()->prepare('SELECT id, username, full_name, role, phone, created_at FROM users WHERE id=?');
        $stmt->execute([$newId]);
        json_response($stmt->fetch(), 201);
    }
    case 'PUT': {
        require_role(['admin']);
        if (!$id) json_error('id wajib');
        $b = json_body();
        if (!empty($b['password'])) {
            $hash = password_hash($b['password'], PASSWORD_BCRYPT);
            $stmt = db()->prepare('UPDATE users SET full_name=?, role=?, phone=?, password_hash=? WHERE id=?');
            $stmt->execute([$b['full_name'] ?? '', $b['role'] ?? 'cashier', $b['phone'] ?? null, $hash, $id]);
        } else {
            $stmt = db()->prepare('UPDATE users SET full_name=?, role=?, phone=? WHERE id=?');
            $stmt->execute([$b['full_name'] ?? '', $b['role'] ?? 'cashier', $b['phone'] ?? null, $id]);
        }
        $stmt = db()->prepare('SELECT id, username, full_name, role, phone, created_at FROM users WHERE id=?');
        $stmt->execute([$id]);
        json_response($stmt->fetch());
    }
    case 'DELETE': {
        require_role(['admin']);
        if (!$id) json_error('id wajib');
        $stmt = db()->prepare('DELETE FROM users WHERE id=?');
        $stmt->execute([$id]);
        json_response(['deleted' => $id]);
    }
    default: json_error('Method not allowed', 405);
}
