<?php

declare(strict_types=1);

namespace CRM\Core;

final class ErrorHandler
{
    public static function register(): void
    {
        ini_set('display_errors', '0');
        ini_set('log_errors', '1');
        error_reporting(E_ALL);

        set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
            if (!(error_reporting() & $severity)) {
                return false; // respect @-suppression
            }
            throw new \ErrorException($message, 0, $severity, $file, $line);
        });
    }
}
