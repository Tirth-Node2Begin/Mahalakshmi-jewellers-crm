# 08 — Vendor Module

> Dedicated vendor section: master data, purchases that feed inventory + accounting in one shot, payments, and per-vendor ledger.

---

## 1. Vendor master (`/vendors`)

- **List:** search (name/firm/phone/GSTIN), type filter, balance column (payable shown red), active toggle.
- **Detail page (`?id=`):** profile card + tabs: Purchases | Payments | Ledger. Balance = opening ± Σ ledger entries (computed, never stored).
- **Form fields:** code (auto VEN-0001), name, firm name, phone, WhatsApp, email, address, GSTIN (validated format), vendor type (metal supplier / jewellery supplier / karigar / service), opening balance + dr/cr, notes.
- Creating a vendor auto-creates its party ledger under Accounts Payable (see 05 §1).
- Deactivate only (no delete); blocked if balance ≠ 0 without confirmation.

## 2. Purchase entry (`/purchases/new`)

```
1. Pick vendor (search) + date + vendor bill ref
2. Add lines — two line kinds:
   a. Tagged piece:  description, category, metal, purity, gross/net/stone wt,
                     making cost, rate/gm, amount  → creates the items row + IN stock
   b. Bulk:          pick existing bulk SKU (or create), qty, weight, rate/gm, amount → IN row
3. GST per line (input tax), totals, round-off
4. Save → ONE transaction: PUR number (locked sequence) → items/stock_ledger IN rows
   → V3 voucher (Dr Inventory + Dr GST Input / Cr Vendor) → audit
```

After save: option to print tags for the new tagged pieces immediately.

**Cancel purchase** (`purchases.cancel`): blocked if any of its tagged items already sold; otherwise reversal stock rows + voucher cancelled + items removed from stock (status `removed`), reason mandatory.

## 3. Vendor payments (`/vendors/payments`)

- Pick vendor → see outstanding purchases + on-account balance → amount, mode (cash/upi/bank/card/cheque), ref no (UTR/cheque), optional link to a specific purchase.
- Saves PAY number + V4 voucher (Dr Vendor / Cr Cash-Bank); purchase `paid_amount` recomputed when linked.
- Karigar making-charge payouts in MVP: recorded as a **service purchase** (line kind bulk-less: description + amount, posts Dr Wages & Karigar / Cr Vendor) or direct expense to the karigar vendor — keeps Phase-2 manufacturing migration clean.

## 4. Reports

- **Vendor ledger statement** — opening + chronological + running balance, printable.
- **Vendor outstanding (AP)** — all vendors with payable balances, aged 0–30/31–60/61–90/90+.
- **Purchase register** — date range, by vendor/metal, with GST input totals (feeds GST summary).

## 5. Permissions recap

`vendors.view/create/edit/ledger`, `purchases.view/create/cancel`, `payments.vendor` — matrix in 03 §8 (Cashier sees none of this; Inventory Manager can create purchases but not pay).
