<?php
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../config/database.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = isset($_GET['id']) ? trim((string)$_GET['id']) : '';

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
        $newId = !empty($b['id']) ? trim((string)$b['id']) : uniqid('u_', true);
        try {
            $stmt = db()->prepare('INSERT INTO users (id, username, password_hash, full_name, role, phone, branch_id) VALUES (?,?,?,?,?,?,?)');
            $stmt->execute([$newId, $b['username'], $hash, $b['full_name'], $b['role'], $b['phone'] ?? null, $b['branch_id'] ?? null]);
        } catch (PDOException $e) {
            json_error('Username sudah dipakai', 400);
        }
        $stmt = db()->prepare('SELECT id, username, full_name, role, phone, created_at FROM users WHERE id=?');
        $stmt->execute([$newId]);
        json_response($stmt->fetch(), 201);
    }
    case 'PUT': {
        // Allow either an admin OR the user editing their OWN record. Non-admins
        // may only touch password / phone (nobody self-promotes their role).
        $me = auth_user();
        if (!$id) json_error('id wajib');
        $isSelf = ((string)$me['id'] === (string)$id);
        if ($me['role'] !== 'admin' && !$isSelf) json_error('Forbidden - insufficient role', 403);

        $b = json_body();

        // Build SET clause only from keys actually present in the payload so
        // partial PUTs don't blank out other columns.
        $sets = [];
        $vals = [];

        $allowedAdmin = ['full_name', 'role', 'phone'];
        foreach ($allowedAdmin as $col) {
            if ($me['role'] === 'admin' && array_key_exists($col, $b)) {
                if ($col === 'role' && !in_array($b[$col], ['admin','technician','cashier'], true)) json_error('Role tidak valid');
                $sets[] = "$col=?";
                $vals[] = $b[$col] === '' || $b[$col] === null ? null : $b[$col];
            }
        }
        // phone can be updated by self as well
        if ($isSelf && $me['role'] !== 'admin' && array_key_exists('phone', $b)) {
            $sets[] = 'phone=?';
            $vals[] = $b['phone'] === '' || $b['phone'] === null ? null : $b['phone'];
        }
        // password may be updated by admin OR self
        if (!empty($b['password'])) {
            $sets[] = 'password_hash=?';
            $vals[] = password_hash($b['password'], PASSWORD_BCRYPT);
        }
        if ($sets) {
            $vals[] = $id;
            $stmt = db()->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id=?');
            $stmt->execute($vals);
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
