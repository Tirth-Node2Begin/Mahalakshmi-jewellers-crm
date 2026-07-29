<?php

declare(strict_types=1);

namespace CRM\Core;

final class Response
{
    private const JSON_FLAGS = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR;

    /** Send `{success:true, ...payload}` and exit. */
    public static function success(array $payload = [], int $status = 200): never
    {
        self::emit(array_merge(['success' => true], $payload), $status);
    }

    /** Send `{success:false, error:{code,message,details?}}` and exit. */
    public static function error(string $code, string $message, int $status = 400, ?array $details = null): never
    {
        $error = ['code' => $code, 'message' => $message];
        if ($details !== null) {
            $error['details'] = $details;
        }
        self::emit(['success' => false, 'error' => $error], $status);
    }

    private static function emit(array $body, int $status): never
    {
        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode($body, self::JSON_FLAGS);
        exit;
    }
}
