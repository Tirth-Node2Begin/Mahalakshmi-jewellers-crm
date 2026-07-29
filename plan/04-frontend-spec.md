# 04 — Frontend Spec (Next.js)

> Stack locked: **Next.js (App Router, npm)**, TypeScript, **CSR-only** (`output:'export'` for production — no SSR, no middleware, no dynamic route segments; detail pages use `?id=` query strings). Tailwind CSS, TanStack Query v5, react-hook-form + zod, sonner toasts, Recharts (dashboard only, dynamically imported).

---

## 1. UI/UX principle: SIMPLE FIRST

The client's staff are jewellers, not software people. Every screen follows these rules:

1. **One job per screen.** No tabs-inside-tabs, no hidden menus. Big page title says what the screen does.
2. **Big touch-friendly controls** — large buttons, large inputs, generous spacing; works on a counter tablet.
3. **Plain language labels** — "Today's Gold Rate", "New Bill", "Money Received", "Stock In" — never accounting jargon on operational screens (no "Dr/Cr", no "voucher" outside the Accounting section; accountant screens may use proper terms).
4. **Numbers formatted Indian style** — ₹1,23,456.00; weights as `12.350 g`.
5. **3 clicks to a bill:** Dashboard → New Bill → scan/search item → Save & Print.
6. **Keyboard-first billing:** barcode scanner types into a focused search box; Enter adds item; F-key shortcuts for Save/Print.
7. **Errors in human words:** "This item was just billed on another counter" — never error codes.
8. **Confirmation only when destructive** (cancel bill, adjust stock); normal saves are instant with a toast.

## 2. Design system

- Clean light theme, white cards on a soft grey background, one accent colour (deep gold `#B8860B` family — final palette decided at build time in `style.md`), high contrast text.
- Font: single sans (DM Sans or Inter), large sizes (base 15–16px).
- Components: shadcn-style primitives (Button, Input, Select, Dialog, Table, Card, Badge, DatePicker) built once in `components/ui/`, used everywhere — no ad-hoc styling.
- Status colours: green = paid/in-stock, amber = partial/draft, red = due/cancelled.
- Print styles: dedicated print CSS for invoices (A4/A5 + thermal 80mm variant).

## 3. Folder structure

```
frontend/src/
  app/                    (routes below)
  components/ui/          shared primitives
  components/layout/      Sidebar, Topbar, PageHeader
  features/<domain>/{api,keys,types,schemas,hooks,components}
  lib/                    api client (fetch wrapper w/ envelope + CSRF), formatters (₹, grams), constants
```

## 4. Routes / pages

| route | page | who sees it (permission) |
|---|---|---|
| `/login` | split-panel simple login | public |
| `/` | Dashboard: today's sales total, cash received, today's rates (big card), recent bills, dues summary | dashboard.view |
| `/billing/new` | New Bill (the flagship screen — see 07) | invoices.create |
| `/billing` | Bill list (filters: date, status, customer) + `?id=` detail/print | invoices.view |
| `/billing/estimates` | Estimate/quotation list + new estimate + `?id=` print/convert | estimates.* |
| `/billing/receipts` | Money received list + new receipt | payments.* |
| `/rates` | Today's rates entry + history | rates.set (entry), all (view) |
| `/inventory` | Stock summary (by metal/purity/category; pieces + weight + value) | stock.view |
| `/inventory/items` | Item list + add/edit item (tagged & bulk), print tag/barcode | items.* |
| `/inventory/movements` | Stock movement register | stock.view |
| `/inventory/adjust` | Stock adjustment (reason mandatory) | stock.adjust |
| `/purchases` | Purchase list + `?id=` detail | purchases.view |
| `/purchases/new` | New purchase entry | purchases.create |
| `/vendors` | Vendor list + `?id=` detail page (profile, purchases, payments, ledger, balance) | vendors.* |
| `/vendors/payments` | Vendor payment entry + list | payments.vendor |
| `/customers` | Customer list + `?id=` detail (profile, bills, receipts, ledger, outstanding) | customers.* |
| `/expenses` | Expense list + quick add | expenses.* |
| `/accounting` | COA tree, ledger browser, journal entry (accountant-facing; proper terms allowed here) | accounting.* |
| `/reports` | Report hub — cards linking to each report, each with date-range picker + table + Print/Excel(CSV) export | per-report perms |
| `/reports/pnl` | Profit & Loss (the client's headline report — simple two-column layout, big net-profit figure) | reports.pnl |
| `/admin/users` `/admin/roles` `/admin/settings` `/admin/audit` | admin section | users/roles/settings/audit perms |

Navigation: fixed left sidebar grouped (Billing, Inventory, Purchases, Parties, Accounting, Reports, Admin) — **items filtered by `nav.php` permissions**; a cashier literally sees only Billing + Rates + Customers.

## 5. Data layer conventions

- One `apiFetch()` wrapper: attaches CSRF header, unwraps envelope, throws typed `ApiError`; 401 → redirect to login.
- TanStack Query: query keys in `features/<domain>/keys.ts`; mutations invalidate precisely (finalizing a bill invalidates invoices, stock, dashboard, outstanding).
- Forms: react-hook-form + zod schema per form (mirrors server validation); inline field errors.
- Draft bill state kept server-side (draft invoice) so a counter can recover after refresh/crash — not just local state.

## 6. Simplicity checkpoints (test with the client)

- Owner can find today's profit in ≤2 clicks (Dashboard shows it if permitted, or Reports → P&L).
- Cashier can complete a walk-in cash bill in <60 seconds.
- Inventory manager can enter today's rates in <15 seconds.
- Every list has: search box, date filter where relevant, and nothing else above the fold.
