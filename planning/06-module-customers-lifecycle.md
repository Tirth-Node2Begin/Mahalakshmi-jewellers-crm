# 06 — Customers & Lifecycle Module

> The destination of every converted lead, and the hub the rest of the CRM revolves around:
> works (jobs) get assigned to team members, invoices bill the customer, the timeline shows
> everything. Deliberately simple: one stage field + a works pipeline + an event timeline.

---

## 1. Concepts

- **Customer** — a person/company we do business with. Created by lead conversion (prefilled) or
  directly. Auto customer code `CUST-0001` (number_sequences).
- **Lifecycle stage** — one enum on the customer:
  `onboarding → active → inactive → churned` (+ computed health hints from data: last work date,
  unpaid invoices). Stage changes are manual (dropdown) but the UI suggests them
  (e.g. "no work in 90 days → mark inactive?"). Every change logs a timeline event.
- **Work** — a unit of delivery for a customer ("website redesign", "50 chairs order").
  Has a service type, an assignee, dates, priority and a status pipeline. Auto code `WRK-0001`.
- **Timeline** — `customer_events`: created_from_lead, stage_changed, work_created,
  work_status_changed, invoice_created, payment_received, note_added — written by the owning
  modules via a shared `CustomerTimeline::log()` helper.
- **Services catalog** — shared taxonomy (also used by leads + invoice items).

---

## 2. Database Tables

```sql
services                                  -- shared catalog (leads, works, invoices)
  id INT PK AI, name VARCHAR(150) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  default_rate DECIMAL(12,2) NULL,        -- prefills invoice line rate
  is_active TINYINT(1) DEFAULT 1, created_at TIMESTAMP

customers
  id INT PK AI,
  customer_code VARCHAR(20) NOT NULL UNIQUE,      -- CUST-0001
  name VARCHAR(150) NOT NULL,
  company VARCHAR(150) NULL, gstin VARCHAR(20) NULL,
  mobile VARCHAR(20) NULL, email VARCHAR(150) NULL,
  address VARCHAR(255) NULL, city VARCHAR(100) NULL, state VARCHAR(100) NULL,
  pincode VARCHAR(10) NULL,
  stage ENUM('onboarding','active','inactive','churned') DEFAULT 'onboarding',
  assigned_to INT NULL FK users SET NULL,          -- account owner
  source_lead_id INT NULL FK leads SET NULL,       -- back-pointer when converted;
                                                   -- cleared (NULL) if the conversion is reverted (05 §1)
  referred_by_customer_id INT NULL FK customers SET NULL,
  notes TEXT, tags_json JSON NULL,
  is_active TINYINT(1) DEFAULT 1,                  -- soft archive
  created_by INT NULL FK users SET NULL,
  created_at TIMESTAMP, updated_at TIMESTAMP
  INDEX (stage), (mobile), (email), (assigned_to), (created_at)

works
  id INT PK AI,
  work_code VARCHAR(20) NOT NULL UNIQUE,           -- WRK-0001
  customer_id INT NOT NULL FK customers CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  service_id INT NULL FK services SET NULL,
  status ENUM('pending','in_progress','on_hold','review','completed','cancelled') DEFAULT 'pending',
  priority ENUM('low','normal','high','urgent') DEFAULT 'normal',
  assigned_to INT NULL FK users SET NULL,
  start_date DATE NULL, due_date DATE NULL, completed_at DATETIME NULL,
  estimated_amount DECIMAL(12,2) NULL,             -- expected billing
  created_by INT NULL FK users SET NULL,
  created_at TIMESTAMP, updated_at TIMESTAMP
  INDEX (customer_id), (status), (assigned_to), (due_date)

work_comments
  id PK, work_id FK works CASCADE, comment TEXT NOT NULL,
  created_by INT NULL FK users SET NULL, created_at TIMESTAMP
  INDEX (work_id)

customer_events                                    -- the timeline
  id PK, customer_id FK customers CASCADE,
  event_type VARCHAR(60) NOT NULL,                 -- created / created_from_lead / stage_changed /
                                                   -- work_created / work_status_changed /
                                                   -- invoice_created (fires at FINALIZE, drafts log
                                                   -- nothing) / payment_received / payment_bounced /
                                                   -- conversion_reverted / note_added
  description VARCHAR(500),
  ref_table VARCHAR(40) NULL, ref_id INT NULL,     -- deep link (works / invoices / ...)
  created_by INT NULL FK users SET NULL, created_at TIMESTAMP
  INDEX (customer_id), (created_at)
```

Material consumption against a work lives in inventory (`inventory_transactions.work_id`,
see [11](11-module-inventory.md)); invoices link via `invoices.customer_id` + optional
`invoices.work_id` (see [09](09-module-invoices-billing.md)).

---

## 3. API — `/api/customers.php`, `/api/works.php`, `/api/services.php`

Envelope/auth/validation conventions per [02](02-backend-architecture.md).

### customers.php
| Method | Action | Permission | Notes |
|---|---|---|---|
| GET | list | `customers.read` | filters `stage, search(name/mobile/email/company/code), assigned_to, start_date, end_date`; returns `{customers[], users[], stats{total, by_stage{}, new_this_month, with_open_works, with_due_invoices}}` |
| GET | `?id=N` | `customers.read` | `{customer, works[], invoices[] (summary rows), events[] (latest 50), totals{billed, paid, outstanding, open_works}}` |
| POST | `create` | `customers.create` | fields per table; `from_lead_id?` → performs guarded lead conversion (see [05](05-module-leads.md) §conversion) in one transaction; generates customer_code |
| POST | `update` | `customers.update` | — |
| POST | `update_stage` | `customers.update` | `id, stage` → logs `stage_changed` event |
| POST | `add_note` | `customers.update` | `id, note` → `note_added` event |
| POST | `archive` / `restore` | `customers.delete` | soft (`is_active`) — hard delete not offered (invoices reference it) |

### works.php
| Method | Action | Permission | Notes |
|---|---|---|---|
| GET | list | `works.read` | filters `status, customer_id, assigned_to, priority, search, due(overdue|this_week)`; returns `{works[], stats{by_status{}, overdue, due_this_week, unassigned}}` |
| GET | `?id=N` | `works.read` | `{work, customer(min), comments[], materials[] (inventory issues), invoice? }` |
| POST | `create` | `works.create` | `customer_id, title, service_id?, assigned_to?, dates, priority, estimated_amount` → work_code; notify assignee; `work_created` event |
| POST | `update` | `works.update` | — |
| POST | `update_status` | `works.update` | `id, status`; `completed` stamps `completed_at`; logs event + notifies customer owner |
| POST | `assign` | `works.assign` | `id(s), assigned_to` (single + bulk) → notification |
| POST | `add_comment` | `works.update` | — |
| POST | `delete` | `works.delete` | blocked if an invoice or inventory transaction references it |

### services.php
GET list (`services.read`, includes usage counts across leads/works/invoice_items) ·
POST `add|edit|toggle` (`services.manage`) · `delete` blocked when used anywhere (deactivate instead).

Data scope: role `data_scope='own'` (see [08](08-module-rbac.md)) limits customers/works to
`assigned_to = me OR created_by = me`.

---

## 4. Frontend Pages

### `/customers` — list
- KPI cards: Total Active, Onboarding, Active, Inactive/Churned, Outstanding ₹ (clickable filters).
- Toolbar: debounced search, stage select, owner select, date range, Reset; **Add Customer**.
- Table/cards: code, name+company, contact, stage badge (color per stage), owner avatar,
  open works count, outstanding ₹, created; row actions: View, Edit, Stage.
- Stage badge colors (status map, [style.md §6](../style.md)): onboarding=purple, active=green,
  inactive=gray, churned=coral.

### `/customers/detail?id=` — the customer hub (most important page)
- Header: name, code, stage dropdown (permission-gated), owner, quick actions:
  **+ Work**, **+ Invoice**, **Add Note**.
- Info cards: contact/company/GSTIN · totals (billed, paid, **outstanding highlighted**) ·
  lead origin (link back to lead if converted).
- Tabs:
  - **Works** — table of works w/ status pills, assignee, due date; inline status change.
  - **Invoices** — number, date, total, paid, balance, status; link to invoice detail.
  - **Timeline** — customer_events feed (icon per type, relative time) — the full story.
- Suggestion banner (computed client-side): e.g. "Last work completed 94 days ago — move to
  Inactive?" with one-click stage change.

### `/works` — works board
- Two view modes: **table** (default, like leads list) and **kanban by status** (6 columns,
  drag between columns → `update_status`; framer-motion layout animations).
- KPIs: Open, In Progress, Overdue, Due this week, Completed this month.
- Filters: status, assignee, customer, priority, search. Bulk assign.
- **Add Work modal**: customer combobox (cmdk search), title, service select, assignee,
  dates, priority, estimated amount.

### `/works/detail?id=`
Header (title, code, status pill, priority flag, assignee) · customer card (link) ·
description · dates card (start/due/completed, overdue warning) · **Materials used** card
(inventory issues against this work — link to add issue, see [11](11-module-inventory.md)) ·
comments thread · "Generate Invoice" button → prefilled invoice create ([09](09-module-invoices-billing.md)).

### `/settings/services`
Catalog manager: card grid with usage counts, add/edit/toggle (mirror of lead-sources page pattern).

---

## 5. Permissions

`customers.read/create/update/delete · works.read/create/update/delete/assign · services.read/manage`

Role defaults (seed slugs per [03 §8](03-api-list.md), the normative matrix): `admin` all ·
`manager` all except deletes · `sales` customers.read/create/update + works.read · others none.
(No separate "operations" role is seeded — admins can create one at runtime via /settings/roles
if works-only staff are needed.)

---

## 6. Alignment

- **Leads** ([05](05-module-leads.md)): conversion creates customer in same transaction; timeline
  starts with `created_from_lead`; `check_mobile` on leads checks active customers.
- **Invoices** ([09](09-module-invoices-billing.md)): invoice **finalize** (draft → sent) writes
  `invoice_created`, payments write `payment_received` (bounced cheques `payment_bounced`);
  drafts log nothing. Customer detail shows billing totals.
- **Inventory** ([11](11-module-inventory.md)): raw-material issues reference `work_id` → shown on
  work detail; work costing = sum of issued material value (report-level, not stored).
- **Reports** ([14](14-reports-analytics.md)): stage distribution, work throughput,
  revenue per customer, top customers, assignee workload.
- **Notifications**: work assigned / status changed / overdue work → assignee + customer owner.
