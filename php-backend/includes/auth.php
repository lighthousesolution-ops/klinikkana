<?php
require_once __DIR__ . '/response.php';
require_once __DIR__ . '/jwt.php';
require_once __DIR__ . '/../config/database.php';

function auth_user(): array {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!$header && function_exists('getallheaders')) {
        $all = getallheaders();
        $header = $all['Authorization'] ?? $all['authorization'] ?? '';
    }
    if (!preg_match('/Bearer\s+(.+)/i', $header, $m)) {
        json_error('Unauthorized', 401);
    }
    $payload = jwt_decode(trim($m[1]));
    if (!$payload || empty($payload['uid'])) {
        json_error('Invalid or expired token', 401);
    }
    $stmt = db()->prepare('SELECT id, username, full_name, role, phone, branch_id, created_at FROM users WHERE id = ?');
    $stmt->execute([$payload['uid']]);
    $user = $stmt->fetch();
    if (!$user) json_error('User not found', 401);
    return $user;
}

function require_role(array $roles): array {
    $user = auth_user();
    if (!in_array($user['role'], $roles, true)) {
        json_error('Forbidden - insufficient role', 403);
    }
    return $user;
}
