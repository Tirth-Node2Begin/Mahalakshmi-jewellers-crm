# 14 — Reports & Analytics

> Two surfaces, ported from the old CRM's proven patterns: a **role-based main dashboard** (`/`)
> and a **tabbed Reports page** (`/reports`). Plus the two integration dashboards
> ([12 Google](12-dashboard-google.md), [13 Facebook](13-dashboard-facebook.md)) which are
> their own pages. All charts = Recharts via dynamic import (`ssr:false`), chart JSX in sibling
> files, shared `CustomTooltip` (unit-aware ₹/%/counts), `ResponsiveContainer` everywhere.

Chart palette (tokens, values in [style.md §2](../style.md) via [04 §6](04-frontend-architecture.md) —
consumed as `var(--chart-*)`, never literal hex, so charts follow dark mode): `--chart-1`
income/positive (green) · `--chart-2` expense/negative (coral) · `--chart-3` pending/warning
(amber) · `--chart-4` primary series (purple) · `--chart-5` secondary (pink).

---

## 1. Main Dashboard — `/` (role-routed)

Three hand-designed variants map to Sejal Jeweller's **fixed 4-role model** (`database/seed.php` §2:
`super_admin`, `admin`, `billing_officer`, `inventory`). There is **no dashboard builder** — the
layouts are fixed. `DashboardRepository::resolveVariant($user)` picks the variant; the frontend
`page.tsx` switches on the payload's `variant` discriminator (`executive | sales | inventory`) and
renders `features/dashboard/variants/<variant>.tsx`.

**RBAC (both ends):** each variant queries **only** data its role is granted. The `executive`
variant is additionally gated section-by-section with `PermissionService::can()`: a denied section
is returned empty (`[]`/`null`/`0`), so a lesser or custom role that resolves to it sees no data it
isn't granted (no permission leak). The four seeded roles are all `data_scope='all'`; executive's
lead/invoice helpers are not owner-scoped, so a future `own`-scope custom role would need its own
scoped branch in `resolveVariant()` rather than reusing executive. On the frontend, quick-action
buttons are gated with `usePermissions().can()`.

### `executive` — super_admin, admin (default, comprehensive)

| Row | Widgets |
|---|---|
| Quick actions | Add enquiry (`leads.create`) · New invoice (`invoices.create`) · New order (`orders.create`) · Add stock (`inventory.manage`) |
| Alerts | overdue follow-ups · overdue invoices · low stock · pending leave approvals (each links to filtered page) |
| KPI grid | This-month Revenue (invoice payments) · Expenses · Net (P&L) · Open Pipeline ₹ · Outstanding ₹ · Open orders + repairs |
| Charts | **Cashflow area chart** (payments in vs expenses out, 12 months) · Lead funnel (status counts) |
| Lists | Today's follow-ups · This week's meetings · Recent payments · Recent expenses |
| Secondary | Custom orders by status · Low-stock list · Attendance today · Upcoming occasions (7d) |

### `sales` — billing_officer (enquiries, custom-order review, billing & collections)
No expense/HR visibility (role lacks `expenses.read` / `hr.read`).

| Row | Widgets |
|---|---|
| Quick actions | Add enquiry · New sale (`invoices.create`) · New custom order · Take payment (`payments.create`) |
| Alerts | overdue follow-ups · orders awaiting review · overdue invoices · low stock |
| KPI grid | Collections (mo) · Outstanding ₹ · Open Pipeline ₹ · Open enquiries · Orders in progress · Awaiting review |
| Charts | **Collections area chart** (single series, 12 months — no spend) · Enquiry funnel |
| Lists | Today's follow-ups · Orders awaiting review · This week's meetings · Recent payments |
| Secondary | Upcoming occasions — reach out (birthdays/anniversaries, 7d) |

### `inventory` — inventory (metal is capital: stock value, production & repair queues)
No lead/invoice/expense/HR visibility.

| Row | Widgets |
|---|---|
| Quick actions | Add stock item (`inventory.manage`) · Adjust stock (`inventory.adjust`) · Record purchase (`vendors.manage`) · Vendors (`vendors.read`) |
| Alerts | low stock · orders in production · repairs on bench · dead stock (90d idle) |
| KPI grid | Stock value ₹ · Raw-material value ₹ · Finished-stock value ₹ · Low-stock items · In production · Stock in (mo) ₹ (value of `type='in'` ledger movements this month — from the inventory ledger, NOT the `purchases` finance table, which has no read grant) |
| Charts/lists | Stock value by category (₹ bars) · Low-stock list |
| Queues | Production queue (orders `in_production`) · Repairs on the bench (`received/diagnosed/in_progress/quality_check`) |
| Secondary | Recent stock movements (in/out, reason-labelled) |

Backend: `/api/dashboard.php` (`dashboard.read`) → `DashboardRepository::payload($user, $months)`
returns the resolved variant's widget payload in one call (`?months=12` for chart range).

---

## 2. Reports Page — `/reports` (tabbed)

Backend: `/api/reports.php?tab=<name>&from=&to=&granularity=` (`reports.read`; every tab also
respects optional module filters). All tabs support date range + compare-previous-period toggle
(ported compare pattern) + CSV export (`&export=csv`).

### Tab 1 — Sales (leads)
- Funnel chart: count per pipeline status (ported FunnelChart).
- Source performance table+bar: leads, conversions, conversion %, revenue attributed
  (invoices of customers whose `source_lead_id` traces to the source).
- Rep leaderboard: assigned user → leads handled, converted, revenue, avg days-to-convert.
- Trend: new leads vs conversions by week/month (dual line).
- Drop analysis: donut of drop reasons.

### Tab 2 — Revenue (invoices & payments)
- Revenue trend: billed vs collected by month (grouped bars) + cumulative area.
- **Outstanding aging**: 0-30 / 31-60 / 61-90 / 90+ stacked bar + table by customer.
- Collection by payment mode donut (cash/upi/bank/card/cheque).
- Top 10 customers by revenue (horizontal bars).
- Service-wise revenue (from invoice_items ↔ services).
- Tax summary: tax collected by rate (GST filing helper).

### Tab 3 — Expenses
Reuses the Insights engine ([10](10-module-expenses.md) page 2) embedded: trend, category donut,
payment modes — plus **P&L block**: revenue (payments) − expenses = net, by month, with a
12-month net line chart. Fixed vs Variable split area.

### Tab 4 — Customers & Works
- Lifecycle distribution (stage donut) + stage-change flow over time.
- Work throughput: created vs completed per month; avg completion days; on-time %.
- Assignee workload: open works per user (horizontal bar).
- Top customers by works + revenue; churn list (stage=churned this period).

### Tab 5 — Inventory
- Stock valuation by category (treemap-style bars, raw vs stock split).
- Movement trend: in vs out qty/value per month — `sale_reversal`/`purchase_reversal` rows are
  netted against their originals (matched on invoice_id/purchase_id) so cancelled documents
  don't inflate totals; same netting in the COGS/consumption queries.
- Consumption by work/customer (work_issue rows joined to works→customers).
- Purchase spend by supplier (top 10) · Dead stock table (no movement 90d) · Low-stock table.

### Tab 6 — HR
- Attendance %: per month org-wide + per department.
- Leave usage by type; top leave takers.
- Payroll cost trend (12 months, from payroll_runs) + department cost split.
- Late-arrivals leaderboard (grace-exceeded counts).

### Tab 7 — Marketing (cross-links)
Summary cards from the Google + Facebook caches (impressions, interactions, engagements,
follower growth this period) with "Open dashboard →" links to [12](12-dashboard-google.md)/[13](13-dashboard-facebook.md).
Website-lead correlation: webhook leads per week vs GBP website clicks (dual axis line).

---

## 3. Backend Aggregation Notes

- All aggregates are SQL `GROUP BY` queries via repositories (no cron pre-aggregation needed at
  this scale except integrations, which cache via sync — [12](12-dashboard-google.md) §6).
- Date windows: fiscal-year helper (`FiscalYear::range()`, Apr–Mar; quarters Q1 Apr-Jun …
  Q4 Jan-Mar) replaces old academic-year helper. Compare = same-length previous window
  (ported `periodRange` math).
- Money truths: revenue = `invoice_payments` (excluding bounced cheques), spend = `expenses`.
  Never sum invoices as revenue (billed ≠ collected; both are shown, labeled).
- CSV export: same query, streamed `text/csv` with `Content-Disposition` (new; old CRM lacked
  exports).
- Heavy tables get covering indexes for the group-bys: `invoice_payments(payment_date)`,
  `expenses(expense_date, category_id)`, `inventory_transactions(item_id, created_at)`,
  `leads(status, created_at)`, `employee_attendance(attendance_date)` — see [01](01-database-schema.md).

---

## 4. Permissions

`dashboard.read` (all roles) · `reports.read` (gate for /reports) · per-tab gating client + server:
sales tab needs `leads.read`, revenue `invoices.read`, expenses `expenses.read`, customers
`customers.read`, inventory `inventory.read`, hr `hr.read`, marketing `integrations.google.view`
or `integrations.facebook.view`. Server returns only the tabs the user can see
(`/api/reports.php?tabs=1` lists allowed tabs — nav renders from it).
