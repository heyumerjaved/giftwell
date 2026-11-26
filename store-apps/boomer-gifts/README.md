# Boomer Gifts survey

Giftwell's thank-you page survey, adapted to run on a live store: [boomergifts.com](https://www.boomergifts.com).

The store is on Shopify's Basic plan. On Basic, checkout extensions only work on the thank-you and order status pages, and custom-app Functions need Plus, so of Giftwell's features only the survey can run there. Instead of hosting the full Node app, the server is two PHP files on existing shared hosting (cPanel, PHP 8.4, no Node), at `umerconnects.com/boomer-survey/`. Answers go to a SQLite file outside the web folder, so there's no database user to manage. MySQL works too: set its DSN in `config.php` and the table is created automatically.

| Part | File | What it does |
|---|---|---|
| Survey | `extensions/thank-you-survey` | "How did you hear about us?" on the thank-you page. Sends the answer with Shopify's checkout session token. |
| Endpoint | `server/survey.php` | Verifies the session token (HS256, signed with the app's client secret; checks expiry, audience and shop), then saves one answer per order. |
| Results | `server/index.php` | The app's page in the Shopify admin. Verifies Shopify's signed app URL (hmac), then shows answer counts for the last 30 days and all time, plus the latest "Other" replies. |
| Shared | `server/lib.php` | Config, database and verification helpers. |

The app asks for no access scopes: the session token already says which shop an answer came from.

## Tests

```bash
php tests/server-test.php
```

Starts the PHP server locally with a SQLite database and sends real requests: valid answers, missing, forged, expired, wrong-app and wrong-shop tokens, `alg: none`, unknown answers, one answer per order, the signed admin page, tampered admin links and HTML escaping. 18 checks.

## Setup

1. **Hosting:** any PHP 8.1+ host. Upload `survey.php`, `index.php`, `lib.php` and `.htaccess` from `server/` to their own folder. The folder's `.htaccess` has its own rewrite rules, so it also works under a site whose root `.htaccess` blocks PHP. Create a data folder outside the web root for the SQLite file.
2. **App:** create the app in the Dev Dashboard (no scopes; app URL = the server folder) and put its `client_id` in `shopify.app.toml`. Approve **Network access** for it.
3. **Config:** copy `config.sample.php` to `config.php` on the server and fill it in. It holds the client secret, so it's never committed and `.htaccess` blocks it from the web. Set the server URL in `extensions/thank-you-survey/src/config.js`.
4. **Test on a development store:** `shopify app dev --store <dev-store>`, place a test order, and answer the survey. The answer should appear on the app's page.
5. **Release:**
   - Run `shopify app deploy`.
   - Create a custom distribution link for the store in the Dev Dashboard, then install the app.
   - Add the survey block to the thank-you page in the checkout editor.
