# 07 — Billing Module (Multi-counter safe)

> The flagship screen. Multiple counters bill simultaneously with zero collisions, and one finalize = one atomic transaction covering stock + accounting + payment.

---

## 1. New Bill screen flow (`/billing/new`)

```
1. Customer strip: phone search → existing customer | "+ new" (name+phone only, 5s) | Walk-in (default)
2. Item area: focused search box (barcode scanner types here) — scan/enter code/HUID/name
   → tagged item: added with its weight, purity, auto price
   → bulk item: mini-dialog asks qty + weighed weight
3. Line auto-price: net_wt × rate(bill date, purity) × — rate already purity-specific — + making + GST
   Manual rate/making override → allowed only with invoices.override, flagged + audited
4. Old metal exchange (optional panel): metal, purity, gross wt, deduction %, rate → credit value
5. Totals panel: metal + making − discount + GST − old metal ± round-off = Grand Total (big)
6. Payment: mode chips (Cash / UPI / Card / Bank / Cheque), amount(s) — split allowed;
   unpaid remainder → customer outstanding (blocked for walk-ins: walk-in must pay in full)
7. [Save Draft]  [Finalize & Print]
```

Multiple drafts per counter: a "Held bills" tray lists this user's drafts; one click resumes. Drafts have **no invoice number, no stock/ledger effect**.

## 2. Finalize — the atomic transaction

Inside ONE `Database::transaction()`:

```
 1. Reload draft; validate lines, totals server-side (never trust client math)
 2. For each tagged line: SELECT … FOR UPDATE on items row; status must be 'in_stock'
      else → 409 "Item <code> was just billed on another counter" (whole txn rolls back)
 3. For each bulk line: recompute current stock FOR UPDATE (lock SKU row); qty/weight must suffice
 4. SequenceService::next('INV') → SELECT FOR UPDATE on number_sequences → INV-2627-00001
 5. invoice: status draft→final, number + finalized_at set
 6. stock_ledger OUT rows; tagged items status → 'sold'
 7. VoucherService: V1 sale posting + COGS (see 05) — balanced or throw
 8. invoice_old_metal → stock_ledger IN rows to Old Metal bucket
 9. invoice_payments rows + V2 receipt entries for amounts paid now
10. paid_amount recomputed from invoice_payments
11. Audit row
COMMIT  → print payload returned
```

Deadlock-safety: items locked in ascending id order; deadlock → automatic retry (3×) then clean error. **Guarantees:** unique gap-free numbers, no double-sold piece, no negative bulk stock, books always balanced — verified by the stress test in 10.

## 3. Cancel bill (`invoices.cancel`, reason mandatory)

Reversal in one transaction: voucher → cancelled; tagged items back to `in_stock` (reversal IN rows); bulk reversal rows; old-metal intake reversed; unlinked receipts remain as customer on-account credit (accountant decides refund via payment). Cancelled bills stay visible, struck-through.

## 3a. Estimates / quotations (`/billing/estimates`)

For customers who want a price before committing. Same item-entry UI as the bill screen, but the output is a quotation, not a bill.

- Creates an `EST-2627-00001` number from its own sequence — **never** consumes an invoice number.
- **No stock movement, no ledger posting, no tax liability.** An estimate is a piece of paper with a price on it.
- Print is watermarked `ESTIMATE — NOT A TAX INVOICE`, shows an indicative tax figure, and carries `Valid until <date>` (default +7 days, because metal rates move).
- **Convert to bill:** one click → creates a normal draft invoice pre-filled from the estimate, re-priced at today's rate (or holding the quoted rate if still within validity and the user confirms). From there it goes through the standard finalize transaction in §2 — full GST, full stock, full ledger.
- Estimate list shows status (open / converted / expired / cancelled) so nothing quoted is forgotten.
- Permission: `estimates.view` / `estimates.create` — cashiers get both.

## 3b. Pricing modes and non-taxable lines

- **Tax-exclusive (default):** metal + making, then GST added on top.
- **Tax-inclusive:** the cashier types the final agreed figure; the system back-calculates the tax inside it (05 §3a). Use this when a customer negotiates an all-in price — the tax is still charged and remitted, it simply sits within the agreed amount.
- **Per-line tax treatment** (taxable / exempt / nil-rated / non-GST / reverse-charge) with a mandatory reason, gated behind `invoices.override` and always audited. A non-taxable line is still a complete sale: same income posting, same COGS, same stock movement.

## 4. Receipts (money received later)

`/billing/receipts`: pick customer → open bills with dues shown → amount + mode → RCPT number + V2 posting; invoice `paid_amount` recomputed. On-account receipts (no bill) allowed.

## 5. Print formats

- **A4/A5 GST invoice:** shop header + GSTIN, customer, lines (description, HUID, gross/net wt, rate, making, amount), tax split table (CGST/SGST per rate), old-metal credit line, amount in words, terms footer. Print CSS — no PDF library needed for MVP (browser print).
- **Thermal 80mm** compact variant for quick counter receipts.
- Duplicate/reprint anytime from bill detail (`invoices.view`), marked "DUPLICATE".

## 6. Edge rules

- Bill date = today by default; back-dating limited (setting) and permission-gated.
- Discount capped by setting (% of bill) unless `invoices.override`.
- Walk-in bills require full payment; converting a walk-in to a saved customer moves the bill to their ledger.
- If today's rate missing → blocking banner (see 06 §3).
- Every finalize/cancel/override lands in `audit_log` with user + timestamp.
