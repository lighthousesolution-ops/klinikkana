<?php
/**
 * Add or remove parts from a repair ticket.
 * POST   /api/repairs/parts.php?id=REPAIR_ID   body: {sparepart_id, qty}
 * DELETE /api/repairs/parts.php?id=REPAIR_ID&part_id=SPAREPART_ID
 *
 * NOTE about DELETE: `part_id` is the sparepart_id (that's what the
 * localStorage-based frontend passes — the mirror doesn't know the
 * repair_parts row id). We locate & delete the most-recent matching row.
 * Also adjusts sparepart stock accordingly.
 */
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../config/database.php';

require_role(['admin', 'technician']);
$repair_id = isset($_GET['id']) ? trim((string)$_GET['id']) : '';
if (!$repair_id) json_error('Repair id wajib');
$method = $_SERVER['REQUEST_METHOD'];

$pdo = db();

if ($method === 'POST') {
    $b = json_body();
    $sparepart_id = trim((string)($b['sparepart_id'] ?? ''));
    $qty = max(1, (int)($b['qty'] ?? 1));
    if (!$sparepart_id) json_error('sparepart_id wajib');

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT stock, selling_price FROM spareparts WHERE id=? FOR UPDATE');
        $stmt->execute([$sparepart_id]);
        $sp = $stmt->fetch();
        if (!$sp) throw new Exception('Sparepart tidak ditemukan');
        if ($sp['stock'] < $qty) throw new Exception('Stok tidak cukup');

        $rp_id = uniqid('rp_', true);
        $stmt = $pdo->prepare('INSERT INTO repair_parts (id, repair_id, sparepart_id, qty, price) VALUES (?,?,?,?,?)');
        $stmt->execute([$rp_id, $repair_id, $sparepart_id, $qty, (float)$sp['selling_price']]);

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
    // The mirror sends the sparepart_id here (not the repair_parts row id).
    $sparepart_id = isset($_GET['part_id']) ? trim((string)$_GET['part_id']) : '';
    if (!$sparepart_id) json_error('part_id (sparepart_id) wajib');

    $pdo->beginTransaction();
    try {
        // Delete the most-recent matching part row for this repair+sparepart.
        $stmt = $pdo->prepare('SELECT id, qty FROM repair_parts WHERE repair_id=? AND sparepart_id=? ORDER BY id DESC LIMIT 1 FOR UPDATE');
        $stmt->execute([$repair_id, $sparepart_id]);
        $rp = $stmt->fetch();
        if (!$rp) throw new Exception('Item tidak ditemukan untuk servis ini');

        $stmt = $pdo->prepare('DELETE FROM repair_parts WHERE id=?');
        $stmt->execute([$rp['id']]);

        $stmt = $pdo->prepare('UPDATE spareparts SET stock = stock + ? WHERE id=?');
        $stmt->execute([$rp['qty'], $sparepart_id]);

        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        json_error($e->getMessage(), 400);
    }
    json_response(['ok' => true]);
}

json_error('Method not allowed', 405);
