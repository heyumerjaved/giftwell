<?php
/**
 * Copy this file to config.php on the server and fill it in.
 * config.php holds secrets: it's ignored by git and blocked from the web by .htaccess.
 */
return [
    // From the Dev Dashboard: the app's Client ID and Client secret.
    'client_id' => 'YOUR_CLIENT_ID',
    'client_secret' => 'YOUR_CLIENT_SECRET',

    // Shops allowed to send answers and open the results page.
    'allowed_shops' => [
        'boomer-gifts.myshopify.com',
        'giftwell-dev.myshopify.com', // for testing; remove once live
    ],

    // SQLite: one file, no database user. Keep it outside the web folder.
    'db_dsn' => 'sqlite:/home/YOUR_USER/boomer-survey-data/survey.sqlite',

    // Or MySQL (the table is created automatically):
    // 'db_dsn' => 'mysql:host=localhost;dbname=YOUR_DB_NAME;charset=utf8mb4',
    // 'db_user' => 'YOUR_DB_USER',
    // 'db_password' => 'YOUR_DB_PASSWORD',
];
