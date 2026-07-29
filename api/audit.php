<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/Support/api_bootstrap.php';

use CRM\Core\Response;
use CRM\Database\Database;

requireApiAuth();
requireMethod('GET');
requirePermission('audit.read');

$where = [];
$params = [];

if (!empty($_GET['user_id'])) {
    $where[] = 'a.user_id = :user_id';
    $params['user_id'] = (int) $_GET['user_id'];
}
if (!empty($_GET['entity'])) {
    $where[] = 'a.entity_type = :entity';
    $params['entity'] = (string) $_GET['entity'];
}
if (!empty($_GET['action'])) {
    $where[] = 'a.action = :action';
    $params['action'] = (string) $_GET['action'];
}
if (!empty($_GET['from'])) {
    $where[] = 'a.created_at >= :from';
    $params['from'] = substr((string) $_GET['from'], 0, 10) . ' 00:00:00';
}
if (!empty($_GET['to'])) {
    $where[] = 'a.created_at <= :to';
    $params['to'] = substr((string) $_GET['to'], 0, 10) . ' 23:59:59';
}
if (!empty($_GET['search'])) {
    $where[] = '(a.action LIKE :search OR a.entity_type LIKE :search2)';
    $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], (string) $_GET['search']) . '%';
    $params['search'] = $like;
    $params['search2'] = $like;   // real prepares — a placeholder is never reused
}

$sql = $where === [] ? '' : ' WHERE ' . implode(' AND ', $where);

$total = (int) Database::fetchValue("SELECT COUNT(*) FROM audit_logs a$sql", $params);

$perPage = max(1, min(200, (int) ($_GET['per_page'] ?? 50)));
$page = max(1, (int) ($_GET['page'] ?? 1));
$offset = ($page - 1) * $perPage;   // ints only — LIMIT/OFFSET cannot be bound

$rows = Database::fetchAll(
    "SELECT a.id, a.user_id, u.full_name AS user_name, a.action, a.entity_type, a.entity_id,
            a.old_values, a.new_values, a.ip_address, a.created_at
       FROM audit_logs a
  LEFT JOIN users u ON u.id = a.user_id
       $sql
      ORDER BY a.id DESC
      LIMIT $perPage OFFSET $offset",
    $params
);

foreach ($rows as &$row) {
    $row['old_values'] = $row['old_values'] === null ? null : json_decode((string) $row['old_values'], true);
    $row['new_values'] = $row['new_values'] === null ? null : json_decode((string) $row['new_values'], true);
}
unset($row);

Response::success([
    'logs' => $rows,
    'meta' => ['page' => $page, 'per_page' => $perPage, 'total' => $total],
]);
