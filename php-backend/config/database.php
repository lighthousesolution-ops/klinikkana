<?php
// TEST-ONLY database bootstrap using SQLite (for E2E verification in Emergent
// preview env). PRODUCTION VPS uses the original database.php + MySQL.
require_once __DIR__ . '/config.php';

/**
 * TEST-ONLY PDO shim: translates the MySQL-specific SQL used by the
 * production endpoints into SQLite-compatible SQL so the endpoints can be
 * exercised end-to-end in the preview environment. NOT used in production.
 */
class TestPdo extends PDO {
    private function tr(string $sql): string {
        $sql = str_ireplace(' FOR UPDATE', '', $sql);
        $sql = str_ireplace('NOW()', "datetime('now')", $sql);
        $sql = preg_replace('/YEAR\(([^)]*)\)/i', "strftime('%Y', $1)", $sql);
        $sql = preg_replace('/MONTH\(([^)]*)\)/i', "strftime('%m', $1)", $sql);
        if (stripos($sql, 'ON DUPLICATE KEY UPDATE') !== false) {
            $sql = preg_replace('/INSERT INTO/i', 'INSERT INTO', $sql, 1);
            $sql = preg_replace(
                '/ON DUPLICATE KEY UPDATE\s+data\s*=\s*VALUES\(data\)/i',
                'ON CONFLICT(id) DO UPDATE SET data = excluded.data',
                $sql
            );
        }
        return $sql;
    }
    #[\ReturnTypeWillChange]
    public function prepare($sql, $options = []) { return parent::prepare($this->tr($sql), $options); }
    #[\ReturnTypeWillChange]
    public function query($sql, ...$a) { return parent::query($this->tr($sql), ...$a); }
    #[\ReturnTypeWillChange]
    public function exec($sql) { return parent::exec($this->tr($sql)); }
}

function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dbFile = '/tmp/klinikkana_test.sqlite';
        $needsBootstrap = !file_exists($dbFile);
        $pdo = new TestPdo('sqlite:' . $dbFile, null, null, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $pdo->exec('PRAGMA foreign_keys = ON');
        if ($needsBootstrap) bootstrap($pdo);
    }
    return $pdo;
}

function bootstrap(PDO $pdo): void {
    $pdo->exec("
    CREATE TABLE users (
        id VARCHAR(64) PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(120) NOT NULL,
        role TEXT NOT NULL DEFAULT 'cashier',
        phone VARCHAR(30),
        branch_id VARCHAR(64),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE customers (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        phone VARCHAR(30) NOT NULL UNIQUE,
        address TEXT,
        notes TEXT,
        branch_id VARCHAR(64),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE spareparts (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        sku VARCHAR(50) NOT NULL UNIQUE,
        category VARCHAR(50) DEFAULT 'Lainnya',
        stock INTEGER NOT NULL DEFAULT 0,
        cost_price REAL NOT NULL DEFAULT 0,
        selling_price REAL NOT NULL DEFAULT 0,
        low_stock_threshold INTEGER NOT NULL DEFAULT 3,
        branch_id VARCHAR(64),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE repairs (
        id VARCHAR(64) PRIMARY KEY,
        ticket_no VARCHAR(30) NOT NULL UNIQUE,
        customer_id VARCHAR(64) NOT NULL,
        device_brand VARCHAR(60) NOT NULL,
        device_model VARCHAR(120) NOT NULL,
        serial_no VARCHAR(80),
        complaint TEXT NOT NULL,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        technician_id VARCHAR(64),
        service_fee REAL NOT NULL DEFAULT 0,
        deposit REAL NOT NULL DEFAULT 0,
        branch_id VARCHAR(64),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT,
        picked_up_at TEXT,
        rating INTEGER,
        review TEXT,
        rated_at TEXT,
        admin_reply TEXT,
        admin_reply_by VARCHAR(64),
        admin_reply_at TEXT
    );
    CREATE TABLE repair_parts (
        id VARCHAR(64) PRIMARY KEY,
        repair_id VARCHAR(64) NOT NULL,
        sparepart_id VARCHAR(64) NOT NULL,
        qty INTEGER NOT NULL DEFAULT 1,
        price REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE payments (
        id VARCHAR(64) PRIMARY KEY,
        repair_id VARCHAR(64) NOT NULL,
        amount REAL NOT NULL,
        method VARCHAR(30) NOT NULL DEFAULT 'Tunai',
        note VARCHAR(255),
        paid_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE app_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        data TEXT NOT NULL
    );
    ");
    // Seed 1 user, 1 customer, 1 sparepart for tests
    $hash = password_hash('admin123', PASSWORD_BCRYPT);
    $pdo->prepare('INSERT INTO users (id,username,password_hash,full_name,role) VALUES (?,?,?,?,?)')
        ->execute(['u1','admin',$hash,'Andi Wijaya','admin']);
    $pdo->prepare('INSERT INTO customers (id,name,phone) VALUES (?,?,?)')
        ->execute(['c1','Rina Marlina','081211112222']);
    $pdo->prepare('INSERT INTO spareparts (id,name,sku,stock,cost_price,selling_price) VALUES (?,?,?,?,?,?)')
        ->execute(['sp1','LCD iPhone 11','LCD-IP11',8,750000,1150000]);
}
