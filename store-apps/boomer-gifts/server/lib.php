<?php
/**
 * Shared helpers for the Boomer Gifts survey server: config, database,
 * and verification of the two kinds of request Shopify sends.
 */

declare(strict_types=1);

/** Answers the thank-you survey offers. Must match ANSWERS in the extension. */
const SURVEY_ANSWERS = ['google', 'facebook', 'instagram', 'pinterest', 'ai', 'friend', 'other'];

const ANSWER_LABELS = [
    'google' => 'Google search',
    'facebook' => 'Facebook',
    'instagram' => 'Instagram',
    'pinterest' => 'Pinterest',
    'ai' => 'ChatGPT or another AI assistant',
    'friend' => 'A friend or family member',
    'other' => 'Other',
];

/** The same table as schema.sql, for SQLite (used on umerconnects.com: no database user needed). */
const SQLITE_SCHEMA = 'CREATE TABLE IF NOT EXISTS survey_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop TEXT NOT NULL,
  order_id TEXT NULL,
  answer TEXT NOT NULL,
  other_text TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (shop, order_id)
)';

function config(): array
{
    static $config = null;
    if ($config === null) {
        $path = __DIR__ . '/config.php';
        if (!is_file($path)) {
            http_response_code(500);
            exit('Missing config.php. Copy config.sample.php to config.php and fill it in.');
        }
        $config = require $path;
    }
    return $config;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $c = config();
        $pdo = new PDO($c['db_dsn'], $c['db_user'] ?? null, $c['db_password'] ?? null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        // Create the table on first use, so no manual SQL step is needed.
        $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
        if ($driver === 'mysql') {
            $pdo->exec((string) file_get_contents(__DIR__ . '/schema.sql'));
        } elseif ($driver === 'sqlite') {
            $pdo->exec('PRAGMA busy_timeout = 5000');
            $pdo->exec(SQLITE_SCHEMA);
        }
    }
    return $pdo;
}

function base64url_decode(string $data): string|false
{
    return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', (4 - strlen($data) % 4) % 4), true);
}

/** "https://store.myshopify.com/admin" or "store.myshopify.com" -> "store.myshopify.com" */
function shop_domain(string $value): string
{
    return strtolower(preg_replace('#/.*$#', '', preg_replace('#^https?://#i', '', $value)));
}

function shop_allowed(string $shop): bool
{
    return in_array($shop, config()['allowed_shops'], true);
}

/**
 * Verifies a Shopify session token (a JWT signed with the app's client secret,
 * HS256) and returns its payload, or null if it isn't valid.
 * Checks: signature, algorithm, expiry, not-before, audience (our client ID)
 * and that it was issued for one of our shops.
 */
function verify_session_token(string $jwt): ?array
{
    $c = config();
    $parts = explode('.', $jwt);
    if (count($parts) !== 3) {
        return null;
    }
    [$h64, $p64, $s64] = $parts;
    $header = json_decode((string) base64url_decode($h64), true);
    $payload = json_decode((string) base64url_decode($p64), true);
    $signature = base64url_decode($s64);
    if (!is_array($header) || !is_array($payload) || $signature === false) {
        return null;
    }
    if (($header['alg'] ?? '') !== 'HS256') {
        return null;
    }
    $expected = hash_hmac('sha256', "$h64.$p64", $c['client_secret'], true);
    if (!hash_equals($expected, $signature)) {
        return null;
    }
    $now = time();
    $leeway = 10; // seconds, for clock differences
    if (!isset($payload['exp']) || $payload['exp'] < $now - $leeway) {
        return null;
    }
    if (isset($payload['nbf']) && $payload['nbf'] > $now + $leeway) {
        return null;
    }
    $aud = $payload['aud'] ?? null;
    if ($aud !== $c['client_id'] && !(is_array($aud) && in_array($c['client_id'], $aud, true))) {
        return null;
    }
    if (!shop_allowed(shop_domain((string) ($payload['dest'] ?? '')))) {
        return null;
    }
    return $payload;
}

/**
 * Verifies the hmac Shopify adds to the app URL when it opens the app in the
 * admin. Returns the shop domain, or null if the request isn't from Shopify.
 */
function verify_admin_request(array $query): ?string
{
    $hmac = $query['hmac'] ?? '';
    $shop = shop_domain((string) ($query['shop'] ?? ''));
    if ($hmac === '' || !shop_allowed($shop)) {
        return null;
    }
    $params = $query;
    unset($params['hmac'], $params['signature']);
    ksort($params);
    $message = implode('&', array_map(
        fn ($k, $v) => $k . '=' . (is_array($v) ? json_encode($v) : $v),
        array_keys($params),
        $params,
    ));
    $expected = hash_hmac('sha256', $message, config()['client_secret']);
    if (!hash_equals($expected, $hmac)) {
        return null;
    }
    // Links older than a day aren't accepted.
    if (abs(time() - (int) ($query['timestamp'] ?? 0)) > 86400) {
        return null;
    }
    return $shop;
}
