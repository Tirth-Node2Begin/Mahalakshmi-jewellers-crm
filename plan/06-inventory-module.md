# 06 — Inventory Module (Gold & Silver)

> Weight-first inventory. Two tracking modes, one stock ledger, recomputable stock, daily rates.

---

## 1. Item lifecycle

### Tagged pieces (`tracking='tagged'`)
One `items` row = one physical piece with its own tag/barcode (and HUID if hallmarked gold).

```
purchase / opening stock
   → items row created, status 'in_stock', stock_ledger IN (qty 1, weight, cost)
   → [optional] print tag/barcode from item page
sale draft added → no change (drafts touch nothing)
finalize bill    → row-lock, status 'in_stock' → 'sold', stock_ledger OUT
cancel bill      → status back to 'in_stock', reversal IN row
adjustment       → status 'removed' (lost/scrapped), OUT row with mandatory reason
```

`status='billing'` is reserved as an explicit guard only if we later add multi-step checkout; MVP relies on `FOR UPDATE` + status check at finalize.

### Bulk SKUs (`tracking='bulk'`)
One `items` row = a pool (raw gold, silver coins 10g, old metal buckets). Quantity/weight live **only** in `stock_ledger`; current = Σ(in) − Σ(out). Selling from bulk lets the cashier type qty + actual weighed weight.

### Old Metal (exchange intake)
System bulk SKUs per metal+purity under the locked "Old Metal" category. Invoice exchange lines write IN rows here at the credited value. Later melting/refining (Phase 2) will consume them; MVP can move them out via adjustment or a purchase-return-style sale to a refiner (recorded as a plain sale from the bulk SKU).

## 2. Valuation — weighted average per bucket

Bucket = (metal, purity). On every IN: `new_avg = (cur_value + in_value) / (cur_weight + in_weight)`, computed on the fly from the ledger (not stored). OUT rows (sales COGS, adjustments) value at current avg. Tagged pieces carry their own `cost_value` from purchase; COGS for tagged = its actual cost (more accurate than bucket avg).

## 3. Daily metal rates

- `/rates` screen: two big inputs per active purity (Gold 24K/22K/18K, Silver 999/925), one Save. <15 seconds to complete.
- Billing pulls the rate for the bill date; if today's rate is missing, billing screen shows a blocking banner "Enter today's rate first" (owner-configurable to fall back to last rate with warning).
- Rates are **stamped** onto invoice lines — historic bills never change.
- Rate history table + simple trend line on the rates page.

## 4. Screens

| screen | contents |
|---|---|
| Stock summary | cards per metal: total pieces, total weight, total value; table by purity × category; filters |
| Item list | search (code/name/barcode/HUID), filters (metal/purity/category/status), photo thumbnail, badge for status |
| Item form | fields per 01 §items; tagged vs bulk toggle changes visible fields; weight fields validate `net ≤ gross`, `stone = gross − net` helper |
| Tag print | barcode (code128 of item code) + name, weight, purity — 1-click from item row |
| Movements | stock_ledger register with ref links (click through to the bill/purchase) |
| Adjustment | pick item, direction, qty/weight, reason (mandatory), permission `stock.adjust`; confirm dialog |
| Opening stock | guided bulk-entry screen used during setup (permission `stock.opening`), posts `opening` ledger rows + V7 voucher |

## 5. Reports

- **Stock summary** (as screen, exportable) — by metal/purity/category: pieces, grams, avg cost, value.
- **Stock movement register** — date range, per item or all.
- **Dead stock** — tagged items `in_stock` with stock-in date older than N days (setting, default 180).
- **Old metal on hand** — the exchange buckets.

## 6. Rules & guards

- Weight validations: > 0, `net_weight ≤ gross_weight`, 3dp max.
- HUID: 6-char alphanumeric when present, unique across items; warning (not block) if a gold tagged item is saved without HUID.
- Deactivating an item requires zero stock (bulk) or non-`in_stock` status (tagged).
- Barcode/HUID/code lookups are indexed single-row hits — instant at the counter.
- Every mutation writes `audit_log`; adjustments additionally always carry the reason into the audit row.
