<?php

declare(strict_types=1);

namespace CRM\Support;

use CRM\Auth\AuthUser;
use CRM\Database\Database;

final class GstVisibility
{
    public static function restrictedUsername(?string $username): bool
    {
        return $username !== 'Admin';
    }

    public static function canUseNonGstBilling(AuthUser $user): bool
    {
        return !self::restrictedUsername($user->username)
            || self::hasExplicitPermission($user->id, 'invoices', 'non_gst');
    }

    public static function canManageNonGstAccess(AuthUser $user): bool
    {
        return !self::restrictedUsername($user->username);
    }

    public static function billingRestricted(AuthUser $user): bool
    {
        return self::restrictedUsername($user->username) && !self::canUseNonGstBilling($user);
    }

    private static function hasExplicitPermission(int $userId, string $resource, string $action): bool
    {
        return Database::fetchValue(
            "SELECT 1
               FROM user_role_assignments ura
               JOIN roles r ON r.id = ura.role_id
               JOIN role_permission_grants g ON g.role_id = r.id
               JOIN permissions p ON p.id = g.permission_id
              WHERE ura.user_id = :uid
                AND ura.is_active = 1
                AND (ura.expires_at IS NULL OR ura.expires_at > NOW())
                AND r.is_active = 1
                AND p.is_active = 1
                AND p.resource = :resource
                AND p.action = :action
              LIMIT 1",
            ['uid' => $userId, 'resource' => $resource, 'action' => $action]
        ) !== null;
    }

    public static function lineVisibleSql(string $lineAlias): string
    {
        return "{$lineAlias}.tax_treatment = 'taxable'";
    }

    public static function lineHiddenSql(string $lineAlias): string
    {
        return "{$lineAlias}.tax_treatment <> 'taxable'";
    }

    public static function invoiceVisibleTotalSql(string $invoiceAlias): string
    {
        return "COALESCE((
            SELECT SUM(visible_line.line_total)
              FROM invoice_items visible_line
             WHERE visible_line.invoice_id = {$invoiceAlias}.id
               AND " . self::lineVisibleSql('visible_line') . "
        ), 0)";
    }

    public static function invoiceAmountSql(string $invoiceAlias, bool $gstVisibleOnly): string
    {
        return $gstVisibleOnly
            ? "LEAST(" . self::invoiceVisibleTotalSql($invoiceAlias) . ", {$invoiceAlias}.grand_total)"
            : "{$invoiceAlias}.grand_total";
    }

    public static function invoicePaidSql(string $invoiceAlias, bool $gstVisibleOnly): string
    {
        if (!$gstVisibleOnly) {
            return "{$invoiceAlias}.paid_amount";
        }

        $visibleTotal = self::invoiceAmountSql($invoiceAlias, true);
        return "CASE
            WHEN {$invoiceAlias}.grand_total > 0
            THEN {$invoiceAlias}.paid_amount * ({$visibleTotal} / {$invoiceAlias}.grand_total)
            ELSE 0
        END";
    }

    public static function invoiceBalanceSql(string $invoiceAlias, bool $gstVisibleOnly): string
    {
        return "GREATEST("
            . self::invoiceAmountSql($invoiceAlias, $gstVisibleOnly)
            . " - "
            . self::invoicePaidSql($invoiceAlias, $gstVisibleOnly)
            . ", 0)";
    }

    public static function invoiceVisibleSql(string $invoiceAlias): string
    {
        return self::invoiceVisibleTotalSql($invoiceAlias) . ' > 0';
    }

    public static function paymentAmountSql(string $paymentAlias, bool $gstVisibleOnly): string
    {
        if (!$gstVisibleOnly) {
            return "{$paymentAlias}.amount";
        }

        return "CASE
            WHEN {$paymentAlias}.invoice_id IS NULL THEN {$paymentAlias}.amount
            ELSE {$paymentAlias}.amount * COALESCE(LEAST((
                SELECT SUM(visible_line.line_total)
                  FROM invoice_items visible_line
                 WHERE visible_line.invoice_id = {$paymentAlias}.invoice_id
                   AND " . self::lineVisibleSql('visible_line') . "
            ) / NULLIF((
                SELECT paid_invoice.grand_total
                  FROM invoices paid_invoice
                 WHERE paid_invoice.id = {$paymentAlias}.invoice_id
            ), 0), 1), 0)
        END";
    }

    public static function paymentVisibleSql(string $paymentAlias): string
    {
        return "(
            {$paymentAlias}.invoice_id IS NULL
            OR COALESCE((
                SELECT SUM(visible_line.line_total)
                  FROM invoice_items visible_line
                 WHERE visible_line.invoice_id = {$paymentAlias}.invoice_id
                   AND " . self::lineVisibleSql('visible_line') . "
            ), 0) > 0
        )";
    }

    public static function stockMovementVisibleSql(string $transactionAlias): string
    {
        return "(
            {$transactionAlias}.invoice_id IS NULL
            OR {$transactionAlias}.reason NOT IN ('sale', 'sale_reversal')
            OR EXISTS (
                SELECT 1
                  FROM invoice_items visible_stock_line
                 WHERE visible_stock_line.invoice_id = {$transactionAlias}.invoice_id
                   AND visible_stock_line.inventory_item_id = {$transactionAlias}.item_id
                   AND " . self::lineVisibleSql('visible_stock_line') . "
            )
        )";
    }

    /**
     * Project visible stock movements for the GST-only account.
     *
     * Non-GST sale rows are hidden from that account, so their stock effect is
     * applied by reducing visible inward rows for the same item. Source
     * inventory_transactions remain unchanged.
     *
     * @param array<int,array<string,mixed>> $movements
     * @return array<int,array<string,mixed>>
     */
    public static function projectHiddenSaleStockOut(array $movements, string $from, string $to, ?int $itemId = null): array
    {
        if ($movements === []) {
            return [];
        }

        $params = ['from' => $from, 'to' => $to];
        $itemFilter = '';
        if ($itemId !== null) {
            $itemFilter = ' AND t.item_id = :item_id';
            $params['item_id'] = $itemId;
        }

        $hiddenRows = Database::fetchAll(
            "SELECT t.item_id,
                    COALESCE(SUM(CASE WHEN t.type = 'out' THEN t.qty ELSE -t.qty END), 0) AS qty,
                    COALESCE(SUM(CASE WHEN t.type = 'out' THEN t.weight ELSE -t.weight END), 0) AS weight,
                    COALESCE(SUM(CASE WHEN t.type = 'out' THEN t.value ELSE -t.value END), 0) AS value
               FROM inventory_transactions t
              WHERE DATE(t.created_at) BETWEEN :from AND :to{$itemFilter}
                AND NOT " . self::stockMovementVisibleSql('t') . '
              GROUP BY t.item_id',
            $params
        );

        $remaining = [];
        foreach ($hiddenRows as $row) {
            $bucket = [
                'qty' => max(0.0, (float) ($row['qty'] ?? 0)),
                'weight' => max(0.0, (float) ($row['weight'] ?? 0)),
                'value' => max(0.0, (float) ($row['value'] ?? 0)),
            ];
            if (!self::isEmptyMovementBucket($bucket)) {
                $remaining[(int) $row['item_id']] = $bucket;
            }
        }

        if ($remaining === []) {
            return $movements;
        }

        $projected = [];
        foreach ($movements as $movement) {
            $movementItemId = (int) ($movement['item_id'] ?? 0);
            if (($movement['type'] ?? '') === 'in' && isset($remaining[$movementItemId])) {
                $movement = self::reduceMovementByBucket($movement, $remaining[$movementItemId]);
                if (self::isEmptyMovementRow($movement)) {
                    continue;
                }
                if (self::isEmptyMovementBucket($remaining[$movementItemId])) {
                    unset($remaining[$movementItemId]);
                }
            }
            $projected[] = $movement;
        }

        return array_values($projected);
    }

    /** @param array<string,mixed> $movement @param array{qty:float,weight:float,value:float} $remaining */
    private static function reduceMovementByBucket(array $movement, array &$remaining): array
    {
        $rowQty = max(0.0, (float) ($movement['qty'] ?? 0));
        $rowWeight = max(0.0, (float) ($movement['weight'] ?? 0));
        $rowValue = max(0.0, (float) ($movement['value'] ?? 0));

        $remainingQty = max(0.0, (float) ($remaining['qty'] ?? 0));
        $remainingWeight = max(0.0, (float) ($remaining['weight'] ?? 0));
        $remainingValue = max(0.0, (float) ($remaining['value'] ?? 0));

        $takeQty = 0.0;
        $takeWeight = 0.0;
        $takeValue = 0.0;
        $share = 1.0;

        if ($remainingQty > 0.0005) {
            $takeQty = min($rowQty, $remainingQty);
            $share = $takeQty / $remainingQty;
            $takeWeight = min($rowWeight, $remainingWeight * $share);
            $takeValue = min($rowValue, $remainingValue * $share);
        } elseif ($remainingWeight > 0.0005) {
            $takeWeight = min($rowWeight, $remainingWeight);
            $share = $takeWeight / $remainingWeight;
            $takeValue = min($rowValue, $remainingValue * $share);
        } elseif ($remainingValue > 0.005) {
            $takeValue = min($rowValue, $remainingValue);
        }

        $movement['qty'] = round($rowQty - $takeQty, 3);
        $movement['weight'] = round($rowWeight - $takeWeight, 3);
        $movement['value'] = round($rowValue - $takeValue, 2);
        $movement['stock_projected'] = true;

        $remaining['qty'] = round($remainingQty - $takeQty, 3);
        $remaining['weight'] = round($remainingWeight - $takeWeight, 3);
        $remaining['value'] = round($remainingValue - $takeValue, 2);

        return $movement;
    }

    /** @param array{qty:float,weight:float,value:float} $bucket */
    private static function isEmptyMovementBucket(array $bucket): bool
    {
        return abs((float) ($bucket['qty'] ?? 0)) < 0.0005
            && abs((float) ($bucket['weight'] ?? 0)) < 0.0005
            && abs((float) ($bucket['value'] ?? 0)) < 0.005;
    }

    /** @param array<string,mixed> $movement */
    private static function isEmptyMovementRow(array $movement): bool
    {
        return abs((float) ($movement['qty'] ?? 0)) < 0.0005
            && abs((float) ($movement['weight'] ?? 0)) < 0.0005
            && abs((float) ($movement['value'] ?? 0)) < 0.005;
    }
}
