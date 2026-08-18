<?php
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../config/database.php';

auth_user();
$pdo = db();

$active = (int)$pdo->query("SELECT COUNT(*) FROM repairs WHERE status IN ('pending','in_progress','ready')")->fetchColumn();
$completed = (int)$pdo->query("SELECT COUNT(*) FROM repairs WHERE status='picked_up'")->fetchColumn();
$lowStock = (int)$pdo->query("SELECT COUNT(*) FROM spareparts WHERE stock <= low_stock_threshold")->fetchColumn();

// Monthly revenue (current calendar month)
$monthlyRev = (float)$pdo->query("
    SELECT COALESCE(SUM(r.service_fee + IFNULL(p.parts_total,0)), 0)
    FROM repairs r
    LEFT JOIN (SELECT repair_id, SUM(qty*price) AS parts_total FROM repair_parts GROUP BY repair_id) p ON p.repair_id = r.id
    WHERE r.status='picked_up'
      AND YEAR(r.picked_up_at)=YEAR(NOW())
      AND MONTH(r.picked_up_at)=MONTH(NOW())
")->fetchColumn();

// Revenue for last 6 months
$revenue6 = $pdo->query("
    SELECT DATE_FORMAT(r.picked_up_at, '%Y-%m') AS ym,
           COALESCE(SUM(r.service_fee + IFNULL(p.parts_total,0)),0) AS revenue
    FROM repairs r
    LEFT JOIN (SELECT repair_id, SUM(qty*price) AS parts_total FROM repair_parts GROUP BY repair_id) p ON p.repair_id = r.id
    WHERE r.status='picked_up' AND r.picked_up_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
    GROUP BY ym
    ORDER BY ym
")->fetchAll();

// Status distribution
$statusDist = $pdo->query("SELECT status, COUNT(*) AS c FROM repairs GROUP BY status")->fetchAll();

json_response([
    'active_repairs'    => $active,
    'completed_repairs' => $completed,
    'low_stock'         => $lowStock,
    'monthly_revenue'   => $monthlyRev,
    'revenue_last_6m'   => $revenue6,
    'status_distribution' => $statusDist,
]);
