<?php

declare(strict_types=1);

namespace CRM\Support;

use CRM\Core\Request;
use CRM\Database\Database;

/** Business mutation trail → audit_logs (old/new JSON). Best-effort. */
final class Audit
{
    public static function log(
        ?int $userId,
        string $action,
        string $entityType,
        ?int $entityId,
        ?array $oldValues = null,
        ?array $newValues = null
    ): void {
        try {
            Database::insert('audit_logs', [
                'user_id' => $userId,
                'action' => substr($action, 0, 100),
                'entity_type' => substr($entityType, 0, 80),
                'entity_id' => $entityId,
                'old_values' => $oldValues === null ? null : json_encode($oldValues, JSON_UNESCAPED_UNICODE),
                'new_values' => $newValues === null ? null : json_encode($newValues, JSON_UNESCAPED_UNICODE),
                'ip_address' => Request::ip(),
            ]);
        } catch (\Throwable) {
            // never break the calling flow
        }
    }
}
