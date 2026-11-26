<?php

declare(strict_types=1);

namespace CRM\Database;

use CRM\Core\Env;
use PDO;

/**
 * Second connection to the public website's content database (`sejal_jewellers`).
 * The CRM is the single admin panel (Approach A): it writes here, the live
 * website reads the same tables. Host/port/user/pass fall back to the main DB
 * credentials when the WEB_DB_* overrides are blank.
 */
final class WebDb
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo === null) {
            $host = self::orMain('WEB_DB_HOST', 'DB_HOST', '127.0.0.1');
            $port = self::orMain('WEB_DB_PORT', 'DB_PORT', '3306');
            $user = self::orMain('WEB_DB_USER', 'DB_USER', 'root');
            $pass = self::orMain('WEB_DB_PASS', 'DB_PASS', '') ?? '';
            $name = Env::get('WEB_DB_NAME', 'sejal_jewellers');
            if ($name === null || $name === '') {
                $name = 'sejal_jewellers';
            }
            $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, $port, $name);
            self::$pdo = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        }
        return self::$pdo;
    }

    /** Read the override key; fall back to the main-DB key, then the default. */
    private static function orMain(string $webKey, string $mainKey, string $default): string
    {
        $val = Env::get($webKey, '');
        if ($val === null || $val === '') {
            $val = Env::get($mainKey, $default);
        }
        return (string) ($val ?? $default);
    }

    public static function fetchOne(string $sql, array $params = []): ?array
    {
        $stmt = self::pdo()->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    public static function fetchAll(string $sql, array $params = []): array
    {
        $stmt = self::pdo()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public static function fetchValue(string $sql, array $params = []): mixed
    {
        $stmt = self::pdo()->prepare($sql);
        $stmt->execute($params);
        $value = $stmt->fetchColumn();
        return $value === false ? null : $value;
    }

    public static function execute(string $sql, array $params = []): int
    {
        $stmt = self::pdo()->prepare($sql);
        $stmt->execute($params);
        return $stmt->rowCount();
    }

    public static function insert(string $table, array $data): int
    {
        $columns = array_keys($data);
        $placeholders = array_map(static fn (string $c): string => ':' . $c, $columns);
        $sql = sprintf(
            'INSERT INTO %s (%s) VALUES (%s)',
            $table,
            implode(', ', array_map(static fn (string $c): string => "`$c`", $columns)),
            implode(', ', $placeholders)
        );
        $stmt = self::pdo()->prepare($sql);
        $stmt->execute($data);
        return (int) self::pdo()->lastInsertId();
    }

    /** @param callable():mixed $fn */
    public static function transaction(callable $fn): mixed
    {
        $pdo = self::pdo();
        if ($pdo->inTransaction()) {
            return $fn();
        }
        $pdo->beginTransaction();
        try {
            $result = $fn();
            $pdo->commit();
            return $result;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }
}
