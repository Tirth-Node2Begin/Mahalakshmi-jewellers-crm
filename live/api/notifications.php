<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/Support/api_bootstrap.php';

use CRM\Core\Request;
use CRM\Core\Response;
use CRM\Database\Database;
use CRM\Validation\Validator;

$user = requireApiAuth();

if (Request::method() === 'GET') {
    $rows = Database::fetchAll(
        'SELECT id, type, title, body, entity_type, entity_id, link_url, is_read, created_at
         FROM notifications WHERE user_id = :u ORDER BY id DESC LIMIT 30',
        ['u' => $user->id]
    );
    $unread = (int) Database::fetchValue(
        'SELECT COUNT(*) FROM notifications WHERE user_id = :u AND is_read = 0',
        ['u' => $user->id]
    );
    Response::success(['notifications' => $rows, 'unread_count' => $unread]);
}

requireMethod('POST');
$body = Request::json();
$action = (string) ($body['action'] ?? '');

switch ($action) {
    case 'mark_read':
        $data = Validator::validate($body, ['id' => 'required|int|min:1']);
        Database::execute(
            'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = :id AND user_id = :u',
            ['id' => $data['id'], 'u' => $user->id]
        );
        Response::success(['message' => 'Marked read.']);

    case 'mark_all_read':
        Database::execute(
            'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = :u AND is_read = 0',
            ['u' => $user->id]
        );
        Response::success(['message' => 'All marked read.']);

    default:
        Response::error('BAD_REQUEST', 'Unknown action.', 400);
}
