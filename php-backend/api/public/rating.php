<?php
/**
 * PUBLIC rating submission - no authentication.
 * POST /api/public/rating.php
 * Body: { "ticket": "KK-2501-006", "rating": 5, "review": "..." }
 *
 * Rules:
 *  - Repair must exist.
 *  - Status must be "picked_up".
 *  - Rating must be 1..5.
 *  - Only one rating per repair (idempotent).
 */
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$raw = file_get_contents('php://input');
$body = json_decode($raw, true);
if (!is_array($body)) $body = $_POST ?: [];

$ticket = trim($body['ticket'] ?? '');
$rating = (int)($body['rating'] ?? 0);
$review = trim((string)($body['review'] ?? ''));

if (!$ticket) json_error('Ticket wajib', 400);
if ($rating < 1 || $rating > 5) json_error('Rating harus 1-5', 400);
if (strlen($review) > 500) json_error('Ulasan maksimal 500 karakter', 400);

$pdo = db();
$stmt = $pdo->prepare('SELECT id, status, rating FROM repairs WHERE ticket_no = ? LIMIT 1');
$stmt->execute([$ticket]);
$r = $stmt->fetch();
if (!$r) json_error('Tiket tidak ditemukan', 404);
if ($r['status'] !== 'picked_up') json_error('Rating hanya bisa diberikan setelah perangkat diambil', 400);
if (!empty($r['rating'])) json_error('Ulasan sudah pernah dikirim untuk tiket ini', 409);

$stmt = $pdo->prepare('UPDATE repairs SET rating = ?, review = ?, rated_at = NOW() WHERE id = ?');
$stmt->execute([$rating, $review, $r['id']]);

json_response(['success' => true, 'rating' => $rating, 'review' => $review]);
