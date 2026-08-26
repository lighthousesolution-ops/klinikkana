<?php
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../config/database.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = isset($_GET['id']) ? trim((string)$_GET['id']) : '';

function attach_parts(array &$repair): void {
    $stmt = db()->prepare('SELECT rp.id, rp.sparepart_id, rp.qty, rp.price, s.name AS sparepart_name, s.sku
                            FROM repair_parts rp JOIN spareparts s ON s.id = rp.sparepart_id
                            WHERE rp.repair_id = ?');
    $stmt->execute([$repair['id']]);
    $repair['parts_used'] = $stmt->fetchAll();

    $stmt = db()->prepare('SELECT id, amount, method, note, paid_at FROM payments WHERE repair_id = ? ORDER BY paid_at');
    $stmt->execute([$repair['id']]);
    $repair['payments'] = $stmt->fetchAll();
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
        $customer_id = isset($_GET['customer_id']) ? trim((string)$_GET['customer_id']) : '';
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
        // Accept client-generated id if provided (matches localStorage uid()),
        // otherwise generate one. This lets the write-through mirror keep the
        // same id across localStorage and MySQL.
        $newId = !empty($b['id']) ? trim((string)$b['id']) : uniqid('r_', true);
        $ticket = !empty($b['ticket_no']) ? trim((string)$b['ticket_no']) : next_ticket_no();
        $stmt = db()->prepare('INSERT INTO repairs (id, ticket_no, customer_id, device_brand, device_model, serial_no, complaint, notes, service_fee, deposit, status, technician_id, branch_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
        $stmt->execute([
            $newId, $ticket, (string)$b['customer_id'], $b['device_brand'], $b['device_model'],
            $b['serial_no'] ?? '', $b['complaint'], $b['notes'] ?? '',
            (float)($b['service_fee'] ?? 0), (float)($b['deposit'] ?? 0),
            $b['status'] ?? 'pending',
            !empty($b['technician_id']) ? (string)$b['technician_id'] : null,
            $b['branch_id'] ?? null,
        ]);
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

        // Always apply field updates when the body carries them. phpMirror
        // sends the entire repair object, so we can no longer treat status
        // as mutually-exclusive with the other fields.
        $hasFields = array_key_exists('device_brand', $b) || array_key_exists('device_model', $b)
                  || array_key_exists('serial_no', $b) || array_key_exists('complaint', $b)
                  || array_key_exists('notes', $b) || array_key_exists('technician_id', $b)
                  || array_key_exists('service_fee', $b) || array_key_exists('deposit', $b);
        if ($hasFields) {
            // Build the SET clause ONLY from keys actually present in the
            // payload so partial PUTs never blank out other columns.
            $sets = [];
            $vals = [];
            $map = [
                'device_brand'  => fn($v) => (string)$v,
                'device_model'  => fn($v) => (string)$v,
                'serial_no'     => fn($v) => (string)$v,
                'complaint'     => fn($v) => (string)$v,
                'notes'         => fn($v) => (string)$v,
                'technician_id' => fn($v) => $v === '' || $v === null ? null : (string)$v,
                'service_fee'   => fn($v) => (float)$v,
                'deposit'       => fn($v) => (float)$v,
            ];
            foreach ($map as $col => $cast) {
                if (array_key_exists($col, $b)) {
                    $sets[] = "$col=?";
                    $vals[] = $cast($b[$col]);
                }
            }
            if ($sets) {
                $vals[] = $id;
                $stmt = db()->prepare('UPDATE repairs SET ' . implode(', ', $sets) . ' WHERE id=?');
                $stmt->execute($vals);
            }
        }
        // Then apply status transition. Only stamp completed_at / picked_up_at
        // when they are still NULL, so re-mirroring the same status (phpMirror
        // sends the entire object on every edit) does not clobber the original
        // completion/pickup timestamps.
        if (isset($b['status'])) {
            $status = $b['status'];
            if (!in_array($status, ['pending','in_progress','ready','picked_up'], true)) json_error('Status tidak valid');
            $extra = '';
            if ($status === 'ready')     $extra = ', completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP)';
            if ($status === 'picked_up') $extra = ', picked_up_at = COALESCE(picked_up_at, CURRENT_TIMESTAMP)';
            $stmt = db()->prepare("UPDATE repairs SET status=?" . $extra . " WHERE id=?");
            $stmt->execute([$status, $id]);
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
