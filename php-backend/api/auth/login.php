<?php
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/jwt.php';
require_once __DIR__ . '/../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body = json_body();
$username = trim($body['username'] ?? '');
$password = $body['password'] ?? '';
if (!$username || !$password) json_error('Username dan password wajib');

$stmt = db()->prepare('SELECT id, username, password_hash, full_name, role, phone, branch_id FROM users WHERE username = ? LIMIT 1');
$stmt->execute([$username]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    json_error('Username atau password salah', 401);
}

$payload = ['uid' => (string)$user['id'], 'role' => $user['role'], 'iat' => time(), 'exp' => time() + JWT_TTL_SECONDS];
$token = jwt_encode($payload);
unset($user['password_hash']);

json_response(['user' => $user, 'token' => $token]);
