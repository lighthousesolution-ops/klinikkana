<?php
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../config/database.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

function attach_parts(array &$repair): void {
    $stmt = db()->prepare('SELECT rp.id, rp.sparepart_id, rp.qty, rp.price, s.name AS sparepart_name, s.sku
                            FROM repair_parts rp JOIN spareparts s ON s.id = rp.sparepart_id
                            WHERE rp.repair_id = ?');
    $stmt->execute([$repair['id']]);
    $repair['parts_used'] = $stmt->fetchAll();
}

function next_ticket_no(): string {
    $prefix = 'KK-' . date('ym') . '-';
    $stmt = db()->prepare("SELECT ticket_no FROM repairs WHERE ticket_no LIKE ? ORDER BY id DESC LIMIT 1");
    $stmt->execute([$prefix . '%']);
    $last = $stmt->fetchColumn();
    $n = $last ? (int)substr($last, -3) + 1 : 1;
    return $prefix . str_pad($n, 3, '0', STR_PAD_LEFT);
}

switch ($method) {
    case 'GET': {
        auth_user();
        if ($id) {
            $stmt = db()->prepare('SELECT * FROM repairs WHERE id=?');
            $stmt->execute([$id]);
            $r = $stmt->fetch();
            if (!$r) json_error('Servis tidak ditemukan', 404);
            attach_parts($r);
            json_response($r);
        }
        $customer_id = isset($_GET['customer_id']) ? (int)$_GET['customer_id'] : 0;
        if ($customer_id) {
            $stmt = db()->prepare('SELECT * FROM repairs WHERE customer_id=? ORDER BY created_at DESC');
            $stmt->execute([$customer_id]);
        } else {
            $stmt = db()->query('SELECT * FROM repairs ORDER BY created_at DESC');
        }
        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) attach_parts($row);
        json_response($rows);
    }

    case 'POST': {
        require_role(['admin', 'cashier', 'technician']);
        $b = json_body();
        foreach (['customer_id','device_brand','device_model','complaint'] as $r) if (empty($b[$r])) json_error("Field $r wajib");
        $ticket = next_ticket_no();
        $stmt = db()->prepare('INSERT INTO repairs (ticket_no, customer_id, device_brand, device_model, serial_no, complaint, service_fee, deposit, status) VALUES (?,?,?,?,?,?,?,?, ?)');
        $stmt->execute([
            $ticket, (int)$b['customer_id'], $b['device_brand'], $b['device_model'],
            $b['serial_no'] ?? '', $b['complaint'],
            (float)($b['service_fee'] ?? 0), (float)($b['deposit'] ?? 0), 'pending'
        ]);
        $newId = db()->lastInsertId();
        $stmt = db()->prepare('SELECT * FROM repairs WHERE id=?');
        $stmt->execute([$newId]);
        $repair = $stmt->fetch();
        attach_parts($repair);
        json_response($repair, 201);
    }

    case 'PUT': {
        require_role(['admin', 'cashier', 'technician']);
        if (!$id) json_error('id wajib');
        $b = json_body();

        // Status change
        if (isset($b['status'])) {
            $status = $b['status'];
            if (!in_array($status, ['pending','in_progress','ready','picked_up'], true)) json_error('Status tidak valid');
            $extra = '';
            $params = [$status, $id];
            if ($status === 'ready') $extra = ', completed_at = NOW()';
            if ($status === 'picked_up') $extra = ', picked_up_at = NOW()';
            $stmt = db()->prepare("UPDATE repairs SET status=?" . $extra . " WHERE id=?");
            $stmt->execute($params);
        } else {
            $stmt = db()->prepare('UPDATE repairs SET device_brand=?, device_model=?, serial_no=?, complaint=?, notes=?, technician_id=?, service_fee=?, deposit=? WHERE id=?');
            $stmt->execute([
                $b['device_brand'] ?? '', $b['device_model'] ?? '', $b['serial_no'] ?? '',
                $b['complaint'] ?? '', $b['notes'] ?? '',
                !empty($b['technician_id']) ? (int)$b['technician_id'] : null,
                (float)($b['service_fee'] ?? 0), (float)($b['deposit'] ?? 0), $id,
            ]);
        }
        $stmt = db()->prepare('SELECT * FROM repairs WHERE id=?');
        $stmt->execute([$id]);
        $r = $stmt->fetch();
        attach_parts($r);
        json_response($r);
    }

    case 'DELETE': {
        require_role(['admin']);
        if (!$id) json_error('id wajib');
        $stmt = db()->prepare('DELETE FROM repairs WHERE id=?');
        $stmt->execute([$id]);
        json_response(['deleted' => $id]);
    }

    default: json_error('Method not allowed', 405);
}
