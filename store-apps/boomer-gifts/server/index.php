<?php
/**
 * The app's page in the Shopify admin (the app URL). Shows the survey results.
 * Shopify opens it inside the admin with a signed query string (hmac), which is
 * checked before anything is shown.
 */

declare(strict_types=1);
require __DIR__ . '/lib.php';

$shop = verify_admin_request($_GET);

// Only the shop's own admin may frame this page.
$frameShop = $shop ? " https://$shop" : '';
header("Content-Security-Policy: frame-ancestors https://admin.shopify.com$frameShop;");
header('Content-Type: text/html; charset=utf-8');

$e = fn ($s) => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');

$counts = array_fill_keys(SURVEY_ANSWERS, ['all' => 0, 'recent' => 0]);
$others = [];
$total = 0;
$recentTotal = 0;
if ($shop) {
    $since = gmdate('Y-m-d H:i:s', time() - 30 * 86400);
    $q = db()->prepare(
        'SELECT answer, COUNT(*) AS n, SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS recent
         FROM survey_responses WHERE shop = ? GROUP BY answer'
    );
    $q->execute([$since, $shop]);
    foreach ($q->fetchAll() as $row) {
        if (isset($counts[$row['answer']])) {
            $counts[$row['answer']] = ['all' => (int) $row['n'], 'recent' => (int) $row['recent']];
            $total += (int) $row['n'];
            $recentTotal += (int) $row['recent'];
        }
    }
    $o = db()->prepare(
        "SELECT other_text, created_at FROM survey_responses
         WHERE shop = ? AND answer = 'other' AND other_text IS NOT NULL
         ORDER BY created_at DESC LIMIT 10"
    );
    $o->execute([$shop]);
    $others = $o->fetchAll();
    uasort($counts, fn ($a, $b) => $b['all'] <=> $a['all']);
}
$max = max(1, ...array_column($counts, 'all'));
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="shopify-api-key" content="<?= $e(config()['client_id']) ?>">
<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
<title>How customers found you</title>
<style>
  body { margin: 0; padding: 20px; background: #f1f1f1; color: #303030;
         font: 14px/1.45 -apple-system, BlinkMacSystemFont, "San Francisco", "Segoe UI", Roboto, sans-serif; }
  .card { background: #fff; border-radius: 12px; padding: 16px 20px; max-width: 720px;
          box-shadow: 0 1px 0 rgba(0,0,0,.07), 0 0 0 1px rgba(0,0,0,.05); margin-bottom: 16px; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 0 0 10px; }
  .sub { color: #616161; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-weight: 600; color: #616161; font-size: 12px; padding: 0 0 8px; }
  th.n, td.n { text-align: right; width: 90px; font-variant-numeric: tabular-nums; }
  td { padding: 7px 0; border-top: 1px solid #ebebeb; vertical-align: middle; }
  .bar { height: 8px; border-radius: 4px; background: #f1ece4; overflow: hidden; margin-top: 5px; }
  .bar i { display: block; height: 100%; background: #7b1c2a; }
  ul { margin: 0; padding-left: 18px; } li { margin: 4px 0; }
  .muted { color: #616161; }
</style>
</head>
<body>
<?php if (!$shop): ?>
  <div class="card"><h1>Open this app from your Shopify admin</h1>
  <p class="sub">This page only works inside the Shopify admin.</p></div>
<?php else: ?>
  <div class="card">
    <h1>How customers found you</h1>
    <p class="sub">
      <?= $total ?> <?= $total === 1 ? 'answer' : 'answers' ?> from the thank-you page survey,
      <?= $recentTotal ?> in the last 30 days.
    </p>
    <table>
      <thead><tr><th>Answer</th><th class="n">Last 30 days</th><th class="n">All time</th></tr></thead>
      <tbody>
      <?php foreach ($counts as $answer => $c): ?>
        <tr>
          <td><?= $e(ANSWER_LABELS[$answer]) ?>
            <div class="bar" role="img" aria-label="<?= $e(ANSWER_LABELS[$answer] . ': ' . $c['all']) ?>">
              <i style="width: <?= round($c['all'] / $max * 100, 1) ?>%"></i></div></td>
          <td class="n"><?= $c['recent'] ?></td>
          <td class="n"><?= $c['all'] ?></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
  <div class="card">
    <h2>Latest “Other” answers</h2>
    <?php if (!$others): ?>
      <p class="muted">None yet.</p>
    <?php else: ?>
      <ul>
      <?php foreach ($others as $row): ?>
        <li>“<?= $e($row['other_text']) ?>” <span class="muted">· <?= $e(substr($row['created_at'], 0, 10)) ?></span></li>
      <?php endforeach; ?>
      </ul>
    <?php endif; ?>
  </div>
<?php endif; ?>
</body>
</html>
