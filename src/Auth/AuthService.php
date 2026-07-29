<?php

declare(strict_types=1);

namespace CRM\Auth;

use CRM\Core\Env;
use CRM\Core\Request;
use CRM\Database\Database;
use CRM\Security\AuditLogger;
use CRM\Security\Cookie;
use CRM\Security\CsrfToken;
use CRM\Security\JwtService;

final class AuthService
{
    /**
     * Verify credentials (username OR email OR mobile), create a session,
     * set auth cookies. Returns the public user payload + csrf token.
     */
    public static function login(string $identifier, string $password, bool $rememberMe): array
    {
        $user = Database::fetchOne(
            'SELECT * FROM users
             WHERE (username = :u OR email = :e OR mobile = :m) AND is_active = 1
             ORDER BY (username = :u2) DESC
             LIMIT 1',
            ['u' => $identifier, 'e' => $identifier, 'm' => $identifier, 'u2' => $identifier]
        );

        if ($user === null || !password_verify($password, $user['password_hash'])) {
            AuditLogger::log('login.failed', $user['id'] ?? null, ['identifier' => substr($identifier, 0, 60)]);
            throw new AuthException('Invalid username or password.', 401);
        }

        if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
            Database::execute('UPDATE users SET password_hash = :h WHERE id = :id', [
                'h' => password_hash($password, PASSWORD_DEFAULT),
                'id' => $user['id'],
            ]);
        }

        $refreshTtl = $rememberMe
            ? Env::int('REFRESH_TTL_REMEMBER', 7776000)
            : Env::int('REFRESH_TTL', 2592000);

        $refreshToken = bin2hex(random_bytes(48));
        $sessionId = Database::insert('auth_sessions', [
            'user_id' => (int) $user['id'],
            'refresh_token_hash' => hash('sha256', $refreshToken),
            'ip_address' => Request::ip(),
            'user_agent' => Request::userAgent(),
            'expires_at' => date('Y-m-d H:i:s', time() + $refreshTtl),
        ]);

        Database::execute('UPDATE users SET last_login_at = NOW() WHERE id = :id', ['id' => $user['id']]);

        $authUser = self::hydrate($user, $sessionId);
        self::setAuthCookies($authUser, $refreshToken, $refreshTtl);
        $csrf = CsrfToken::issue();

        AuditLogger::log('login.success', $authUser->id);

        return [
            'user' => $authUser->toArray(),
            'csrf_token' => $csrf,
            'expires_in' => Env::int('JWT_ACCESS_TTL', 900),
            'must_change_password' => $authUser->mustChangePassword,
        ];
    }

    /**
     * Rotate the refresh token (with reuse detection): a token matching a
     * session's PREVIOUS hash means it was already rotated once — treat as
     * theft and revoke every session for that user.
     */
    public static function refresh(): array
    {
        $token = Request::cookie(Cookie::REFRESH);
        if ($token === null) {
            throw new AuthException('No refresh token.', 401);
        }
        $hash = hash('sha256', $token);

        $rotated = Database::transaction(static function () use ($hash): ?array {
            $session = Database::fetchOne(
                'SELECT * FROM auth_sessions WHERE refresh_token_hash = :h LIMIT 1 FOR UPDATE',
                ['h' => $hash]
            );
            if ($session === null) {
                return null; // handled outside the transaction (reuse check must COMMIT)
            }
            if ($session['revoked_at'] !== null || strtotime((string) $session['expires_at']) < time()) {
                throw new AuthException('Session expired.', 401);
            }

            $user = Database::fetchOne('SELECT * FROM users WHERE id = :id AND is_active = 1', ['id' => $session['user_id']]);
            if ($user === null) {
                throw new AuthException('Account disabled.', 401);
            }

            $newToken = bin2hex(random_bytes(48));
            Database::execute(
                'UPDATE auth_sessions
                 SET previous_refresh_token_hash = refresh_token_hash,
                     refresh_token_hash = :new, last_used_at = NOW()
                 WHERE id = :id',
                ['new' => hash('sha256', $newToken), 'id' => $session['id']]
            );

            return ['session' => $session, 'user' => $user, 'newToken' => $newToken];
        });

        if ($rotated === null) {
            // Reuse detection OUTSIDE any transaction so the breach revocation
            // commits even though we throw right after it.
            $stolen = Database::fetchOne(
                'SELECT user_id FROM auth_sessions WHERE previous_refresh_token_hash = :h LIMIT 1',
                ['h' => $hash]
            );
            if ($stolen !== null) {
                Database::execute(
                    "UPDATE auth_sessions SET revoked_at = NOW(), revoke_reason = 'refresh_reuse'
                     WHERE user_id = :uid AND revoked_at IS NULL",
                    ['uid' => $stolen['user_id']]
                );
                AuditLogger::log('refresh.reuse', (int) $stolen['user_id']);
            }
            throw new AuthException('Session expired.', 401);
        }

        $session = $rotated['session'];
        $remainingTtl = max(60, strtotime((string) $session['expires_at']) - time());
        $authUser = self::hydrate($rotated['user'], (int) $session['id']);
        self::setAuthCookies($authUser, $rotated['newToken'], $remainingTtl);

        return [
            'user' => $authUser->toArray(),
            'expires_in' => Env::int('JWT_ACCESS_TTL', 900),
        ];
    }

    public static function logout(): void
    {
        $token = Request::cookie(Cookie::REFRESH);
        if ($token !== null) {
            Database::execute(
                "UPDATE auth_sessions SET revoked_at = NOW(), revoke_reason = 'logout'
                 WHERE refresh_token_hash = :h AND revoked_at IS NULL",
                ['h' => hash('sha256', $token)]
            );
        }
        Cookie::clear(Cookie::ACCESS);
        Cookie::clear(Cookie::REFRESH, Cookie::REFRESH_PATH);
        Cookie::clear(Cookie::CSRF);
    }

    /** Validate the access JWT + confirm its session is still live. */
    public static function userFromAccessToken(string $jwt): AuthUser
    {
        $claims = JwtService::verify($jwt);
        $userId = (int) ($claims['sub'] ?? 0);
        $sessionId = (int) ($claims['sid'] ?? 0);

        $session = Database::fetchOne(
            'SELECT id, revoked_at, expires_at FROM auth_sessions WHERE id = :id AND user_id = :uid',
            ['id' => $sessionId, 'uid' => $userId]
        );
        if ($session === null || $session['revoked_at'] !== null || strtotime((string) $session['expires_at']) < time()) {
            throw new AuthException('Session expired.', 401);
        }

        $user = Database::fetchOne('SELECT * FROM users WHERE id = :id AND is_active = 1', ['id' => $userId]);
        if ($user === null) {
            throw new AuthException('Account disabled.', 401);
        }
        return self::hydrate($user, $sessionId);
    }

    /** @return string[] active role slugs, most privileged first */
    public static function resolveUserRoles(int $userId): array
    {
        $rows = Database::fetchAll(
            'SELECT r.name FROM user_role_assignments ura
             JOIN roles r ON r.id = ura.role_id
             WHERE ura.user_id = :uid AND ura.is_active = 1
               AND (ura.expires_at IS NULL OR ura.expires_at > NOW())
               AND r.is_active = 1
             ORDER BY r.id ASC',
            ['uid' => $userId]
        );
        $roles = array_column($rows, 'name');
        return $roles === [] ? ['employee'] : $roles;
    }

    private static function hydrate(array $user, int $sessionId): AuthUser
    {
        return new AuthUser(
            id: (int) $user['id'],
            username: (string) $user['username'],
            fullName: (string) $user['full_name'],
            email: $user['email'] !== null ? (string) $user['email'] : null,
            sessionId: $sessionId,
            roles: self::resolveUserRoles((int) $user['id']),
            mustChangePassword: (bool) $user['must_change_password'],
            avatarColor: $user['avatar_color'] !== null ? (string) $user['avatar_color'] : null,
        );
    }

    private static function setAuthCookies(AuthUser $user, string $refreshToken, int $refreshTtl): void
    {
        $accessTtl = Env::int('JWT_ACCESS_TTL', 900);
        $jwt = JwtService::issue([
            'sub' => $user->id,
            'sid' => $user->sessionId,
            'username' => $user->username,
            'roles' => $user->roles,
        ], $accessTtl);

        Cookie::set(Cookie::ACCESS, $jwt, $accessTtl);
        Cookie::set(Cookie::REFRESH, $refreshToken, $refreshTtl, Cookie::REFRESH_PATH);
    }
}
