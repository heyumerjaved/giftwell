<?php
/**
 * POST /survey.php
 * Saves one answer from the thank-you page survey extension.
 * The request carries the checkout session token, which proves which shop it
 * came from; the shop is never taken from the request body.
 */

declare(strict_types=1);
require __DIR__ . '/lib.php';

// Checkout extensions run in a sandbox on Shopify's domain, so allow cross-origin
// requests. The session token, not the origin, is what's checked.
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Max-Age: 86400');

function respond(int $status, array $body): never
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($body);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['error' => 'Method not allowed']);
}

// Some hosts only pass the Authorization header through REDIRECT_HTTP_AUTHORIZATION
// (see .htaccess).
$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
if (!preg_match('/^Bearer\s+(\S+)$/', $auth, $m)) {
    respond(401, ['error' => 'Missing session token']);
}
$token = verify_session_token($m[1]);
if ($token === null) {
    respond(401, ['error' => 'Invalid session token']);
}
$shop = shop_domain((string) $token['dest']);

$body = json_decode((string) file_get_contents('php://input'), true);
$answer = is_array($body) ? ($body['answer'] ?? '') : '';
if (!in_array($answer, SURVEY_ANSWERS, true)) {
    respond(400, ['error' => 'Invalid answer']);
}
$otherText = null;
if ($answer === 'other') {
    $otherText = mb_substr(trim((string) ($body['otherText'] ?? '')), 0, 200) ?: null;
}
$orderId = mb_substr((string) ($body['orderId'] ?? ''), 0, 100) ?: null;

$pdo = db();
$now = gmdate('Y-m-d H:i:s');
if ($orderId !== null) {
    // One answer per order: a second submission replaces the first.
    $pdo->beginTransaction();
    $find = $pdo->prepare('SELECT id FROM survey_responses WHERE shop = ? AND order_id = ?');
    $find->execute([$shop, $orderId]);
    $id = $find->fetchColumn();
    if ($id) {
        $pdo->prepare('UPDATE survey_responses SET answer = ?, other_text = ?, updated_at = ? WHERE id = ?')
            ->execute([$answer, $otherText, $now, $id]);
    } else {
        $pdo->prepare('INSERT INTO survey_responses (shop, order_id, answer, other_text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([$shop, $orderId, $answer, $otherText, $now, $now]);
    }
    $pdo->commit();
} else {
    $pdo->prepare('INSERT INTO survey_responses (shop, order_id, answer, other_text, created_at, updated_at) VALUES (?, NULL, ?, ?, ?, ?)')
        ->execute([$shop, $answer, $otherText, $now, $now]);
}

respond(200, ['ok' => true]);
