<?php

declare(strict_types=1);

namespace CRM\Auth;

use CRM\Database\Database;

final class PermissionService
{
    /** @var array<int,string[]> per-request permission cache */
    private static array $cache = [];
    /** @var array<int,string> per-request scope cache */
    private static array $scopeCache = [];

    /** @return string[] `resource.action` strings (super_admin → ['*']) */
    public static function permissionsFor(AuthUser $user): array
    {
        if ($user->isSuperAdmin()) {
            return ['*'];
        }
        if (!isset(self::$cache[$user->id])) {
            $rows = Database::fetchAll(
                "SELECT DISTINCT CONCAT(p.resource, '.', p.action) AS permission
                 FROM user_role_assignments ura
                 JOIN roles r ON r.id = ura.role_id
                 JOIN role_permission_grants g ON g.role_id = r.id
                 JOIN permissions p ON p.id = g.permission_id
                 WHERE ura.user_id = :uid AND ura.is_active = 1
                   AND (ura.expires_at IS NULL OR ura.expires_at > NOW())
                   AND r.is_active = 1 AND p.is_active = 1",
                ['uid' => $user->id]
            );
            self::$cache[$user->id] = array_column($rows, 'permission');
        }
        return self::$cache[$user->id];
    }

    public static function can(AuthUser $user, string $permission): bool
    {
        if ($user->isSuperAdmin()) {
            return true;
        }
        foreach (self::permissionsFor($user) as $granted) {
            if (self::matches($granted, $permission)) {
                return true;
            }
        }
        return false;
    }

    public static function assert(AuthUser $user, string $permission): void
    {
        if (!self::can($user, $permission)) {
            throw new PermissionException("Missing permission: $permission");
        }
    }

    /** Effective data scope across active roles: any 'all' role wins. */
    public static function dataScope(AuthUser $user): string
    {
        if ($user->isSuperAdmin()) {
            return 'all';
        }
        if (!isset(self::$scopeCache[$user->id])) {
            $scopes = Database::fetchAll(
                'SELECT DISTINCT r.data_scope FROM user_role_assignments ura
                 JOIN roles r ON r.id = ura.role_id
                 WHERE ura.user_id = :uid AND ura.is_active = 1
                   AND (ura.expires_at IS NULL OR ura.expires_at > NOW())
                   AND r.is_active = 1',
                ['uid' => $user->id]
            );
            $values = array_column($scopes, 'data_scope');
            self::$scopeCache[$user->id] = in_array('all', $values, true) || $values === [] ? 'all' : 'own';
        }
        return self::$scopeCache[$user->id];
    }

    /** Wildcard matcher: '*' grants all; 'leads.*' grants every leads action. */
    private static function matches(string $granted, string $wanted): bool
    {
        if ($granted === '*' || $granted === $wanted) {
            return true;
        }
        if (str_ends_with($granted, '.*')) {
            return str_starts_with($wanted, substr($granted, 0, -1));
        }
        return false;
    }
}
