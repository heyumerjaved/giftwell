<?php
/**
 * End-to-end test of the PHP server: copies it to a temp folder with a test
 * config and a SQLite database, starts `php -S`, and sends real HTTP requests.
 * Run: php store-apps/boomer-gifts/tests/server-test.php
 */

declare(strict_types=1);

const SECRET = 'test-secret';
const CLIENT_ID = 'test-client-id';
const SHOP = 'boomer-gifts.myshopify.com';
const PORT = 8799;

$dir = sys_get_temp_dir() . '/bg-survey-test-' . getmypid();
mkdir($dir);
foreach (['lib.php', 'survey.php', 'index.php'] as $f) {
    copy(__DIR__ . "/../server/$f", "$dir/$f");
}
$dbPath = "$dir/test.sqlite";
file_put_contents("$dir/config.php", '<?php return ' . var_export([
    'client_id' => CLIENT_ID,
    'client_secret' => SECRET,
    'allowed_shops' => [SHOP],
    'db_dsn' => "sqlite:$dbPath",
], true) . ';');
// The server creates the table itself on first use; the test reads the same file.
$pdo = new PDO("sqlite:$dbPath");

$server = proc_open(['php', '-S', '127.0.0.1:' . PORT, '-t', $dir], [1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']], $pipes);
usleep(400000);

function b64url(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function jwt(array $over = [], string $secret = SECRET, string $alg = 'HS256'): string
{
    $now = time();
    $payload = array_merge(['dest' => SHOP, 'aud' => CLIENT_ID, 'exp' => $now + 60, 'nbf' => $now - 5, 'iat' => $now - 5], $over);
    $h = b64url(json_encode(['alg' => $alg, 'typ' => 'JWT']));
    $p = b64url(json_encode($payload));
    return "$h.$p." . b64url(hash_hmac('sha256', "$h.$p", $secret, true));
}
function req(string $method, string $path, ?string $token = null, ?array $body = null): array
{
    $h = ['Content-Type: application/json'];
    if ($token !== null) $h[] = "Authorization: Bearer $token";
    $ctx = stream_context_create(['http' => ['method' => $method, 'header' => implode("\r\n", $h),
        'content' => $body === null ? '' : json_encode($body), 'ignore_errors' => true]]);
    $out = @file_get_contents('http://127.0.0.1:' . PORT . $path, false, $ctx);
    preg_match('#HTTP/\S+ (\d+)#', $http_response_header[0] ?? '', $m);
    return [(int) ($m[1] ?? 0), (string) $out, $http_response_header ?? []];
}
function rows(): array { global $pdo; return $pdo->query('SELECT shop, order_id, answer, other_text FROM survey_responses ORDER BY id')->fetchAll(PDO::FETCH_ASSOC); }

$fails = 0;
function check(string $name, bool $ok): void { global $fails; echo ($ok ? "PASS " : "FAIL ") . $name . "\n"; if (!$ok) $fails++; }

$order = 'gid://shopify/OrderIdentity/1';
[$s, , $hdr] = req('OPTIONS', '/survey.php');
check('preflight returns 204 with CORS headers', $s === 204 && in_array('Access-Control-Allow-Origin: *', $hdr, true));
check('no token is rejected (401)', req('POST', '/survey.php', null, ['answer' => 'google'])[0] === 401);
check('wrong secret is rejected (401)', req('POST', '/survey.php', jwt([], 'nope'), ['answer' => 'google'])[0] === 401);
check('expired token is rejected (401)', req('POST', '/survey.php', jwt(['exp' => time() - 120]), ['answer' => 'google'])[0] === 401);
check('other app (aud) is rejected (401)', req('POST', '/survey.php', jwt(['aud' => 'someone-else']), ['answer' => 'google'])[0] === 401);
check('other shop is rejected (401)', req('POST', '/survey.php', jwt(['dest' => 'evil.myshopify.com']), ['answer' => 'google'])[0] === 401);
check('alg none is rejected (401)', req('POST', '/survey.php', jwt([], SECRET, 'none'), ['answer' => 'google'])[0] === 401);
check('unknown answer is rejected (400)', req('POST', '/survey.php', jwt(), ['answer' => 'tiktok'])[0] === 400);
check('nothing saved so far', ($pdo->query("SELECT name FROM sqlite_master WHERE name = 'survey_responses'")->fetchColumn() === false) || rows() === []);

check('valid answer is saved (200)', req('POST', '/survey.php', jwt(), ['answer' => 'pinterest', 'orderId' => $order])[0] === 200);
check('second answer for the same order replaces the first',
    req('POST', '/survey.php', jwt(), ['answer' => 'other', 'otherText' => '  A gift fair  ', 'orderId' => $order])[0] === 200
    && rows() === [['shop' => SHOP, 'order_id' => $order, 'answer' => 'other', 'other_text' => 'A gift fair']]);
check('dest as a full URL still maps to the shop',
    req('POST', '/survey.php', jwt(['dest' => 'https://' . SHOP]), ['answer' => 'ai', 'orderId' => 'o2'])[0] === 200
    && rows()[1]['shop'] === SHOP);
check('otherText is dropped unless the answer is other',
    req('POST', '/survey.php', jwt(), ['answer' => 'google', 'otherText' => 'x', 'orderId' => 'o3'])[0] === 200
    && rows()[2]['other_text'] === null);

// Admin page: signed like Shopify signs the app URL.
$q = ['embedded' => '1', 'host' => 'YWRtaW4uc2hvcGlmeS5jb20vc3RvcmUvYm9vbWVyLWdpZnRz', 'shop' => SHOP, 'timestamp' => (string) time()];
ksort($q);
$signed = $q + ['hmac' => hash_hmac('sha256', urldecode(http_build_query($q)), SECRET)];
[$s, $html, $hdr] = req('GET', '/index.php?' . http_build_query($signed));
check('admin page shows results for a signed request', $s === 200 && str_contains($html, '3 answers') && str_contains($html, 'A gift fair'));
check('admin page sets frame-ancestors for the shop', (bool) array_filter($hdr, fn ($h) => str_contains($h, 'frame-ancestors https://admin.shopify.com https://' . SHOP)));
$tampered = $signed; $tampered['shop'] = 'evil.myshopify.com';
check('tampered admin request shows no data', !str_contains(req('GET', '/index.php?' . http_build_query($tampered))[1], 'gift fair'));
check('unsigned admin request shows no data', !str_contains(req('GET', '/index.php?shop=' . SHOP)[1], 'gift fair'));
check('other text is HTML-escaped',
    req('POST', '/survey.php', jwt(), ['answer' => 'other', 'otherText' => '<script>x</script>', 'orderId' => 'o4'])[0] === 200
    && str_contains(req('GET', '/index.php?' . http_build_query($signed))[1], '&lt;script&gt;'));

proc_terminate($server);
array_map('unlink', glob("$dir/*"));
rmdir($dir);
echo $fails ? "\n$fails failed\n" : "\nAll passed\n";
exit($fails ? 1 : 0);
