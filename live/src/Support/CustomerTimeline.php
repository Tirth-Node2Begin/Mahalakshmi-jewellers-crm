<?php

declare(strict_types=1);

namespace CRM\Support;

use CRM\Database\Database;

/** Writes customer_events rows — the customer detail timeline (planning/06 §1). */
final class CustomerTimeline
{
    public static function log(
        int $customerId,
        string $eventType,
        ?string $description = null,
        ?string $refTable = null,
        ?int $refId = null,
        ?int $userId = null
    ): void {
        try {
            Database::insert('customer_events', [
                'customer_id' => $customerId,
                'event_type' => substr($eventType, 0, 60),
                'description' => $description !== null ? substr($description, 0, 500) : null,
                'ref_table' => $refTable !== null ? substr($refTable, 0, 40) : null,
                'ref_id' => $refId,
                'created_by' => $userId,
            ]);
        } catch (\Throwable) {
            // best-effort
        }
    }
}
