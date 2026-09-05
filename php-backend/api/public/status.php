<?php
/**
 * PUBLIC status lookup - no authentication.
 * GET /api/public/status.php?ticket=KK-2501-006
 *
 * Returns sanitized info intended for customers who scanned the QR code.
 * Masks name & phone. Excludes cost prices, technician notes, and full stock.
 */
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

$ticket = trim($_GET['ticket'] ?? '');
if (!$ticket) json_error('Ticket wajib', 400);

$pdo = db();
$stmt = $pdo->prepare('SELECT * FROM repairs WHERE ticket_no = ? LIMIT 1');
$stmt->execute([$ticket]);
$r = $stmt->fetch();
if (!$r) json_error('Tiket tidak ditemukan', 404);

// Customer (masked)
$stmt = $pdo->prepare('SELECT name, phone FROM customers WHERE id=?');
$stmt->execute([$r['customer_id']]);
$c = $stmt->fetch();

function mask_name($n) {
    if (!$n) return '-';
    $parts = preg_split('/\s+/', trim($n));
    foreach ($parts as $i => $p) {
        if ($i === 0) continue;
        $len = strlen($p);
        if ($len <= 2) $parts[$i] = $p[0] . '*';
        else $parts[$i] = $p[0] . str_repeat('*', max(2, $len - 2)) . substr($p, -1);
    }
    return implode(' ', $parts);
}
function mask_phone($p) {
    $p = preg_replace('/\D/', '', $p ?? '');
    if (strlen($p) < 8) return $p;
    return substr($p, 0, 4) . '****' . substr($p, -4);
}

// Parts (names only, no cost/margin)
$stmt = $pdo->prepare('SELECT s.name FROM repair_parts rp JOIN spareparts s ON s.id = rp.sparepart_id WHERE rp.repair_id = ?');
$stmt->execute([$r['id']]);
$parts = array_column($stmt->fetchAll(), 'name');

// Services (decode services_json from repair; expose only name + category
// name — hide unit price so customer sees the total but not the breakdown).
$services = [];
if (!empty($r['services_json'])) {
    $decoded = json_decode($r['services_json'], true);
    if (is_array($decoded)) {
        // Preload category names in one query
        $catIds = array_values(array_unique(array_filter(array_column($decoded, 'category_id'))));
        $catMap = [];
        if ($catIds) {
            $placeholders = implode(',', array_fill(0, count($catIds), '?'));
            $stmt = $pdo->prepare("SELECT id, name FROM service_categories WHERE id IN ($placeholders)");
            $stmt->execute($catIds);
            foreach ($stmt->fetchAll() as $row) $catMap[$row['id']] = $row['name'];
        }
        foreach ($decoded as $s) {
            $services[] = [
                'name'          => $s['name'] ?? '',
                'category_name' => isset($s['category_id']) ? ($catMap[$s['category_id']] ?? null) : null,
                'is_custom'     => !empty($s['is_custom']),
                'from_package'  => $s['from_package'] ?? null,
            ];
        }
    }
}

// Payments total
$stmt = $pdo->prepare('SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE repair_id=?');
$stmt->execute([$r['id']]);
$paymentsTotal = (float)$stmt->fetchColumn();

$stmt = $pdo->prepare('SELECT COALESCE(SUM(qty*price),0) AS s FROM repair_parts WHERE repair_id=?');
$stmt->execute([$r['id']]);
$partsTotal = (float)$stmt->fetchColumn();

$total = (float)$r['service_fee'] + $partsTotal;
$paid = (float)$r['deposit'] + $paymentsTotal;

// Technician (name only)
$technicianName = null;
if ($r['technician_id']) {
    $stmt = $pdo->prepare('SELECT full_name FROM users WHERE id=?');
    $stmt->execute([$r['technician_id']]);
    $technicianName = $stmt->fetchColumn() ?: null;
}

json_response([
    'ticket_no'    => $r['ticket_no'],
    'status'       => $r['status'],
    'customer'     => ['name' => mask_name($c['name'] ?? ''), 'phone' => mask_phone($c['phone'] ?? '')],
    'device'       => ['brand' => $r['device_brand'], 'model' => $r['device_model'], 'serial_no' => $r['serial_no']],
    'complaint'    => $r['complaint'],
    'technician'   => $technicianName,
    'created_at'   => $r['created_at'],
    'completed_at' => $r['completed_at'],
    'picked_up_at' => $r['picked_up_at'],
    'parts_used'   => $parts,
    'services'     => $services,
    'totals'       => [
        'total'   => $total,
        'paid'    => $paid,
        'balance' => max(0, $total - $paid),
    ],
    'rating'       => isset($r['rating']) && $r['rating'] ? (int)$r['rating'] : null,
    'review'       => $r['review'] ?? null,
    'rated_at'     => $r['rated_at'] ?? null,
    'admin_reply'  => $r['admin_reply'] ?? null,
    'admin_reply_at' => $r['admin_reply_at'] ?? null,
]);
