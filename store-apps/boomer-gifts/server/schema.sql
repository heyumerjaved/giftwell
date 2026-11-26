-- lib.php runs this automatically on MySQL (CREATE TABLE IF NOT EXISTS), so no manual step is needed.
CREATE TABLE IF NOT EXISTS survey_responses (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  shop VARCHAR(255) NOT NULL,
  order_id VARCHAR(100) NULL,
  answer VARCHAR(32) NOT NULL,
  other_text VARCHAR(200) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY shop_order (shop, order_id),
  KEY shop_created (shop, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
