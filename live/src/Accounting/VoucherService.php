<?php

declare(strict_types=1);

namespace CRM\Accounting;

use CRM\Database\Database;
use CRM\Support\Audit;
use CRM\Support\NumberSequence;

/**
 * Posts balanced double-entry vouchers (plan/05 §2).
 *
 * Every money event in the system routes through post(): a voucher header plus
 * entries whose debits equal their credits. Nothing is ever deleted — a voucher
 * is cancelled, which excludes it from every report (`status = 'active'`).
 *
 * MUST be called inside the caller's Database::transaction(), so the document
 * and its ledger effect commit together or not at all.
 */
final class VoucherService
{
    /** Rupee tolerance for the balance assertion (guards float dust only). */
    private const EPSILON = 0.009;

    /**
     * @param list<array{ledger_id:int, dr?:float, cr?:float, narration?:string}> $entries
     * @return int voucher id
     */
    public static function post(
        string $vtype,
        string $vdate,
        array $entries,
        ?string $narration = null,
        ?string $refType = null,
        ?int $refId = null,
        ?int $userId = null
    ): int {
        if (!Database::pdo()->inTransaction()) {
            throw new \LogicException('VoucherService::post() must run inside a transaction.');
        }

        $clean = self::normalize($entries);
        if ($clean === []) {
            throw new \LogicException('A voucher needs at least one entry.');
        }

        $dr = 0.0;
        $cr = 0.0;
        foreach ($clean as $e) {
            $dr += $e['dr_amount'];
            $cr += $e['cr_amount'];
        }
        if (abs($dr - $cr) > self::EPSILON) {
            // a bug in a posting map — never surface a half-posted voucher
            throw new \LogicException(sprintf(
                'Unbalanced %s voucher: debits %.2f vs credits %.2f.',
                $vtype,
                $dr,
                $cr
            ));
        }

        $voucherId = Database::insert('vouchers', [
            'voucher_no' => NumberSequence::next('voucher'),
            'vtype' => $vtype,
            'vdate' => $vdate,
            'narration' => $narration,
            'ref_type' => $refType,
            'ref_id' => $refId,
            'status' => 'active',
            'created_by' => $userId,
        ]);

        foreach ($clean as $e) {
            Database::insert('voucher_entries', [
                'voucher_id' => $voucherId,
                'ledger_id' => $e['ledger_id'],
                'dr_amount' => $e['dr_amount'],
                'cr_amount' => $e['cr_amount'],
                'narration' => $e['narration'],
            ]);
        }

        return $voucherId;
    }

    /**
     * Cancel a voucher: it stops counting in every report. The caller is
     * responsible for reversing any stock the document moved.
     */
    public static function cancel(int $voucherId, string $reason, ?int $userId = null): void
    {
        $voucher = Database::fetchOne('SELECT id, status, vtype FROM vouchers WHERE id = :id', ['id' => $voucherId]);
        if ($voucher === null) {
            throw new \RuntimeException('Voucher not found.');
        }
        if ($voucher['status'] === 'cancelled') {
            return; // already cancelled — cancelling twice is not an error
        }

        Database::execute(
            "UPDATE vouchers
                SET status = 'cancelled', cancelled_by = :u, cancelled_at = NOW(), cancel_reason = :r
              WHERE id = :id",
            ['u' => $userId, 'r' => mb_substr($reason, 0, 255), 'id' => $voucherId]
        );

        Audit::log($userId, 'voucher.cancel', 'vouchers', $voucherId, ['status' => 'active'], [
            'status' => 'cancelled',
            'reason' => $reason,
        ]);
    }

    /**
     * Drops zero-value rows and rejects malformed ones.
     * @param list<array<string,mixed>> $entries
     * @return list<array{ledger_id:int, dr_amount:float, cr_amount:float, narration:?string}>
     */
    private static function normalize(array $entries): array
    {
        $clean = [];
        foreach ($entries as $entry) {
            $ledgerId = (int) ($entry['ledger_id'] ?? 0);
            $drAmount = round((float) ($entry['dr'] ?? 0), 2);
            $crAmount = round((float) ($entry['cr'] ?? 0), 2);

            if ($ledgerId <= 0) {
                throw new \LogicException('Voucher entry is missing a ledger.');
            }
            if ($drAmount < 0 || $crAmount < 0) {
                throw new \LogicException('Voucher amounts cannot be negative.');
            }
            if ($drAmount > 0 && $crAmount > 0) {
                throw new \LogicException('A voucher entry is either a debit or a credit, never both.');
            }
            if ($drAmount === 0.0 && $crAmount === 0.0) {
                continue; // nothing to post on this line
            }

            $clean[] = [
                'ledger_id' => $ledgerId,
                'dr_amount' => $drAmount,
                'cr_amount' => $crAmount,
                'narration' => isset($entry['narration']) ? mb_substr((string) $entry['narration'], 0, 255) : null,
            ];
        }
        return $clean;
    }
}
