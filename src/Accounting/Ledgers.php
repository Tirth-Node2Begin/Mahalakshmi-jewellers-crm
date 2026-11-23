<?php

declare(strict_types=1);

namespace CRM\Accounting;

use CRM\Database\Database;
use CRM\Jewellery\Metals;

/**
 * Resolves the system ledger ids the posting maps need (plan/05 §2), so no
 * service ever hardcodes a primary key. Party ledgers (one per customer /
 * vendor) are created on demand the first time that party is posted to.
 */
final class Ledgers
{
    /** @var array<string,int> request-scoped cache */
    private static array $cache = [];

    /** A system ledger by its linked_type, optionally per metal. */
    public static function system(string $linkedType, ?string $metal = null): int
    {
        $key = $linkedType . '|' . ($metal ?? '');
        if (isset(self::$cache[$key])) {
            return self::$cache[$key];
        }

        $sql = 'SELECT id FROM ledger_accounts WHERE linked_type = :t AND linked_id IS NULL';
        $params = ['t' => $linkedType];
        if ($metal !== null) {
            $sql .= ' AND metal = :m';
            $params['m'] = $metal;
        } else {
            $sql .= ' AND metal IS NULL';
        }
        $id = Database::fetchValue($sql . ' LIMIT 1', $params);

        if ($id === null) {
            throw new \RuntimeException(sprintf(
                'System ledger "%s"%s is missing. Run database/seed.php.',
                $linkedType,
                $metal !== null ? " ($metal)" : ''
            ));
        }
        return self::$cache[$key] = (int) $id;
    }

    /** The receivable sub-ledger for a customer (created on first use). */
    public static function customer(int $customerId): int
    {
        return self::party('customer', $customerId, 'Accounts Receivable', 'dr');
    }

    /** The payable sub-ledger for a vendor (created on first use). */
    public static function vendor(int $vendorId): int
    {
        return self::party('vendor', $vendorId, 'Accounts Payable', 'cr');
    }

    /**
     * The expense ledger for a spend category, created under Operating
     * Expenses on first use — so a new category shows up in the P&L by name
     * instead of everything landing in one lump.
     */
    public static function expenseCategory(int $categoryId): int
    {
        $key = 'expense_cat#' . $categoryId;
        if (isset(self::$cache[$key])) {
            return self::$cache[$key];
        }

        $id = Database::fetchValue(
            "SELECT id FROM ledger_accounts WHERE linked_type = 'expense' AND linked_id = :i LIMIT 1",
            ['i' => $categoryId]
        );

        if ($id === null) {
            $name = Database::fetchValue(
                'SELECT name FROM expense_categories WHERE id = :i',
                ['i' => $categoryId]
            );
            if ($name === null) {
                return self::$cache[$key] = self::system('expense');   // fall back to the catch-all
            }
            $groupId = Database::fetchValue(
                "SELECT id FROM account_groups WHERE name = 'Operating Expenses' LIMIT 1"
            );
            if ($groupId === null) {
                throw new \RuntimeException('Account group "Operating Expenses" is missing. Run database/seed.php.');
            }
            $id = Database::insert('ledger_accounts', [
                'group_id' => (int) $groupId,
                'name' => (string) $name,
                'linked_type' => 'expense',
                'linked_id' => $categoryId,
                'opening_type' => 'dr',
                'is_system' => 1,
            ]);
        }

        return self::$cache[$key] = (int) $id;
    }

    /**
     * The ledger money of a given payment mode lands in.
     *
     *   cash              → Cash in Hand
     *   cheque IN         → Cheques in Hand (an asset in transit; it only reaches
     *                       the bank when the cheque is marked cleared, so the
     *                       bank ledger still reconciles to the bank statement)
     *   cheque OUT        → the bank account itself: a cheque we hand over is
     *                       recorded as money gone the moment it is written
     *   bank / upi / card → the ledger of THAT bank account
     *
     * A bank account's ledger is created the first time money moves through it.
     * Until this existed every non-cash rupee landed in one shared "Bank
     * Account" ledger, so no account could be reconciled on its own.
     *
     * @param string $flow 'in' for money received, 'out' for money paid away
     */
    public static function forPaymentMode(string $mode, ?int $bankAccountId = null, string $flow = 'in'): int
    {
        if ($mode === 'cash') {
            return self::system('cash');
        }
        if ($mode === 'cheque' && $flow === 'in') {
            return self::system('cheques_in_hand');
        }
        if ($bankAccountId !== null) {
            return self::bankAccount($bankAccountId);
        }
        return self::system('bank'); // no account chosen — the catch-all bank ledger
    }

    /**
     * The inventory ledger that carries an item's value.
     *
     * Old-metal buckets have their own ledger (Inventory — Old Metal) because
     * that is where an exchange intake is debited. Picking the ledger by metal
     * alone sent old metal OUT of Inventory — Gold while it had come IN to
     * Inventory — Old Metal: the totals still balanced, so no integrity check
     * caught it, but Old Metal inflated forever and Inventory — Gold drifted
     * negative. Every stock posting must come through here.
     */
    public static function inventoryForItem(?string $itemType, ?string $metal): int
    {
        if ($itemType === 'old_metal') {
            return self::system('old_metal');
        }
        // an item carrying no metal at all has always been taken in on the Old
        // Metal ledger, so it has to leave from there too
        if (!is_string($metal) || trim($metal) === '') {
            return self::system('old_metal');
        }
        return self::system('inventory', Metals::normalise($metal));
    }

    /** The ledger of one bank account, created under Cash & Bank on first use. */
    public static function bankAccount(int $bankAccountId): int
    {
        $key = 'bank#' . $bankAccountId;
        if (isset(self::$cache[$key])) {
            return self::$cache[$key];
        }

        $id = Database::fetchValue(
            'SELECT id FROM ledger_accounts WHERE linked_type = :t AND linked_id = :b LIMIT 1',
            ['t' => 'bank', 'b' => $bankAccountId]
        );

        if ($id === null) {
            $account = Database::fetchOne(
                'SELECT account_name, bank_name, account_number FROM bank_accounts WHERE id = :i',
                ['i' => $bankAccountId]
            );
            if ($account === null) {
                return self::$cache[$key] = self::system('bank');   // fall back to the catch-all
            }
            $groupId = Database::fetchValue(
                "SELECT id FROM account_groups WHERE name = 'Cash & Bank' LIMIT 1"
            );
            if ($groupId === null) {
                throw new \RuntimeException('Account group "Cash & Bank" is missing. Run database/seed.php.');
            }
            // "Current A/c ••4521 (HDFC Bank)": recognisable in a ledger list,
            // without repeating a bank name the account is already named after
            $name = trim((string) $account['account_name']);
            if ($account['account_number'] !== null) {
                $name .= ' ••' . mb_substr((string) $account['account_number'], -4);
            }
            $bankName = trim((string) ($account['bank_name'] ?? ''));
            if ($bankName !== '' && mb_stripos($name, $bankName) === false) {
                $name .= ' (' . $bankName . ')';
            }
            $id = Database::insert('ledger_accounts', [
                'group_id' => (int) $groupId,
                'name' => mb_substr($name, 0, 120),
                'linked_type' => 'bank',
                'linked_id' => $bankAccountId,
                'opening_type' => 'dr',
                'is_system' => 1,
            ]);
        }

        return self::$cache[$key] = (int) $id;
    }

    /** Ledger id for a party, creating the sub-ledger under its parent group if absent. */
    private static function party(string $type, int $partyId, string $parentGroupName, string $openingType): int
    {
        $key = $type . '#' . $partyId;
        if (isset(self::$cache[$key])) {
            return self::$cache[$key];
        }

        $id = Database::fetchValue(
            'SELECT id FROM ledger_accounts WHERE linked_type = :t AND linked_id = :i LIMIT 1',
            ['t' => $type, 'i' => $partyId]
        );

        if ($id === null) {
            $table = $type === 'customer' ? 'customers' : 'suppliers';
            $party = Database::fetchOne("SELECT name FROM {$table} WHERE id = :i", ['i' => $partyId]);
            if ($party === null) {
                throw new \RuntimeException(ucfirst($type) . ' not found.');
            }
            $groupId = Database::fetchValue(
                'SELECT id FROM account_groups WHERE name = :n LIMIT 1',
                ['n' => $parentGroupName]
            );
            if ($groupId === null) {
                throw new \RuntimeException("Account group \"{$parentGroupName}\" is missing. Run database/seed.php.");
            }
            $id = Database::insert('ledger_accounts', [
                'group_id' => (int) $groupId,
                'name' => $party['name'],
                'linked_type' => $type,
                'linked_id' => $partyId,
                'opening_type' => $openingType,
                'is_system' => 1,
            ]);
        }

        return self::$cache[$key] = (int) $id;
    }

    /** Clears the cache (used by tests/CLI that mutate ledgers mid-run). */
    public static function flush(): void
    {
        self::$cache = [];
    }
}
