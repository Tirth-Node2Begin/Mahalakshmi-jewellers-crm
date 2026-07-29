<?php

declare(strict_types=1);

namespace CRM\Security;

use CRM\Core\Request;
use CRM\Database\Database;

/** Auth/security event trail → security_audit_logs. Best-effort: never breaks the caller. */
final class AuditLogger
{
    public static function log(string $event, ?int $userId = null, array $meta = []): void
    {
        try {
            Database::insert('security_audit_logs', [
                'user_id' => $userId,
                'event' => substr($event, 0, 60),
                'ip_address' => Request::ip(),
                'user_agent' => Request::userAgent(),
                'meta' => $meta === [] ? null : json_encode($meta, JSON_UNESCAPED_UNICODE),
            ]);
        } catch (\Throwable) {
            // swallow — auditing must never take down the request
        }
    }
}
