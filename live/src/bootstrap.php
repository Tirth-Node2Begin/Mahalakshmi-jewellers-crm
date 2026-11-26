<?php

declare(strict_types=1);

/**
 * LeadSpark CRM bootstrap — PSR-4 autoloader for the CRM\ namespace,
 * environment loading, timezone, and error handling. Required by every
 * entry point (api_bootstrap.php, seed.php, cron scripts).
 */

define('CRM_ROOT', dirname(__DIR__));
define('CRM_SRC', __DIR__);

spl_autoload_register(static function (string $class): void {
    if (!str_starts_with($class, 'CRM\\')) {
        return;
    }
    $relative = substr($class, 4); // strip "CRM\"
    $path = CRM_SRC . DIRECTORY_SEPARATOR . str_replace('\\', DIRECTORY_SEPARATOR, $relative) . '.php';
    if (is_file($path)) {
        require $path;
    }
});

CRM\Core\Env::load(CRM_ROOT . DIRECTORY_SEPARATOR . '.env');

date_default_timezone_set(CRM\Core\Env::get('TIMEZONE', 'Asia/Kolkata'));

CRM\Core\ErrorHandler::register();
