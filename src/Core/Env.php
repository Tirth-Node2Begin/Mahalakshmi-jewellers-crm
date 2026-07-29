<?php

declare(strict_types=1);

namespace CRM\Core;

final class Env
{
    /** @var array<string,string> */
    private static array $vars = [];
    private static bool $loaded = false;

    public static function load(string $path): void
    {
        if (self::$loaded) {
            return;
        }
        self::$loaded = true;

        if (!is_file($path)) {
            return; // fall back to real environment only
        }
        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }
            $pos = strpos($line, '=');
            if ($pos === false) {
                continue;
            }
            $key = trim(substr($line, 0, $pos));
            $value = trim(substr($line, $pos + 1));
            // strip inline comments only when preceded by whitespace
            if (($hash = strpos($value, ' #')) !== false) {
                $value = rtrim(substr($value, 0, $hash));
            }
            $value = trim($value, "\"'");
            if ($key !== '') {
                self::$vars[$key] = $value;
            }
        }
    }

    public static function get(string $key, ?string $default = null): ?string
    {
        $real = getenv($key);
        if ($real !== false && $real !== '') {
            return $real;
        }
        return self::$vars[$key] ?? $default;
    }

    public static function int(string $key, int $default): int
    {
        $value = self::get($key);
        return is_numeric($value) ? (int) $value : $default;
    }

    public static function bool(string $key, bool $default = false): bool
    {
        $value = self::get($key);
        if ($value === null || $value === '') {
            return $default;
        }
        return in_array(strtolower($value), ['1', 'true', 'yes', 'on'], true);
    }

    /** @return string[] */
    public static function csv(string $key): array
    {
        $value = self::get($key, '');
        if ($value === null || trim($value) === '') {
            return [];
        }
        return array_values(array_filter(array_map('trim', explode(',', $value))));
    }
}
