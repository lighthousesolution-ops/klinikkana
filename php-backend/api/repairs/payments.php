<?php
/**
 * Payments for a repair ticket.
 * POST   /api/repairs/payments.php?id=REPAIR_ID  body: {amount, method, note}
 * DELETE /api/repairs/payments.php?id=REPAIR_ID&payment_id=PID
 */
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../config/database.php';

require_role(['admin', 'cashier']);
$repair_id = isset($_GET['id']) ? trim((string)$_GET['id']) : '';
if (!$repair_id) json_error('Repair id wajib');
$method = $_SERVER['REQUEST_METHOD'];
$pdo = db();

if ($method === 'POST') {
    $b = json_body();
    $amount = (float)($b['amount'] ?? 0);
    if ($amount <= 0) json_error('Jumlah tidak valid');
    $pid = !empty($b['id']) ? trim((string)$b['id']) : uniqid('pay_', true);
    $stmt = $pdo->prepare('INSERT INTO payments (id, repair_id, amount, method, note) VALUES (?,?,?,?,?)');
    $stmt->execute([$pid, $repair_id, $amount, $b['method'] ?? 'Tunai', $b['note'] ?? '']);
    json_response(['id' => $pid], 201);
}

if ($method === 'DELETE') {
    $pid = isset($_GET['payment_id']) ? trim((string)$_GET['payment_id']) : '';
    if (!$pid) json_error('payment_id wajib');
    $stmt = $pdo->prepare('DELETE FROM payments WHERE id=? AND repair_id=?');
    $stmt->execute([$pid, $repair_id]);
    json_response(['ok' => true]);
}

json_error('Method not allowed', 405);
