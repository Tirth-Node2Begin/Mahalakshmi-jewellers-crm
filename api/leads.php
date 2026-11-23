<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/Support/api_bootstrap.php';

use CRM\Auth\AuthUser;
use CRM\Auth\PermissionService;
use CRM\Core\Request;
use CRM\Core\Response;
use CRM\Database\Database;
use CRM\Support\Audit;
use CRM\Validation\Validator;

const LEAD_STATUSES = [
    'New',
    'Contacted',
    'Qualified',
    'Meeting Scheduled',
    'Meeting Done',
    'Proposal Sent',
    'Negotiation',
    'Converted',
    'Dropped',
    'Lost',
];

const LEAD_CHANNELS = [
    'walk_in',
    'phone',
    'website',
    'whatsapp',
    'facebook',
    'instagram',
    'google',
    'referral',
    'other',
];

const LEAD_CLOSED_STATUSES = ['Converted', 'Dropped', 'Lost'];

function leadScopeCondition(AuthUser $user, string $alias = 'l'): array
{
    if (PermissionService::dataScope($user) === 'own') {
        return [
            "({$alias}.assigned_to = :scope_user_id OR {$alias}.created_by = :scope_user_id)",
            ['scope_user_id' => $user->id],
        ];
    }

    return ['1=1', []];
}

function leadSelectSql(): string
{
    return "SELECT l.*,
                   s.name AS source_name,
                   au.full_name AS assigned_to_name,
                   cu.full_name AS created_by_name
              FROM leads l
         LEFT JOIN lead_sources s ON s.id = l.source_id
         LEFT JOIN users au ON au.id = l.assigned_to
         LEFT JOIN users cu ON cu.id = l.created_by";
}

function leadSources(): array
{
    return Database::fetchAll(
        'SELECT id, name, is_active
           FROM lead_sources
          WHERE is_active = 1
          ORDER BY name'
    );
}

function leadUsers(): array
{
    return Database::fetchAll(
        'SELECT id, full_name
           FROM users
          WHERE is_active = 1
          ORDER BY full_name'
    );
}

function findLeadOrFail(int $id, AuthUser $user): array
{
    [$scopeSql, $scopeParams] = leadScopeCondition($user, 'l');
    $lead = Database::fetchOne(
        leadSelectSql() . " WHERE l.id = :id AND {$scopeSql}",
        ['id' => $id] + $scopeParams
    );

    if ($lead === null) {
        Response::error('NOT_FOUND', 'Lead not found.', 404);
    }

    return $lead;
}

function logLeadActivity(int $leadId, string $type, ?string $description, ?string $oldStatus, ?string $newStatus, AuthUser $user): void
{
    try {
        Database::insert('lead_activities', [
            'lead_id' => $leadId,
            'activity_type' => $type,
            'description' => $description,
            'old_status' => $oldStatus,
            'new_status' => $newStatus,
            'created_by' => $user->id,
        ]);
    } catch (Throwable) {
        // Activity is helpful history, never a reason to fail the business action.
    }
}

function listLeads(AuthUser $user): array
{
    [$scopeSql, $scopeParams] = leadScopeCondition($user, 'l');
    $where = [$scopeSql];
    $params = $scopeParams;

    $status = trim((string) ($_GET['status'] ?? ''));
    if ($status !== '' && in_array($status, LEAD_STATUSES, true)) {
        $where[] = 'l.status = :status';
        $params['status'] = $status;
    }

    $tab = trim((string) ($_GET['tab'] ?? ''));
    if ($status === '' && $tab === 'active') {
        $where[] = "l.status NOT IN ('Converted', 'Dropped', 'Lost')";
    } elseif ($status === '' && $tab === 'closed') {
        $where[] = "l.status IN ('Converted', 'Dropped', 'Lost')";
    }

    $sourceId = (int) ($_GET['source_id'] ?? 0);
    if ($sourceId > 0) {
        $where[] = 'l.source_id = :source_id';
        $params['source_id'] = $sourceId;
    }

    $assignedTo = (int) ($_GET['assigned_to'] ?? 0);
    if ($assignedTo > 0) {
        $where[] = 'l.assigned_to = :assigned_to';
        $params['assigned_to'] = $assignedTo;
    }

    $search = trim((string) ($_GET['search'] ?? ''));
    if ($search !== '') {
        $like = '%' . $search . '%';
        $where[] = '(l.name LIKE :search_name
                  OR l.mobile LIKE :search_mobile
                  OR l.email LIKE :search_email
                  OR l.company LIKE :search_company
                  OR l.city LIKE :search_city
                  OR l.service_interest LIKE :search_interest
                  OR s.name LIKE :search_source)';
        $params += [
            'search_name' => $like,
            'search_mobile' => $like,
            'search_email' => $like,
            'search_company' => $like,
            'search_city' => $like,
            'search_interest' => $like,
            'search_source' => $like,
        ];
    }

    $from = trim((string) ($_GET['from'] ?? ''));
    if ($from !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $from)) {
        $where[] = 'COALESCE(l.lead_date, DATE(l.created_at)) >= :from_date';
        $params['from_date'] = $from;
    }

    $to = trim((string) ($_GET['to'] ?? ''));
    if ($to !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $to)) {
        $where[] = 'COALESCE(l.lead_date, DATE(l.created_at)) <= :to_date';
        $params['to_date'] = $to;
    }

    return Database::fetchAll(
        leadSelectSql()
        . ' WHERE ' . implode(' AND ', $where)
        . ' ORDER BY COALESCE(l.lead_date, DATE(l.created_at)) DESC, l.created_at DESC, l.id DESC
             LIMIT 300',
        $params
    );
}

function leadStats(AuthUser $user): array
{
    [$scopeSql, $scopeParams] = leadScopeCondition($user, 'l');

    return Database::fetchOne(
        "SELECT COUNT(*) AS total,
                COALESCE(SUM(CASE WHEN COALESCE(l.lead_date, DATE(l.created_at)) = CURDATE() THEN 1 ELSE 0 END), 0) AS new_today,
                COALESCE(SUM(CASE WHEN l.status NOT IN ('Converted', 'Dropped', 'Lost') THEN 1 ELSE 0 END), 0) AS open_pipeline,
                COALESCE(SUM(CASE WHEN l.status = 'Converted' THEN 1 ELSE 0 END), 0) AS converted,
                COALESCE(SUM(CASE WHEN l.status IN ('Dropped', 'Lost') THEN 1 ELSE 0 END), 0) AS dropped_lost,
                COALESCE(SUM(CASE WHEN l.status NOT IN ('Converted', 'Dropped', 'Lost') THEN l.expected_value ELSE 0 END), 0) AS open_value
           FROM leads l
          WHERE {$scopeSql}",
        $scopeParams
    ) ?? [
        'total' => 0,
        'new_today' => 0,
        'open_pipeline' => 0,
        'converted' => 0,
        'dropped_lost' => 0,
        'open_value' => 0,
    ];
}

function normalizeLeadPayload(array $body): array
{
    $data = Validator::validate($body, [
        'name' => 'required|string|max:120',
        'mobile' => 'nullable|string|max:20',
        'email' => 'nullable|email|max:150',
        'company' => 'nullable|string|max:150',
        'city' => 'nullable|string|max:100',
        'source_id' => 'nullable|int|min:1',
        'source_detail' => 'nullable|string|max:255',
        'channel_type' => 'nullable|in:walk_in,phone,website,whatsapp,facebook,instagram,google,referral,other',
        'service_interest' => 'nullable|string|max:255',
        'expected_value' => 'nullable|numeric|min:0',
        'status' => 'nullable|in:New,Contacted,Qualified,Meeting Scheduled,Meeting Done,Proposal Sent,Negotiation,Converted,Dropped,Lost',
        'assigned_to' => 'nullable|int|min:1',
        'notes' => 'nullable|string|max:5000',
        'lead_date' => 'nullable|date',
    ]);

    $data['channel_type'] = $data['channel_type'] ?? 'other';
    $data['status'] = $data['status'] ?? 'New';

    if ($data['source_id'] !== null && Database::fetchValue(
        'SELECT id FROM lead_sources WHERE id = :id AND is_active = 1',
        ['id' => $data['source_id']]
    ) === null) {
        Response::error('VALIDATION_ERROR', 'Validation failed.', 422, ['source_id' => 'Choose an active source.']);
    }

    if ($data['assigned_to'] !== null && Database::fetchValue(
        'SELECT id FROM users WHERE id = :id AND is_active = 1',
        ['id' => $data['assigned_to']]
    ) === null) {
        Response::error('VALIDATION_ERROR', 'Validation failed.', 422, ['assigned_to' => 'Choose an active user.']);
    }

    return $data;
}

function timestampsForStatus(string $newStatus, ?string $oldStatus, ?array $oldLead = null): array
{
    $now = date('Y-m-d H:i:s');
    $wasConverted = $oldStatus === 'Converted';
    $wasClosedLost = in_array((string) $oldStatus, ['Dropped', 'Lost'], true);

    return [
        'converted_at' => $newStatus === 'Converted'
            ? ($wasConverted ? ($oldLead['converted_at'] ?? $now) : $now)
            : null,
        'dropped_at' => in_array($newStatus, ['Dropped', 'Lost'], true)
            ? ($wasClosedLost ? ($oldLead['dropped_at'] ?? $now) : $now)
            : null,
    ];
}

$user = requireApiAuth();

if (Request::method() === 'GET') {
    requirePermission('leads.read');

    if (isset($_GET['id'])) {
        $lead = findLeadOrFail((int) $_GET['id'], $user);
        $activities = Database::fetchAll(
            'SELECT a.*, u.full_name AS created_by_name
               FROM lead_activities a
          LEFT JOIN users u ON u.id = a.created_by
              WHERE a.lead_id = :id
              ORDER BY a.created_at DESC, a.id DESC
              LIMIT 100',
            ['id' => (int) $lead['id']]
        );
        Response::success([
            'lead' => $lead,
            'activities' => $activities,
            'sources' => leadSources(),
            'users' => leadUsers(),
        ]);
    }

    Response::success([
        'leads' => listLeads($user),
        'stats' => leadStats($user),
        'sources' => leadSources(),
        'users' => leadUsers(),
        'statuses' => LEAD_STATUSES,
        'channels' => LEAD_CHANNELS,
    ]);
}

requireMethod('POST');
$body = Request::json();
$action = (string) ($body['action'] ?? 'create');

switch ($action) {
    case 'create': {
        requirePermission('leads.create');
        $data = normalizeLeadPayload($body);
        $stamps = timestampsForStatus((string) $data['status'], null);
        $id = Database::insert('leads', [
            'name' => $data['name'],
            'mobile' => $data['mobile'],
            'email' => $data['email'],
            'company' => $data['company'],
            'city' => $data['city'],
            'source_id' => $data['source_id'],
            'source_detail' => $data['source_detail'],
            'channel_type' => $data['channel_type'],
            'service_interest' => $data['service_interest'],
            'expected_value' => $data['expected_value'],
            'status' => $data['status'],
            'assigned_to' => $data['assigned_to'],
            'created_by' => $user->id,
            'converted_at' => $stamps['converted_at'],
            'dropped_at' => $stamps['dropped_at'],
            'notes' => $data['notes'],
            'lead_date' => $data['lead_date'],
        ]);
        logLeadActivity($id, 'Lead Created', 'Lead added from the CRM.', null, (string) $data['status'], $user);
        Audit::log($user->id, 'leads.create', 'leads', $id, null, $data);
        Response::success(['message' => 'Lead created.', 'id' => $id], 201);
    }

    case 'update': {
        requirePermission('leads.update');
        $idData = Validator::validate($body, ['id' => 'required|int|min:1']);
        $old = findLeadOrFail((int) $idData['id'], $user);
        $data = normalizeLeadPayload($body);
        $stamps = timestampsForStatus((string) $data['status'], (string) $old['status'], $old);

        Database::execute(
            'UPDATE leads
                SET name = :name,
                    mobile = :mobile,
                    email = :email,
                    company = :company,
                    city = :city,
                    source_id = :source_id,
                    source_detail = :source_detail,
                    channel_type = :channel_type,
                    service_interest = :service_interest,
                    expected_value = :expected_value,
                    status = :status,
                    assigned_to = :assigned_to,
                    converted_at = :converted_at,
                    dropped_at = :dropped_at,
                    notes = :notes,
                    lead_date = :lead_date
              WHERE id = :id',
            [
                'id' => (int) $old['id'],
                'name' => $data['name'],
                'mobile' => $data['mobile'],
                'email' => $data['email'],
                'company' => $data['company'],
                'city' => $data['city'],
                'source_id' => $data['source_id'],
                'source_detail' => $data['source_detail'],
                'channel_type' => $data['channel_type'],
                'service_interest' => $data['service_interest'],
                'expected_value' => $data['expected_value'],
                'status' => $data['status'],
                'assigned_to' => $data['assigned_to'],
                'converted_at' => $stamps['converted_at'],
                'dropped_at' => $stamps['dropped_at'],
                'notes' => $data['notes'],
                'lead_date' => $data['lead_date'],
            ]
        );

        if ((string) $old['status'] !== (string) $data['status']) {
            logLeadActivity((int) $old['id'], 'Status Updated', null, (string) $old['status'], (string) $data['status'], $user);
        } else {
            logLeadActivity((int) $old['id'], 'Lead Updated', 'Lead details were edited.', null, null, $user);
        }
        Audit::log($user->id, 'leads.update', 'leads', (int) $old['id'], $old, $data);
        Response::success(['message' => 'Lead updated.']);
    }

    case 'delete': {
        requirePermission('leads.delete');
        $data = Validator::validate($body, ['id' => 'required|int|min:1']);
        $old = findLeadOrFail((int) $data['id'], $user);
        Database::execute('DELETE FROM leads WHERE id = :id', ['id' => (int) $old['id']]);
        Audit::log($user->id, 'leads.delete', 'leads', (int) $old['id'], $old, null);
        Response::success(['message' => 'Lead removed.']);
    }

    default:
        Response::error('BAD_REQUEST', 'Unknown action.', 400);
}
