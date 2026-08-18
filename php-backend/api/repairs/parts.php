<?php
/**
 * Add or remove parts from a repair ticket.
 * POST   /api/repairs/parts.php?id=REPAIR_ID   body: {sparepart_id, qty}
 * DELETE /api/repairs/parts.php?id=REPAIR_ID&part_id=REPAIR_PART_ID
 * Adjusts sparepart stock accordingly.
 */
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../config/database.php';

require_role(['admin', 'technician']);
$repair_id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if (!$repair_id) json_error('Repair id wajib');
$method = $_SERVER['REQUEST_METHOD'];

$pdo = db();

if ($method === 'POST') {
    $b = json_body();
    $sparepart_id = (int)($b['sparepart_id'] ?? 0);
    $qty = max(1, (int)($b['qty'] ?? 1));
    if (!$sparepart_id) json_error('sparepart_id wajib');

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT stock, selling_price FROM spareparts WHERE id=? FOR UPDATE');
        $stmt->execute([$sparepart_id]);
        $sp = $stmt->fetch();
        if (!$sp) throw new Exception('Sparepart tidak ditemukan');
        if ($sp['stock'] < $qty) throw new Exception('Stok tidak cukup');

        $stmt = $pdo->prepare('INSERT INTO repair_parts (repair_id, sparepart_id, qty, price) VALUES (?,?,?,?)');
        $stmt->execute([$repair_id, $sparepart_id, $qty, (float)$sp['selling_price']]);

        $stmt = $pdo->prepare('UPDATE spareparts SET stock = stock - ? WHERE id=?');
        $stmt->execute([$qty, $sparepart_id]);

        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        json_error($e->getMessage(), 400);
    }

    json_response(['ok' => true], 201);
}

if ($method === 'DELETE') {
    $part_id = isset($_GET['part_id']) ? (int)$_GET['part_id'] : 0;
    if (!$part_id) json_error('part_id wajib');

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT sparepart_id, qty FROM repair_parts WHERE id=? AND repair_id=? FOR UPDATE');
        $stmt->execute([$part_id, $repair_id]);
        $rp = $stmt->fetch();
        if (!$rp) throw new Exception('Item tidak ditemukan');

        $stmt = $pdo->prepare('DELETE FROM repair_parts WHERE id=?');
        $stmt->execute([$part_id]);

        $stmt = $pdo->prepare('UPDATE spareparts SET stock = stock + ? WHERE id=?');
        $stmt->execute([$rp['qty'], $rp['sparepart_id']]);

        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        json_error($e->getMessage(), 400);
    }
    json_response(['ok' => true]);
}

json_error('Method not allowed', 405);
