<?php

declare(strict_types=1);

namespace CRM\Customers;

use CRM\Auth\AuthUser;
use CRM\Database\Database;
use CRM\Support\CustomerTimeline;
use CRM\Support\NumberSequence;
use CRM\Validation\Validator;

final class CustomerService
{
    public const STAGES = ['onboarding', 'active', 'inactive', 'churned'];

    /** Create a customer (plus their family members) in one transaction. */
    public static function create(array $body, AuthUser $user): int
    {
        $data = self::validate($body);

        return Database::transaction(static function () use ($data, $body, $user): int {
            $code = NumberSequence::next('customer');
            $customerId = Database::insert('customers', $data + [
                'customer_code' => $code,
                'created_by' => $user->id,
            ]);
            self::saveFamily($customerId, $body['family'] ?? null);
            CustomerTimeline::log($customerId, 'created', 'Customer added.', null, null, $user->id);

            return $customerId;
        });
    }

    public static function update(int $id, array $body, AuthUser $user): void
    {
        self::findOrFail($user, $id);
        $data = self::validate($body);
        Database::transaction(static function () use ($id, $data, $body): void {
            $set = implode(', ', array_map(static fn (string $c): string => "`$c` = :$c", array_keys($data)));
            Database::execute("UPDATE customers SET $set WHERE id = :pk", $data + ['pk' => $id]);
            if (array_key_exists('family', $body)) {
                self::saveFamily($id, $body['family']);
            }
        });
    }

    /** Replace a customer's family members (info.md §4 — cross-sell mapping). */
    private static function saveFamily(int $customerId, mixed $family): void
    {
        if (!is_array($family)) {
            return;
        }
        Database::execute('DELETE FROM family_members WHERE customer_id = :id', ['id' => $customerId]);
        foreach ($family as $member) {
            if (!is_array($member) || trim((string) ($member['name'] ?? '')) === '') {
                continue;
            }
            Database::insert('family_members', [
                'customer_id' => $customerId,
                'relation' => isset($member['relation']) && $member['relation'] !== '' ? (string) $member['relation'] : null,
                'name' => (string) $member['name'],
                'dob' => !empty($member['dob']) ? (string) $member['dob'] : null,
                'anniversary' => !empty($member['anniversary']) ? (string) $member['anniversary'] : null,
            ]);
        }
    }

    public static function updateStage(int $id, string $stage, AuthUser $user): void
    {
        if (!in_array($stage, self::STAGES, true)) {
            throw new \RuntimeException('Invalid stage.');
        }
        $customer = self::findOrFail($user, $id);
        if ($customer['stage'] === $stage) {
            return;
        }
        Database::transaction(static function () use ($id, $customer, $stage, $user): void {
            Database::execute('UPDATE customers SET stage = :s WHERE id = :id', ['s' => $stage, 'id' => $id]);
            CustomerTimeline::log($id, 'stage_changed', "Stage: {$customer['stage']} → $stage", null, null, $user->id);
        });
    }

    public static function addNote(int $id, string $note, AuthUser $user): void
    {
        self::findOrFail($user, $id);
        CustomerTimeline::log($id, 'note_added', substr($note, 0, 500), null, null, $user->id);
    }

    public static function archive(int $id, bool $active, AuthUser $user): void
    {
        self::findOrFail($user, $id);
        Database::execute('UPDATE customers SET is_active = :a WHERE id = :id', ['a' => $active ? 1 : 0, 'id' => $id]);
    }

    public static function findOrFail(AuthUser $user, int $id): array
    {
        $customer = CustomerRepository::find($user, $id);
        if ($customer === null) {
            throw new \RuntimeException('Customer not found.');
        }
        return $customer;
    }

    /** @return array<string,mixed> */
    private static function validate(array $body): array
    {
        $data = Validator::validate($body, [
            'name' => 'required|string|max:150',
            'company' => 'nullable|string|max:150',
            'gstin' => 'nullable|string|max:20',
            'pan_no' => 'nullable|string|max:15',
            'mobile' => 'nullable|string|max:20',
            'alt_mobile' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:150',
            'address' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'pincode' => 'nullable|string|max:10',
            'gender' => 'nullable|in:male,female,other',
            'dob' => 'nullable|date',
            'anniversary' => 'nullable|date',
            'occupation' => 'nullable|string|max:100',
            'vip' => 'nullable|boolean',
            'stage' => 'nullable|in:' . implode(',', self::STAGES),
            'assigned_to' => 'nullable|int|min:1',
            'notes' => 'nullable|string|max:5000',
        ]);
        return [
            'name' => $data['name'],
            'company' => $data['company'],
            'gstin' => $data['gstin'],
            'pan_no' => $data['pan_no'],
            'mobile' => $data['mobile'],
            'alt_mobile' => $data['alt_mobile'],
            'email' => $data['email'],
            'address' => $data['address'],
            'city' => $data['city'],
            'state' => $data['state'],
            'pincode' => $data['pincode'],
            'gender' => $data['gender'],
            'dob' => $data['dob'],
            'anniversary' => $data['anniversary'],
            'occupation' => $data['occupation'],
            'vip' => !empty($data['vip']) ? 1 : 0,
            'stage' => $data['stage'] ?? 'onboarding',
            'assigned_to' => $data['assigned_to'],
            'notes' => $data['notes'],
        ];
    }
}
