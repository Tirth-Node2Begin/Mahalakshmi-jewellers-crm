<?php

declare(strict_types=1);

namespace CRM\Core;

final class Request
{
    /** @var array<string,mixed>|null */
    private static ?array $jsonCache = null;
    private static bool $jsonParsed = false;

    public static function method(): string
    {
        return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    }

    public static function isMutation(): bool
    {
        return in_array(self::method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true);
    }

    /** Parsed JSON body (cached). Falls back to $_POST for multipart forms. */
    public static function json(): array
    {
        if (self::$jsonParsed) {
            return self::$jsonCache ?? [];
        }
        self::$jsonParsed = true;

        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
        if (str_contains($contentType, 'multipart/form-data') || str_contains($contentType, 'application/x-www-form-urlencoded')) {
            self::$jsonCache = $_POST;
            return self::$jsonCache;
        }
        $raw = file_get_contents('php://input');
        if ($raw === false || $raw === '') {
            self::$jsonCache = [];
            return self::$jsonCache;
        }
        $decoded = json_decode($raw, true);
        self::$jsonCache = is_array($decoded) ? $decoded : [];
        return self::$jsonCache;
    }

    public static function header(string $name): ?string
    {
        $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
        $value = $_SERVER[$key] ?? null;
        return is_string($value) && $value !== '' ? $value : null;
    }

    public static function bearerToken(): ?string
    {
        $auth = self::header('Authorization');
        if ($auth !== null && preg_match('/^Bearer\s+(\S+)$/i', $auth, $m)) {
            return $m[1];
        }
        return null;
    }

    public static function cookie(string $name): ?string
    {
        $value = $_COOKIE[$name] ?? null;
        return is_string($value) && $value !== '' ? $value : null;
    }

    public static function ip(): string
    {
        return (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
    }

    public static function userAgent(): string
    {
        return substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255);
    }

    public static function origin(): ?string
    {
        return self::header('Origin');
    }
}
