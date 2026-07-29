# 05 — Accounting Module

> Double-entry underneath, invisible on top. Staff enter business documents (bill, purchase, payment, expense); `VoucherService` posts balanced vouchers automatically. Only the Accounting section exposes ledger language.

---

## 1. Chart of Accounts

3-level: **Group → Subgroup → Ledger** (`account_groups` tree + `ledger_accounts`). Seeded structure (see 01 §Seeded data) is `is_system` locked — admin can add ledgers/subgroups but cannot rename/delete system ones. Party ledgers (one per customer/vendor) auto-created and hidden from manual COA editing.

## 2. Voucher posting map (source of truth for `VoucherService`)

All postings happen at **finalize** time, inside the same transaction as the business document. `[GST]` = split CGST/SGST (intra-state) or IGST (inter-state by party GSTIN state code).

### V1. Sale invoice (finalize)
| Dr | Cr | amount |
|---|---|---|
| Customer ledger (or Cash if walk-in paid instantly — still route via customer-less receivable? **No:** walk-in full-cash bills post Dr Cash directly) | | grand_total |
| | Gold Sales / Silver Sales (per line's metal) | Σ metal_value per metal |
| | Making Charges Income | making_total |
| | GST Payable [GST] | tax |
| Discount Given | | discount (if any) |
| Inventory – Old Metal | | old_metal_value (exchange lines) |

COGS posting: Dr **Metal Purchases (COGS)** / Cr **Inventory – Gold/Silver** at the items' weighted-average **cost** value — posted with the same voucher so P&L is true gross profit, not sales-only.

### V2. Customer receipt
Dr Cash/Bank(mode) — Cr Customer ledger. On-account receipts allowed (no invoice link).

### V3. Purchase (finalize)
Dr Inventory – Gold/Silver (metal value) + Dr GST Input — Cr Vendor ledger (grand_total).

### V4. Vendor payment
Dr Vendor ledger — Cr Cash/Bank(mode).

### V5. Expense
Dr chosen Expense ledger — Cr Cash/Bank (paid_from).

### V6. Stock adjustment
Out (loss): Dr Stock Adjustment Loss — Cr Inventory–metal (at avg cost). In (found/opening correction): reverse.

### V7. Opening balances (setup)
Party/cash/bank/inventory openings post against a locked **Opening Balances Equity** ledger.

### V8. Journal (manual, `accounting.journal`, admin/accountant only)
Free-form balanced entry; UI enforces ΣDr=ΣCr before submit.

### Cancellations
Cancelling any document marks its voucher `cancelled` (excluded from every report by `status='active'` filter) and writes reversal stock rows where stock moved. No deletions ever.

## 3. Reports (computation rules)

- **Trial Balance:** per ledger, opening ± Σ(dr−cr) of active vouchers in range; must net to zero (automated check).
- **P&L (headline report):** date range → Income nature ledgers (Cr−Dr) minus Expense nature ledgers (Dr−Cr). Layout: Sales (gold/silver split) + Making Income − COGS = **Gross Profit**; − operating expenses = **Net Profit**, shown big and plain.
- **Ledger statement:** opening balance + chronological entries + running balance; used for customer/vendor/cash/bank pages.
- **Day book:** all active vouchers of a date, grouped by type.
- **Cash/Bank book:** ledger statements of linked_type cash/bank.
- **Outstanding:** customer = Dr balance of party ledgers (aged 0–30/31–60/61–90/90+); vendor = Cr balances.
- **GST summary:** from invoice/purchase tax columns (not the ledger) for line-level accuracy: outward turnover split by treatment (taxable by rate / exempt / nil-rated / non-GST), inward input tax, net payable. CSV export shaped for the CA. Includes a reconciliation line proving total outward turnover here = total sales in the P&L for the same period. *(Portal e-filing integration is Phase 2+.)*

## 3a. Tax treatments (how a "no GST charged" line is handled correctly)

Some real transactions legitimately carry no output GST. Each invoice line therefore carries a `tax_treatment` (schema 01 §27):

| treatment | when it applies | posting |
|---|---|---|
| `taxable` | default — normal jewellery sale | Cr Sales + Cr GST Payable |
| `exempt` / `nil_rated` | goods notified exempt or nil-rated | Cr Sales only; reported in the exempt column of GST summary |
| `non_gst` | genuinely outside GST scope | Cr Sales only; separate GST-summary bucket |
| `reverse_charge` | recipient liable (rare in retail; relevant for some services) | Cr Sales; no output tax, flagged for the CA |

Hard rules:
1. Any treatment other than `taxable` requires a written `exempt_reason` and is written to `audit_log`.
2. **A non-taxable line is still a full sale** — same income posting, same COGS, same stock-ledger movement. Tax treatment changes only the tax component. There is no configuration anywhere in this system that records a sale outside the ledger or outside stock.
3. The GST summary reports taxable / exempt / nil-rated / non-GST turnover side by side, so the CA sees the complete picture in one sheet and the totals tie back to the sales register.
4. Selecting a non-taxable treatment is permission-gated (`invoices.override`) — a cashier cannot silently mark sales exempt.

**GST-inclusive pricing** (`invoices.price_mode='inclusive'`): when the customer negotiates a final all-in figure, the line stores that figure and the tax is back-calculated (`tax = amount × rate ÷ (100 + rate)`), so the invoice still shows the correct tax split and the shop's income is correspondingly lower. This is the legitimate answer to "the customer doesn't want to pay GST on top" — the tax is still charged and remitted, it just sits inside the agreed price.

## 4. Rules & guards

- Fiscal year Apr 1–Mar 31; reports default to current FY; no hard year-end closing in MVP (P&L is range-based).
- Voucher dates cannot be in the future; back-dating beyond N days (setting, default 3) requires `accounting.journal` permission.
- GST rates come from settings/HSN defaults (jewellery 3%; making charge rate configurable — **confirm split-billing treatment with the client's CA before go-live**).
- Rounding: line amounts round half-up to 2dp; invoice `round_off` reconciles grand total to nearest rupee (max ±0.50) and posts to Misc Income/Expense.
- Every report screen: date-range picker, Print, CSV export. Nothing else.
