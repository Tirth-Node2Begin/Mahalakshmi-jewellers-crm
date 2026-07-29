# 05 — Leads Module

> Directly modeled on the Extrabits CRM lead module (proven flow: statuses → follow-ups with
> auto-chain → meeting/demo → convert or drop), **generalized**: no branches, no academic year,
> college/course/program replaced by company + service interest + deal value. Converted leads
> become **Customers** (see 06-module-customers-lifecycle.md).

---

## 1. Lead Lifecycle

### Statuses (single source of truth: PHP constant + DB enum, keep in sync)

Pipeline: `New → Contacted → Qualified → Meeting Scheduled → Meeting Done → Proposal Sent → Negotiation`
Terminal: `Converted` | `Dropped` | `Lost`

Rules (enforced server-side, mirrored in UI):
- `update_status` accepts only pipeline statuses. **Direct set of Converted/Dropped/Lost is blocked** —
  Converted only via the Convert action (creates a customer); Dropped **and Lost** only via the
  Drop action (`drop_lead` takes `outcome: 'Dropped'|'Lost'` — Dropped = we ended it,
  Lost = they went elsewhere; both require a reason and stamp `dropped_at`).
- Reverting a Converted lead to a pipeline status runs one transaction: clears the lead's
  `customer_id` + `converted_at`, sets the customer's `source_lead_id = NULL`, and logs a
  `conversion_reverted` customer event (unlinks both sides, does not delete the customer).
- Status changes stamp `converted_at` / `dropped_at` and always write a `lead_activities` row.

### Follow-up engine (kept 1:1 from old CRM — it works)
- `lead_followups` rows are manual (`is_auto=0`) or auto (`is_auto=1`, `auto_step` 1–3).
- On lead create (non-terminal): auto follow-up **step 1 scheduled +1 day**.
- Completing auto step 1/2 with a non-terminal outcome → schedules next step +1 day.
  Outcome `Converted`/`Dropped` stops the chain (and reroutes to convert/drop modals in UI).
- Follow-up outcomes: `Interested, Not Interested, Call Back Later, No Response, Converted, Dropped`.
- Computed `display_status = 'Overdue'` when Pending & past due (never stored — status enum is
  `Pending / Completed / Cancelled`).
- `cancel_followup` action cancels a Pending follow-up (auto or manual); cancelling an auto step
  stops the chain.
- UI guards: outcome required to complete; completed date not in past; one completion per day.

### Meetings (generalized from "demo"; extended 2026-07-03)
- `lead_meetings` table (was `demo_schedules`): meeting/demo/site-visit with `assigned_to`
  (any active employee), date, start/end time, mode (`in_person|call|video`), location/link, outcome notes,
  `attended` flag.
- **Standalone meetings**: `lead_id` is optional — meetings can be added manually from the
  board (`Add meeting`) with a required `title` when no lead is attached. `created_by` recorded.
- **Participants**: any mix of clients (`meeting_customers` → customers) and team
  (`meeting_users` → users). Managed in the shared create/edit modal (searchable multi-select).
- **Full CRUD**: `schedule_meeting` (create, lead optional) · `update_meeting` (all fields +
  `attended` + `outcome_notes` + participants re-sync) · `delete_meeting`. All under `leads.update`.
- Scheduling a meeting on a non-terminal lead sets status `Meeting Scheduled` + logs activity.
  Marking a lead-meeting attended while the lead is `Meeting Scheduled` rolls it to `Meeting Done`.
- Own-scope visibility: creator, organiser (`assigned_to`), team participant, or owner of the
  attached lead. Team participants + organiser get `meeting_assigned` notifications.

### Drop flow
- `drop_lead {lead_id, outcome: 'Dropped'|'Lost', drop_reason, drop_reason_desc?}` — reason from
  `lead_drop_reasons` (admin-manageable, soft delete) + optional description.
- Blocked when already terminal. Sets status to the chosen outcome, stamps `dropped_at`,
  logs activity with old/new status.
- UI rule kept: standalone Drop enabled only after ≥3 completed follow-ups (or zero follow-ups).

### Conversion flow → Customer
- "Convert" opens the New Customer modal prefilled from the lead (name, mobile, email, company,
  service interest, expected value).
- Backend: `POST /api/customers.php action=create` with `from_lead_id` → creates the `customers`
  row, then guarded update (the UI can follow up with a separate `works.php create` call if the
  user wants to open the customer's first job):
  `UPDATE leads SET status='Converted', converted_at=NOW(), customer_id=:cid
   WHERE id=:lid AND status <> 'Converted'` (0 rows = already converted → error).
- Logs `Converted` activity on the lead + `created_from_lead` event on the customer timeline.

### Duplicate detection
- `check_mobile` pre-flight: mobile already on an **active customer** → warn + link to that customer.
- Webhook dedup: `platform_lead_id` idempotency (re-delivery returns `{duplicate:true,id}`).
- Soft dedup on list: badge when another open lead shares the mobile.

---

## 2. Database Tables (authoritative copy in 01-database-schema.md)

```sql
lead_sources
  id INT PK AI, name VARCHAR(100) NOT NULL UNIQUE,
  is_active TINYINT(1) DEFAULT 1, created_at TIMESTAMP
  -- delete blocked when usage_count > 0 (deactivate instead)

leads
  id INT PK AI,
  name VARCHAR(120) NOT NULL,
  mobile VARCHAR(20), email VARCHAR(150),
  company VARCHAR(150), city VARCHAR(100),
  source_id INT NULL FK lead_sources ON DELETE SET NULL,
  source_detail VARCHAR(255),
  channel_type ENUM('walk_in','phone','website','whatsapp','facebook','instagram','google','referral','other') DEFAULT 'other',
  entry_type ENUM('manual','import','api','webhook') DEFAULT 'manual',
  platform_lead_id VARCHAR(150) NULL,          -- external dedup key (unique index)
  service_interest VARCHAR(255),                -- free text summary
  expected_value DECIMAL(12,2) NULL,            -- deal size estimate
  status ENUM('New','Contacted','Qualified','Meeting Scheduled','Meeting Done',
              'Proposal Sent','Negotiation','Converted','Dropped','Lost') DEFAULT 'New',
  assigned_to INT NULL FK users ON DELETE SET NULL,
  created_by INT NULL FK users ON DELETE SET NULL,
  referred_by_customer_id INT NULL FK customers ON DELETE SET NULL,
  referred_by_lead_id INT NULL FK leads ON DELETE SET NULL,
  customer_id INT NULL FK customers ON DELETE SET NULL,   -- set on conversion
  converted_at DATETIME NULL,
  dropped_at DATETIME NULL, drop_reason VARCHAR(255), drop_reason_desc TEXT,
  tags_json JSON NULL,
  ai_score DECIMAL(5,2) NULL, ai_classification VARCHAR(100) NULL,  -- webhook AI fields
  notes TEXT,
  lead_date DATE NULL,                          -- allows backdating
  created_at TIMESTAMP, updated_at TIMESTAMP
  INDEX (status), (mobile), (email), (source_id), (assigned_to), (created_at), (created_by)
  UNIQUE (platform_lead_id)

lead_services                                   -- M:N lead ↔ services catalog (06 §services)
  id PK, lead_id FK leads CASCADE, service_id FK services CASCADE,
  UNIQUE (lead_id, service_id)

lead_followups
  id PK, lead_id FK leads CASCADE,
  scheduled_date DATE NOT NULL, scheduled_time TIME NULL,
  status ENUM('Pending','Completed','Cancelled') DEFAULT 'Pending',
  completed_at DATETIME NULL, outcome VARCHAR(150), notes TEXT,
  is_auto TINYINT(1) DEFAULT 0, auto_step TINYINT DEFAULT 0,
  created_by INT NULL FK users SET NULL, created_at TIMESTAMP
  INDEX (scheduled_date, status), (lead_id)

lead_meetings
  id PK, lead_id INT NULL FK leads CASCADE,     -- NULL = standalone meeting
  title VARCHAR(200) NULL,                      -- required when no lead
  meeting_date DATE NOT NULL, start_time TIME, end_time TIME,
  mode ENUM('in_person','call','video') DEFAULT 'in_person',
  location VARCHAR(255) NULL,                   -- address or meet link
  assigned_to INT NULL FK users SET NULL,
  attended TINYINT(1) DEFAULT 0, outcome_notes TEXT,
  created_by INT NULL FK users SET NULL, created_at TIMESTAMP
  INDEX (meeting_date), (lead_id), (assigned_to)

meeting_customers                               -- client participants
  id PK, meeting_id FK lead_meetings CASCADE, customer_id FK customers CASCADE,
  UNIQUE (meeting_id, customer_id)

meeting_users                                   -- team participants
  id PK, meeting_id FK lead_meetings CASCADE, user_id FK users CASCADE,
  UNIQUE (meeting_id, user_id)

lead_activities
  id PK, lead_id FK leads CASCADE,
  activity_type VARCHAR(80) NOT NULL,           -- Status Update / Follow-up Scheduled / ...
  description TEXT, old_status VARCHAR(80), new_status VARCHAR(80),
  created_by INT NULL FK users SET NULL, created_at TIMESTAMP
  INDEX (lead_id), (created_at)

lead_drop_reasons
  id PK, name VARCHAR(150) NOT NULL UNIQUE,
  is_active TINYINT(1) DEFAULT 1, created_at TIMESTAMP
```

Dropped from old CRM: `branch_id` everywhere, `college_id/college`, `program_id/semester`,
`course_id` legacy mirror, demo-day counters, academic-year filters, student references.

---

## 3. API — `/api/leads.php` + `/api/lead_sources.php` (full list also in 03-api-list.md)

Envelope: `{success:true, ...}` / `{success:false, error}` (422 validation, 400 logic, 404 missing).
JSON bodies; POST dispatches on `action`. All endpoints behind auth middleware + permission check.

| Method | Action | Permission | Notes |
|---|---|---|---|
| GET | list (default) | `leads.read` | filters: `status, search, tab(active\|closed), source_id, assigned_to, start_date, end_date, filter=action_required`; returns `{leads[], sources[], services[], users[], stats{}}` |
| GET | `?id=N` | `leads.read` | `{lead, followups[], meetings[], activities[], services[]}` |
| GET | `?meeting_helpers=1` | `leads.read` | active users (assignment/team) + customers (client participants) |
| GET | `?meetings_board=1&from&to` | `leads.read` | week board — visibility-scoped, incl. standalone meetings + participants |
| GET | `?drop_reasons=1` | `leads.read` | active drop reasons |
| POST | `create` | `leads.create` | validation: name ≤120 req, mobile ≤20 req, email ≤150, status in **pipeline statuses only** (terminal statuses can never be set directly) |
| POST | `update` | `leads.update` | same fields |
| POST | `update_status` | `leads.update` | pipeline statuses only |
| POST | `check_mobile` | `leads.create` | duplicate pre-flight |
| POST | `add_followup` | `leads.update` | `lead_id, scheduled_date, scheduled_time?, notes?` |
| POST | `complete_followup` | `leads.update` | `followup_id, outcome, notes?, completed_date?, completed_time?` |
| POST | `cancel_followup` | `leads.update` | `followup_id` — Pending rows only |
| POST | `schedule_meeting` | `leads.update` | `lead_id?, title?, meeting_date, assigned_to, mode?, start_time?, end_time?, location?, customer_ids[]?, user_ids[]?` — title required when no lead |
| POST | `update_meeting` | `leads.update` | `meeting_id` + same fields **except `lead_id` (the lead association is immutable after creation)** + `attended?, outcome_notes?`; re-syncs participants; attended rolls `Meeting Scheduled → Meeting Done` |
| POST | `delete_meeting` | `leads.update` | `meeting_id` — cascades participants; logs activity on the lead if attached |
| POST | `drop_lead` | `leads.update` | `lead_id, outcome('Dropped'\|'Lost'), drop_reason, drop_reason_desc?` |
| POST | `assign` | `leads.assign` | `lead_id(s), assigned_to` — single + bulk |
| POST | `bulk_update_status` | `leads.update` | NEW: `lead_ids[], status` (pipeline only) |
| POST | `import` | `leads.create` | NEW: CSV import (name,mobile,email,company,source) with dedup report |
| GET | `?export=csv` | `leads.read` | NEW: filtered export |
| POST | `delete` | `leads.delete` | transaction: cascades followups/meetings/activities |
| POST | `add_drop_reason` / `delete_drop_reason` | `leads.update` | soft delete |

**Stats object** (list response): `total, new_today, open_pipeline, converted, dropped_lost,
pending_followups, overdue_followups, meetings_scheduled, conversion_rate` — scoped to the
user's **ownership scope only**, NOT to the transient status/search/tab filters. (The KPI tiles
*are* the filter drivers — clicking "Converted" applies that filter — so their counts must stay
stable regardless of the active filter, otherwise they'd be useless as navigation.)

Ownership scope: users whose role scope = `own` see only `assigned_to = me OR created_by = me`
(replaces old branch scoping — see 08-module-rbac.md).

### `/api/lead_sources.php`
GET list (`lead_sources.read`) → `{kpi:{total,active}, sources:[{...usage_count}]}`;
POST `add|edit|toggle|delete` (`lead_sources.manage`); delete blocked if usage_count > 0.
**Fix from old CRM: use prepared statements here (old version interpolated strings).**

### `/api/webhooks/lead_intake.php` (external intake — website forms, Meta lead ads)
- POST only; `Authorization: Bearer <LEAD_WEBHOOK_SECRET>` compared with `hash_equals`; 503 if
  unset, 401 mismatch.
- Graceful skips (HTTP 200 `{skipped:true, reason}`): missing name/mobile, mobile belongs to
  active customer.
- Dedup: `platform_lead_id` → `{duplicate:true,id}`.
- Enum normalization (`sanitizeEnum`: exact → case-insensitive → keyword map → default) for
  channel_type/entry_type.
- Auto-creates unknown source by name; stores `ai_score/ai_classification` if provided;
  logs `Inquiry Received`; starts auto follow-up chain. Returns 201 on create.

---

## 4. Frontend Pages

### `/leads` — list page
- 5 clickable KPI cards: **Open Pipeline**, **Follow-ups Due** (overdue+today), **Meetings
  Scheduled**, **Converted**, **Dropped/Lost** — clicking applies the filter.
- Tabs: **Active** | **Closed** (Dropped/Lost; Converted rows show "View Customer" link).
- Toolbar: debounced search (name/mobile/email/company, 300ms), date range, source select,
  assigned-to select, status select, Reset; Import CSV + Export buttons; **Add Lead**.
- Row list (cards, like old CRM): avatar initials, name + company, follow-up-due pill,
  mobile/email, expected value, source/entry chips, assigned-to avatar, status badge,
  actions (Status / Edit / Convert / open detail). Bulk-select checkboxes → bulk assign /
  bulk status.
- Client pagination 10/page on server page of ≤100 rows (keep old CRM behavior; server accepts
  `page` for future).
- Add Lead dialog: sections Basic (name*, mobile* with live dup-check + 6-9/10-digit rule, email,
  company, city, lead date) / Interest (services multi-select, expected value) / Source & Entry
  (source, source detail, channel) / Assignment / Notes.

### `/leads/detail?id=` — detail page
- Header: name, status badge, Convert + Drop buttons (hidden when terminal; Drop needs ≥3
  completed follow-ups or none).
- Info cards: contact/company · interest & value · source · drop-reason panel when dropped.
- Actions: Schedule Follow-up · Schedule Meeting · Update Status.
- Two columns: Follow-ups list (Overdue/Pending/Completed/Cancelled; per-item Complete with
  outcome dialog + reroute to Convert/Drop, and Cancel on pending items) ·
  Meetings list (upcoming/attended).
- Full-width Activity Timeline (icon per type, relative time).

### `/leads/meetings` — weekly meeting board
Mon–Sat columns of scheduled meetings ("Today" highlighted). Header `Add meeting` button →
shared `MeetingFormModal` (standalone create). Each card: title (or lead name, linked),
time · mode, participant summary, hover Edit/Delete actions (edit incl. attended + outcome;
delete behind a confirm dialog).

### `/settings/lead-sources`
KPI, search, card grid with usage counts, add/edit/toggle/delete.

Components: `UpdateStatusModal` (pipeline radios, returns chosen status for chaining —
`Meeting Done` chains to a next-step modal: Convert / Drop / Follow-up), `MeetingFormModal`
(shared create/edit: title, schedule, mode, location, assigned-to, searchable client/team
multi-selects; edit adds attended + outcome notes; `ScheduleMeetingModal` is a lead-preset
wrapper), `DeleteMeetingModal` (confirm), `EditLeadModal`, `DropReasonModal`,
`ConvertToCustomerModal` (prefill + creates customer), `ImportLeadsModal` (CSV mapper + dedup preview).
Data layer: TanStack Query — `useLeads(filters)` (keepPreviousData), `useLead(id)`,
mutations invalidate `['leads','list']`; keys `['leads','list',filters] / ['leads','detail',id]`.

---

## 5. Permissions (see 08-module-rbac.md)

`leads.read · leads.create · leads.update · leads.delete · leads.assign · lead_sources.read ·
lead_sources.manage`

Role defaults (seed slugs per [03 §8](03-api-list.md)): `admin` all · `manager` all except delete ·
`sales` read/create/update with scope=own · others none.

---

## 6. Alignment with other modules

- **Customers**: conversion target; `customers.referred_by_customer_id` can point back; customer
  timeline records `created_from_lead`.
- **Services catalog** (06): `lead_services` uses the same catalog that customer works and
  invoice line items use — one taxonomy across lead → work → invoice.
- **Reports** (14): funnel (status counts), source ROI (leads vs conversions vs invoice revenue
  by source), rep leaderboard (assigned_to conversions), response-time metrics from activities.
- **Dashboard** (14): "Follow-ups due today", "This week's meetings", funnel widget.
- **Notifications**: assignment + overdue follow-ups create in-app notifications (02 §notifications).
