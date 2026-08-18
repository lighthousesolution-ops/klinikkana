<?php
/**
 * Admin reply to customer review.
 * POST   /api/repairs/reply.php?id={repair_id}   Body: { "reply": "..." }   → save/update
 * DELETE /api/repairs/reply.php?id={repair_id}                              → delete
 *
 * Requires admin auth.
 */
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../config/database.php';

$user = require_auth();
if (($user['role'] ?? '') !== 'admin') json_error('Hanya admin yang dapat membalas ulasan', 403);

$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if (!$id) json_error('id repair wajib', 400);

$method = $_SERVER['REQUEST_METHOD'];
$pdo = db();

$stmt = $pdo->prepare('SELECT id, rating FROM repairs WHERE id = ? LIMIT 1');
$stmt->execute([$id]);
$repair = $stmt->fetch();
if (!$repair) json_error('Tiket tidak ditemukan', 404);
if (empty($repair['rating'])) json_error('Ulasan belum ada, tidak bisa dibalas', 400);

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $reply = trim((string)($body['reply'] ?? ''));
    if ($reply === '') json_error('Balasan tidak boleh kosong', 400);
    if (strlen($reply) > 500) json_error('Balasan maksimal 500 karakter', 400);

    $stmt = $pdo->prepare('UPDATE repairs SET admin_reply = ?, admin_reply_by = ?, admin_reply_at = NOW() WHERE id = ?');
    $stmt->execute([$reply, $user['id'], $id]);

    json_response(['success' => true, 'admin_reply' => $reply, 'admin_reply_by' => (int)$user['id']]);
}

if ($method === 'DELETE') {
    $stmt = $pdo->prepare('UPDATE repairs SET admin_reply = NULL, admin_reply_by = NULL, admin_reply_at = NULL WHERE id = ?');
    $stmt->execute([$id]);
    json_response(['success' => true]);
}

json_error('Method not allowed', 405);
