<?php

declare(strict_types=1);

namespace CRM\Support;

use CRM\Auth\AuthUser;
use CRM\Auth\PermissionService;

/**
 * data_scope='own' visibility predicates (the branch-free replacement for the
 * old CRM's branch scoping). Returns [sqlFragment, params]. The fragment is
 * always safe to append with AND.
 */
final class ScopeSql
{
    /**
     * Ownable resources (customers, …):
     *   assigned_to = me OR created_by = me
     * @return array{0:string,1:array<string,int>}
     */
    public static function owned(AuthUser $user, string $alias): array
    {
        if (PermissionService::dataScope($user) === 'all') {
            return ['1=1', []];
        }
        return [
            "($alias.assigned_to = :scope_uid_a OR $alias.created_by = :scope_uid_b)",
            ['scope_uid_a' => $user->id, 'scope_uid_b' => $user->id],
        ];
    }

    /**
     * Scope a resource through a parent it belongs to (planning/08 §1).
     * Documented contract: ownedVia($user, 'customers c', 'i.customer_id') — the
     * parent alias carries its own table+alias, and $fkExpr is the child's FK to it.
     * Yields: created-by-me OR belongs-to a parent (customer) I own.
     *
     * @param string $parentTableAlias e.g. 'customers c' (declares alias 'c')
     * @param string $fkExpr           e.g. 'i.customer_id' (child FK to the parent PK)
     * @param string $childAlias       the child alias whose created_by is checked (default 'i')
     * @return array{0:string,1:array<string,int>}
     */
    public static function ownedVia(AuthUser $user, string $parentTableAlias, string $fkExpr, string $childAlias = 'i'): array
    {
        if (PermissionService::dataScope($user) === 'all') {
            return ['1=1', []];
        }
        // derive the parent alias (last whitespace-separated token of "table alias")
        $parts = preg_split('/\s+/', trim($parentTableAlias)) ?: [];
        $parentAlias = end($parts) ?: 'p';

        return [
            "($childAlias.created_by = :scope_uid_a OR EXISTS (
                SELECT 1 FROM $parentTableAlias
                WHERE $parentAlias.id = $fkExpr
                  AND ($parentAlias.assigned_to = :scope_uid_b OR $parentAlias.created_by = :scope_uid_c)
            ))",
            ['scope_uid_a' => $user->id, 'scope_uid_b' => $user->id, 'scope_uid_c' => $user->id],
        ];
    }
}
