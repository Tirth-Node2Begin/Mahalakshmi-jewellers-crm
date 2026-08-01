<?php

declare(strict_types=1);

namespace CRM\Accounting;

use CRM\Database\Database;

/**
 * Read side of the books (plan/05 §3). Every figure is derived from
 * voucher_entries of ACTIVE vouchers plus the ledger's opening balance —
 * nothing is cached, so the reports can never drift from the entries.
 *
 * Sign convention: a ledger's "balance" is positive on its natural side
 * (asset/expense = debit, liability/income = credit).
 */
final class AccountingRepository
{
    /** Chart of accounts as a group tree with its ledgers attached. */
    public static function chartOfAccounts(): array
    {
        $groups = Database::fetchAll(
            'SELECT id, name, parent_id, nature, is_system, sort_order
               FROM account_groups ORDER BY sort_order, name'
        );
        $ledgers = Database::fetchAll(
            "SELECT id, group_id, name, code, linked_type, linked_id, metal, is_system, is_active,
                    opening_balance, opening_type
               FROM ledger_accounts
              WHERE linked_type IS NULL OR linked_id IS NULL   -- hide per-party sub-ledgers
              ORDER BY name"
        );

        $byGroup = [];
        foreach ($ledgers as $l) {
            $byGroup[(int) $l['group_id']][] = $l;
        }

        $tree = [];
        foreach ($groups as $g) {
            if ($g['parent_id'] !== null) {
                continue;
            }
            $node = $g;
            $node['ledgers'] = $byGroup[(int) $g['id']] ?? [];
            $node['children'] = [];
            foreach ($groups as $child) {
                if ((int) ($child['parent_id'] ?? 0) === (int) $g['id']) {
                    $child['ledgers'] = $byGroup[(int) $child['id']] ?? [];
                    $node['children'][] = $child;
                }
            }
            $tree[] = $node;
        }
        return $tree;
    }

    /**
     * Trial balance for a period. `opening` is the balance carried into $from.
     * Returns rows plus totals; total_dr must equal total_cr.
     */
    public static function trialBalance(string $from, string $to, bool $gstVisibleOnly = false): array
    {
        $visibilitySql = $gstVisibleOnly ? ' AND NOT ' . self::nonGstSaleVoucherSql('v') : '';
        $rows = Database::fetchAll(
            "SELECT l.id, l.name, l.code, g.nature, l.opening_balance, l.opening_type,
                    COALESCE(SUM(CASE WHEN v.vdate < :from{$visibilitySql} THEN e.dr_amount - e.cr_amount END), 0) AS prior_net,
                    COALESCE(SUM(CASE WHEN v.vdate BETWEEN :from2 AND :to{$visibilitySql} THEN e.dr_amount END), 0) AS period_dr,
                    COALESCE(SUM(CASE WHEN v.vdate BETWEEN :from3 AND :to2{$visibilitySql} THEN e.cr_amount END), 0) AS period_cr
               FROM ledger_accounts l
               JOIN account_groups g ON g.id = l.group_id
          LEFT JOIN voucher_entries e ON e.ledger_id = l.id
          LEFT JOIN vouchers v ON v.id = e.voucher_id AND v.status = 'active'
              GROUP BY l.id, l.name, l.code, g.nature, l.opening_balance, l.opening_type
              ORDER BY g.nature, l.name",
            ['from' => $from, 'from2' => $from, 'from3' => $from, 'to' => $to, 'to2' => $to]
        );

        $out = [];
        $totalDr = 0.0;
        $totalCr = 0.0;

        foreach ($rows as $r) {
            $openingSigned = (float) $r['opening_balance'] * ($r['opening_type'] === 'cr' ? -1 : 1);
            $opening = $openingSigned + (float) $r['prior_net'];          // debit-positive
            $periodDr = (float) $r['period_dr'];
            $periodCr = (float) $r['period_cr'];
            $closing = $opening + $periodDr - $periodCr;                   // debit-positive

            if (abs($opening) < 0.005 && $periodDr < 0.005 && $periodCr < 0.005 && abs($closing) < 0.005) {
                continue; // never touched — omit from the sheet
            }

            $totalDr += $periodDr;
            $totalCr += $periodCr;

            $out[] = [
                'ledger_id' => (int) $r['id'],
                'name' => $r['name'],
                'code' => $r['code'],
                'nature' => $r['nature'],
                'opening' => round(abs($opening), 2),
                'opening_type' => $opening >= 0 ? 'dr' : 'cr',
                'debit' => round($periodDr, 2),
                'credit' => round($periodCr, 2),
                'closing' => round(abs($closing), 2),
                'closing_type' => $closing >= 0 ? 'dr' : 'cr',
            ];
        }

        return [
            'rows' => $out,
            'total_debit' => round($totalDr, 2),
            'total_credit' => round($totalCr, 2),
            'balanced' => abs($totalDr - $totalCr) < 0.01,
        ];
    }

    /**
     * Profit & Loss for a period — the client's headline report (plan/05 §3).
     * Gross profit = sales + making income − COGS; net = gross − expenses.
     */
    public static function profitAndLoss(string $from, string $to, bool $gstVisibleOnly = false): array
    {
        $visibilitySql = $gstVisibleOnly ? ' AND NOT ' . self::nonGstSaleVoucherSql('v') : '';
        // The status/date test MUST sit inside the SUM, not in the JOIN condition:
        // a LEFT JOIN that fails still leaves the entry row in the group, so a
        // cancelled or out-of-range voucher would otherwise still be counted.
        $rows = Database::fetchAll(
            "SELECT l.id, l.name, l.linked_type, l.metal, g.nature,
                    COALESCE(SUM(CASE WHEN v.status = 'active' AND v.vdate BETWEEN :from AND :to
                                      {$visibilitySql} THEN e.dr_amount ELSE 0 END), 0) AS dr,
                    COALESCE(SUM(CASE WHEN v.status = 'active' AND v.vdate BETWEEN :from2 AND :to2
                                      {$visibilitySql} THEN e.cr_amount ELSE 0 END), 0) AS cr
               FROM ledger_accounts l
               JOIN account_groups g ON g.id = l.group_id
          LEFT JOIN voucher_entries e ON e.ledger_id = l.id
          LEFT JOIN vouchers v ON v.id = e.voucher_id
              WHERE g.nature IN ('income','expense')
              GROUP BY l.id, l.name, l.linked_type, l.metal, g.nature
              ORDER BY g.nature, l.name",
            ['from' => $from, 'to' => $to, 'from2' => $from, 'to2' => $to]
        );

        $income = [];
        $cogs = [];
        $expenses = [];
        $totalIncome = 0.0;
        $totalCogs = 0.0;
        $totalExpense = 0.0;

        foreach ($rows as $r) {
            $dr = (float) $r['dr'];
            $cr = (float) $r['cr'];
            $isIncome = $r['nature'] === 'income';
            // income sits credit-positive, expense debit-positive
            $amount = $isIncome ? $cr - $dr : $dr - $cr;
            if (abs($amount) < 0.005) {
                continue;
            }

            $line = [
                'ledger_id' => (int) $r['id'],
                'name' => $r['name'],
                'linked_type' => $r['linked_type'],
                'amount' => round($amount, 2),
            ];

            if ($isIncome) {
                $income[] = $line;
                $totalIncome += $amount;
            } elseif ($r['linked_type'] === 'cogs') {
                $cogs[] = $line;
                $totalCogs += $amount;
            } else {
                $expenses[] = $line;
                $totalExpense += $amount;
            }
        }

        $gross = $totalIncome - $totalCogs;

        return [
            'from' => $from,
            'to' => $to,
            'income' => $income,
            'total_income' => round($totalIncome, 2),
            'cogs' => $cogs,
            'total_cogs' => round($totalCogs, 2),
            'gross_profit' => round($gross, 2),
            'expenses' => $expenses,
            'total_expenses' => round($totalExpense, 2),
            'net_profit' => round($gross - $totalExpense, 2),
        ];
    }

    /** Statement of one ledger: opening, each entry, running balance. */
    public static function ledgerStatement(int $ledgerId, string $from, string $to, bool $gstVisibleOnly = false): array
    {
        $ledger = Database::fetchOne(
            'SELECT l.id, l.name, l.code, l.opening_balance, l.opening_type, g.nature
               FROM ledger_accounts l JOIN account_groups g ON g.id = l.group_id
              WHERE l.id = :id',
            ['id' => $ledgerId]
        );
        if ($ledger === null) {
            throw new \RuntimeException('Ledger not found.');
        }

        $visibilitySql = $gstVisibleOnly ? self::gstVisibleVoucherSql('v') : '';

        $priorNet = (float) Database::fetchValue(
            "SELECT COALESCE(SUM(e.dr_amount - e.cr_amount), 0)
               FROM voucher_entries e
               JOIN vouchers v ON v.id = e.voucher_id AND v.status = 'active'
              WHERE e.ledger_id = :id AND v.vdate < :from{$visibilitySql}",
            ['id' => $ledgerId, 'from' => $from]
        );

        $opening = (float) $ledger['opening_balance'] * ($ledger['opening_type'] === 'cr' ? -1 : 1) + $priorNet;

        $entries = Database::fetchAll(
            "SELECT e.id AS entry_id, v.id AS voucher_id, v.voucher_no, v.vdate, v.vtype,
                    v.ref_type, v.ref_id,
                    COALESCE(e.narration, v.narration) AS narration,
                    e.dr_amount, e.cr_amount
               FROM voucher_entries e
               JOIN vouchers v ON v.id = e.voucher_id AND v.status = 'active'
              WHERE e.ledger_id = :id AND v.vdate BETWEEN :from AND :to{$visibilitySql}
              ORDER BY v.vdate, v.id, e.id",
            ['id' => $ledgerId, 'from' => $from, 'to' => $to]
        );

        // "Particulars" in a real ledger is the OTHER side of the entry — what the
        // money went to or came from. Fetch every contra account in one query.
        $contraByVoucher = [];
        $voucherIds = array_values(array_unique(array_column($entries, 'voucher_id')));
        if ($voucherIds !== []) {
            $placeholders = implode(',', array_fill(0, count($voucherIds), '?'));
            $contraRows = Database::fetchAll(
                "SELECT e.voucher_id, l.name, e.dr_amount, e.cr_amount
                   FROM voucher_entries e
                   JOIN ledger_accounts l ON l.id = e.ledger_id
                  WHERE e.voucher_id IN ($placeholders) AND e.ledger_id <> ?
                  ORDER BY e.id",
                array_merge($voucherIds, [$ledgerId])
            );
            foreach ($contraRows as $row) {
                $contraByVoucher[(int) $row['voucher_id']][] = [
                    'name' => $row['name'],
                    'amount' => round((float) $row['dr_amount'] + (float) $row['cr_amount'], 2),
                    'side' => (float) $row['dr_amount'] > 0 ? 'dr' : 'cr',
                ];
            }
        }

        $running = $opening;
        $rows = [];
        $totalDr = 0.0;
        $totalCr = 0.0;

        foreach ($entries as $e) {
            $dr = (float) $e['dr_amount'];
            $cr = (float) $e['cr_amount'];
            $running += $dr - $cr;
            $totalDr += $dr;
            $totalCr += $cr;

            $contra = $contraByVoucher[(int) $e['voucher_id']] ?? [];
            $names = array_values(array_unique(array_column($contra, 'name')));

            $rows[] = $e + [
                'contra' => $contra,
                // classic ledger wording: a debit is "To …", a credit is "By …"
                'particulars' => ($dr > 0 ? 'To ' : 'By ') . (
                    $names === [] ? ($e['narration'] ?? $e['vtype']) : implode(', ', $names)
                ),
                'balance' => round(abs($running), 2),
                'balance_type' => $running >= 0 ? 'dr' : 'cr',
            ];
        }

        return [
            'ledger' => $ledger,
            'view' => $gstVisibleOnly ? 'gst' : 'full',
            'filtered_non_gst' => $gstVisibleOnly,
            'opening' => round(abs($opening), 2),
            'opening_type' => $opening >= 0 ? 'dr' : 'cr',
            'entries' => $rows,
            'total_debit' => round($totalDr, 2),
            'total_credit' => round($totalCr, 2),
            'closing' => round(abs($running), 2),
            'closing_type' => $running >= 0 ? 'dr' : 'cr',
        ];
    }

    /** Non-GST sale vouchers are hidden from the GST-visible ledger projection. */
    public static function voucherHiddenFromGstLedger(int $voucherId): bool
    {
        return Database::fetchValue(
            'SELECT 1 FROM vouchers v WHERE v.id = :id AND ' . self::nonGstSaleVoucherSql('v') . ' LIMIT 1',
            ['id' => $voucherId]
        ) !== null;
    }

    private static function gstVisibleVoucherSql(string $voucherAlias): string
    {
        return ' AND NOT ' . self::nonGstSaleVoucherSql($voucherAlias);
    }

    private static function nonGstSaleVoucherSql(string $voucherAlias): string
    {
        return "(
            (
                {$voucherAlias}.ref_type = 'invoice'
                AND EXISTS (
                    SELECT 1
                      FROM invoices ng_i
                     WHERE ng_i.id = {$voucherAlias}.ref_id
                       AND NOT EXISTS (
                           SELECT 1
                             FROM invoice_items gst_line
                            WHERE gst_line.invoice_id = ng_i.id
                              AND gst_line.tax_treatment = 'taxable'
                       )
                )
            )
            OR (
                {$voucherAlias}.ref_type = 'receipt'
                AND EXISTS (
                    SELECT 1
                      FROM invoice_payments ip
                      JOIN invoices ng_i ON ng_i.id = ip.invoice_id
                     WHERE ip.id = {$voucherAlias}.ref_id
                       AND NOT EXISTS (
                           SELECT 1
                             FROM invoice_items gst_line
                            WHERE gst_line.invoice_id = ng_i.id
                              AND gst_line.tax_treatment = 'taxable'
                       )
                )
            )
        )";
    }

    /** Every active voucher of a date, with its entries. */
    public static function dayBook(string $date, bool $gstVisibleOnly = false): array
    {
        $visibilitySql = $gstVisibleOnly ? ' AND NOT ' . self::nonGstSaleVoucherSql('v') : '';
        $vouchers = Database::fetchAll(
            "SELECT v.id, v.voucher_no, v.vtype, v.vdate, v.narration, v.ref_type, v.ref_id
               FROM vouchers v WHERE v.vdate = :d AND v.status = 'active'{$visibilitySql}
              ORDER BY vtype, id",
            ['d' => $date]
        );
        if ($vouchers === []) {
            return [];
        }

        $ids = array_column($vouchers, 'id');
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $entries = Database::fetchAll(
            "SELECT e.voucher_id, e.dr_amount, e.cr_amount, l.name AS ledger_name
               FROM voucher_entries e JOIN ledger_accounts l ON l.id = e.ledger_id
              WHERE e.voucher_id IN ($placeholders)
              ORDER BY e.id",
            $ids
        );

        $byVoucher = [];
        foreach ($entries as $e) {
            $byVoucher[(int) $e['voucher_id']][] = $e;
        }
        foreach ($vouchers as &$v) {
            $v['entries'] = $byVoucher[(int) $v['id']] ?? [];
        }
        return $vouchers;
    }

    /** Outstanding balances for every customer (dr) or vendor (cr). */
    public static function outstanding(string $partyType, string $asOf, bool $gstVisibleOnly = false): array
    {
        $table = $partyType === 'customer' ? 'customers' : 'suppliers';
        $sign = $partyType === 'customer' ? 1 : -1;   // customers owe us (dr), vendors are owed (cr)
        $visibilitySql = $gstVisibleOnly && $partyType === 'customer'
            ? ' AND NOT ' . self::nonGstSaleVoucherSql('v')
            : '';

        $rows = Database::fetchAll(
            // condition inside the SUM — see profitAndLoss() for why
            "SELECT p.id, p.name, p.mobile, l.id AS ledger_id,
                    l.opening_balance, l.opening_type,
                    COALESCE(SUM(CASE WHEN v.status = 'active' AND v.vdate <= :as_of
                                      {$visibilitySql} THEN e.dr_amount - e.cr_amount ELSE 0 END), 0) AS net,
                    MAX(CASE WHEN v.status = 'active' AND v.vdate <= :as_of2{$visibilitySql} THEN v.vdate END) AS last_activity
               FROM {$table} p
               JOIN ledger_accounts l ON l.linked_type = :t AND l.linked_id = p.id
          LEFT JOIN voucher_entries e ON e.ledger_id = l.id
          LEFT JOIN vouchers v ON v.id = e.voucher_id
              GROUP BY p.id, p.name, p.mobile, l.id, l.opening_balance, l.opening_type
              ORDER BY p.name",
            ['t' => $partyType, 'as_of' => $asOf, 'as_of2' => $asOf]
        );

        $out = [];
        $total = 0.0;
        foreach ($rows as $r) {
            $opening = (float) $r['opening_balance'] * ($r['opening_type'] === 'cr' ? -1 : 1);
            $balance = ($opening + (float) $r['net']) * $sign;   // positive = outstanding
            if ($balance < 0.005) {
                continue;
            }
            $total += $balance;
            $out[] = [
                'party_id' => (int) $r['id'],
                'name' => $r['name'],
                'mobile' => $r['mobile'],
                'ledger_id' => (int) $r['ledger_id'],
                'balance' => round($balance, 2),
                'last_activity' => $r['last_activity'],
            ];
        }

        usort($out, static fn (array $a, array $b): int => $b['balance'] <=> $a['balance']);
        return ['rows' => $out, 'total' => round($total, 2)];
    }
}
