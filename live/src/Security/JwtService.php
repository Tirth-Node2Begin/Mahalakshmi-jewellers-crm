<?php

declare(strict_types=1);

namespace CRM\Security;

use CRM\Auth\AuthException;
use CRM\Core\Env;

/** Minimal, dependency-free HS256 JWT implementation. */
final class JwtService
{
    public static function issue(array $claims, int $ttlSeconds): string
    {
        $now = time();
        $payload = array_merge([
            'iss' => Env::get('JWT_ISSUER', 'leadspark-crm'),
            'aud' => Env::get('JWT_AUDIENCE', 'leadspark-crm-web'),
            'iat' => $now,
            'nbf' => $now,
            'exp' => $now + $ttlSeconds,
            'jti' => bin2hex(random_bytes(8)),
        ], $claims);

        $header = self::b64(json_encode(['alg' => 'HS256', 'typ' => 'JWT'], JSON_UNESCAPED_SLASHES));
        $body = self::b64(json_encode($payload, JSON_UNESCAPED_SLASHES));
        $signature = self::b64(hash_hmac('sha256', "$header.$body", self::secret(), true));

        return "$header.$body.$signature";
    }

    /** @return array<string,mixed> verified claims */
    public static function verify(string $jwt): array
    {
        $parts = explode('.', $jwt);
        if (count($parts) !== 3) {
            throw new AuthException('Invalid token.', 401);
        }
        [$header, $body, $signature] = $parts;
        $expected = self::b64(hash_hmac('sha256', "$header.$body", self::secret(), true));
        if (!hash_equals($expected, $signature)) {
            throw new AuthException('Invalid token signature.', 401);
        }
        $claims = json_decode(self::unb64($body), true);
        if (!is_array($claims)) {
            throw new AuthException('Invalid token payload.', 401);
        }
        $now = time();
        if (($claims['nbf'] ?? 0) > $now + 30 || ($claims['exp'] ?? 0) < $now) {
            throw new AuthException('Token expired.', 401);
        }
        if (($claims['iss'] ?? '') !== Env::get('JWT_ISSUER', 'leadspark-crm')
            || ($claims['aud'] ?? '') !== Env::get('JWT_AUDIENCE', 'leadspark-crm-web')) {
            throw new AuthException('Token audience mismatch.', 401);
        }
        return $claims;
    }

    private static function secret(): string
    {
        $secret = Env::get('JWT_ACCESS_SECRET');
        if ($secret === null || $secret === '' || $secret === 'CHANGE_ME_64_HEX') {
            throw new AuthException('JWT secret is not configured.', 500);
        }
        return $secret;
    }

    private static function b64(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function unb64(string $data): string
    {
        $decoded = base64_decode(strtr($data, '-_', '+/'), true);
        return $decoded === false ? '' : $decoded;
    }
}
