<?php
require_once __DIR__ . '/../config/config.php';

// Hide raw PHP errors from clients on production. Errors are still written
// to the PHP error_log (or /tmp/php-test.log in the test harness).
@ini_set('display_errors', '0');
@ini_set('display_startup_errors', '0');
error_reporting(E_ALL);

// CORS
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
if (CORS_ALLOWED_ORIGIN === '*') {
    header("Access-Control-Allow-Origin: *");
} else {
    header("Access-Control-Allow-Origin: " . CORS_ALLOWED_ORIGIN);
}
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Max-Age: 86400");
header("Content-Type: application/json; charset=utf-8");

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function json_response($data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_error(string $message, int $code = 400): void {
    json_response(['error' => $message], $code);
}

function json_body(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

// Global safety net so uncaught PDOException / Error / Throwable never
// leak the stack trace + file path to the client. Full detail still goes
// to the PHP error log.
set_exception_handler(function ($e) {
    error_log('[api] Uncaught ' . get_class($e) . ': ' . $e->getMessage() . ' at ' . $e->getFile() . ':' . $e->getLine());
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode(['error' => 'Internal server error']);
    exit;
});
register_shutdown_function(function () {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR], true)) {
        error_log('[api] Fatal: ' . $err['message'] . ' at ' . $err['file'] . ':' . $err['line']);
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['error' => 'Internal server error']);
        }
    }
});
