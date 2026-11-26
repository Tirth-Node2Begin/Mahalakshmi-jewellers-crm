<?php

declare(strict_types=1);

namespace CRM\Support;

use CRM\Database\Database;

/** In-app notification producer. Best-effort — failures never break the caller. */
final class Notify
{
    public static function send(
        int $userId,
        string $type,
        string $title,
        string $body = '',
        ?string $entityType = null,
        ?int $entityId = null,
        ?string $linkUrl = null
    ): void {
        try {
            Database::insert('notifications', [
                'user_id' => $userId,
                'type' => substr($type, 0, 80),
                'title' => substr($title, 0, 150),
                'body' => substr($body, 0, 500),
                'entity_type' => $entityType !== null ? substr($entityType, 0, 40) : null,
                'entity_id' => $entityId,
                'link_url' => $linkUrl !== null ? substr($linkUrl, 0, 255) : null,
            ]);
        } catch (\Throwable) {
            // swallow
        }
    }

    /** Notify several users at once (deduplicated, skips invalid ids). */
    public static function sendMany(array $userIds, string $type, string $title, string $body = '', ?string $entityType = null, ?int $entityId = null, ?string $linkUrl = null): void
    {
        foreach (array_unique(array_filter(array_map('intval', $userIds))) as $id) {
            self::send($id, $type, $title, $body, $entityType, $entityId, $linkUrl);
        }
    }
}
