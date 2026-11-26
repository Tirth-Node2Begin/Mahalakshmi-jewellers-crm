<?php

declare(strict_types=1);

namespace CRM\Middleware;

use CRM\Auth\AuthException;
use CRM\Core\Request;
use CRM\Database\Database;

/** DB-backed fixed-window rate limiting keyed by sha256(bucket|ip). */
final class RateLimitMiddleware
{
    public static function check(string $bucket, int $maxAttempts, int $windowSeconds): void
    {
        $key = hash('sha256', $bucket . '|' . Request::ip());

        Database::transaction(static function () use ($key, $bucket, $maxAttempts, $windowSeconds): void {
            $row = Database::fetchOne(
                'SELECT * FROM api_rate_limits WHERE rate_key = :k LIMIT 1 FOR UPDATE',
                ['k' => $key]
            );

            if ($row === null) {
                Database::insert('api_rate_limits', [
                    'rate_key' => $key,
                    'bucket' => substr($bucket, 0, 60),
                    'attempts' => 1,
                    'window_started_at' => date('Y-m-d H:i:s'),
                ]);
                return;
            }

            $windowExpired = (strtotime((string) $row['window_started_at']) + $windowSeconds) < time();
            if ($windowExpired) {
                Database::execute(
                    'UPDATE api_rate_limits SET attempts = 1, window_started_at = NOW() WHERE id = :id',
                    ['id' => $row['id']]
                );
                return;
            }

            if ((int) $row['attempts'] >= $maxAttempts) {
                throw new AuthException('Too many attempts. Try again later.', 429);
            }
            Database::execute('UPDATE api_rate_limits SET attempts = attempts + 1 WHERE id = :id', ['id' => $row['id']]);
        });
    }

    /** Clear the caller's window after a successful attempt (e.g. correct login). */
    public static function reset(string $bucket): void
    {
        $key = hash('sha256', $bucket . '|' . Request::ip());
        Database::execute('DELETE FROM api_rate_limits WHERE rate_key = :k', ['k' => $key]);
    }
}
