# 04 — Frontend Architecture (Next.js, static CSR)

> Ported from the Extrabits CRM frontend (Next 16 App Router, React 19, static export) with the
> four upgrades its own ARCHITECTURE.md wanted but never shipped: react-hook-form+zod, a real
> toast provider, wired dark mode, and one consolidated stylesheet. Plus **Lenis** (new) and
> Framer Motion as the animation system, per requirements.

---

## 1. Build & Framework Rules

- Next.js 16 App Router, React 19, TypeScript 5.
- `next.config.ts`: `output: 'export'` **only when `NODE_ENV==='production'`** (dev keeps full
  routing), `images: { unoptimized: true }`, `experimental.optimizePackageImports`
  (recharts/lucide/framer-motion/date-fns/cmdk), `compiler.removeConsole` prod (keep error/warn).
- **No middleware.ts** (incompatible with export) — all auth/permission guarding client-side.
- **No dynamic route segments** — detail pages use query strings: `/leads/detail?id=7`
  (export-safe, ported). Pages using `useSearchParams` wrap in `<Suspense>`.
- Every page `"use client"`; single root layout + `AppShell`; no per-segment layouts.
- Deploy: `next build` → `out/` served by the PHP `router.php` SPA-fallback.

## 2. Dependencies (locked intent)

| Category | Package | Notes |
|---|---|---|
| Core | next@16, react@19, typescript@5 | as old CRM |
| Styling | tailwindcss@4 (+@tailwindcss/postcss), tw-animate-css, cva, clsx, tailwind-merge | single `globals.css` — **no second legacy stylesheet** (fixes old CRM) |
| Primitives | @base-ui/react + shadcn CLI (style base-nova) | ported component kit |
| Animation | **framer-motion@12** | entrances, AnimatePresence modals, layout anims, count-ups |
| Scroll | **lenis@1 (new)** | root smooth scroll via `<LenisProvider>`; respects `prefers-reduced-motion`; disabled inside modal/virtual scroll containers via `data-lenis-prevent` |
| Server state | @tanstack/react-query@5 | staleTime 60s, gcTime 5m, no refetchOnWindowFocus, no retry on 4xx (ported query-client) |
| Forms | **react-hook-form + zod + @hookform/resolvers (new)** | all create/edit modals; zod schemas colocated in `features/*/schemas.ts` |
| Toasts | **sonner (new)** | one `<Toaster>`; kills the old per-page useState toasts |
| Charts | recharts@3 via `next/dynamic` `ssr:false` | chart JSX in sibling files (ported) |
| Theme | next-themes | **actually mounted** this time; `.dark` oklch tokens |
| Utils | lucide-react, date-fns@4, cmdk, react-day-picker@9 | ported |

Dropped from old CRM: three.js mascot, @xyflow/dagre, socket.io, Font Awesome CDN
(lucide only), zustand (React Query + context suffice).

## 3. Source Layout

```
frontend/src/
├── app/                        # composition only — pages assemble features
│   ├── layout.tsx  globals.css  providers.tsx
│   ├── login/  page.tsx        # root = role dashboard
│   ├── leads/{page,detail,meetings}  customers/{page,detail}  works/{page,detail}
│   ├── invoices/{page,create,detail}
│   ├── expenses/{page,insights,monthly,monthly/category,categories}
│   ├── inventory/{page,detail,purchases,purchases/detail,production,suppliers}
│   ├── hr/{page,employees,attendance,leaves,payroll,settings}  my/
│   ├── dashboard/{google,facebook}
│   ├── reports/  notifications/  profile/
│   └── settings/{users,roles,services,lead-sources,bank-accounts,company,integrations}
├── features/<domain>/          # leads, customers, works, invoices, expenses, inventory,
│   ├── api/<domain>.api.ts     #   hr, integrations, reports, auth, users, notifications
│   ├── api/<domain>.keys.ts    # hierarchical query-key factory (ported)
│   ├── types.ts  schemas.ts    # DTOs + zod
│   ├── hooks/use<Domain>.ts    # useQuery/useMutation + invalidation (owned here, never pages)
│   └── components/             # feature modals/widgets
├── shared/
│   ├── api/{http-client,api-error,query-client,index}.ts   # ported wholesale minus scope injection
│   ├── ui/                     # button, input, dialog, sheet, select, table, badge, card,
│   │                           # tabs, popover, command, calendar, pagination, kpi-card,
│   │                           # date-range-picker, empty/loading/error-state, confirm-dialog,
│   │                           # number-ticker, page-header, data-toolbar
│   ├── hooks/{use-pagination,use-debounced-value,use-api-query}.ts
│   ├── providers/{lenis-provider,theme-provider}.tsx
│   └── utils/{format,cn}.ts    # formatCurrency ₹, formatDate
├── lib/{auth,permissions,nav,access}.tsx   # ported providers
├── routes/nav-fallback.ts
└── configs/app.config.ts       # API base (dev http://host:8000/api, prod /api), storage keys
```

## 4. API Client (ported, simplified)

`shared/api/http-client.ts` — the old CRM `HttpClient` minus branch/year scope injection:
cookie credentials always, `X-CSRF-Token` from `crm_csrf_token` cookie on mutations,
FormData handling, `cache:'no-store'`, AbortSignal, **401 → one silent
`v1/auth/refresh.php` retry → on failure clear + dispatch `crm:auth-expired`** (auth endpoints
excluded), errors normalized to `ApiError {status,message,endpoint,code,details}`.
Backends dispatch on `action` in the JSON body: `api.post('leads.php', {action:'create', ...})`.

Query conventions (ported): keys `[domain,'list',filters] / [domain,'detail',id]`;
`keepPreviousData` on lists; `enabled: can('x.read')`; mutations invalidate the domain's
`lists()` family; **no optimistic updates on financial mutations**.

## 5. Providers & Guarding (ported stack)

`providers.tsx` order: QueryProvider → ThemeProvider (next-themes) → AuthProvider →
PermissionProvider → NavProvider → LenisProvider → TooltipProvider → `<Toaster>` → AppShell.

- **AuthProvider**: session probe `v1/auth/me.php` on mount, CSRF bootstrap, proactive silent
  refresh (timer at TTL−60s), BroadcastChannel multi-tab sync, `pageshow`/`visibilitychange`
  re-validate, `crm:auth-expired` listener, logout = server call + query-cache clear +
  `location.replace('/login')`. (Ported verbatim; no academic-year/branch contexts.)
- **PermissionProvider**: `user_permissions.php` → `can/canAny/canAll` with `*`/`resource.*`
  wildcards + `<PermissionGate>`.
- **NavProvider**: `nav.php` → sidebar sections + `allowedHrefs`; AppShell guard:
  unauthenticated → `/login`; disallowed route (with SUB_ROUTE_PARENTS inheritance) → `/`;
  `must_change_password` → forced-change screen. Login page renders bare.
  **Self-service routes**: `nav.php` always includes `/profile` and `/notifications` in
  `allowedHrefs` for any authenticated user (they are non-sidebar routes, reached from the
  header avatar menu and bell icon respectively) — so the guard never redirects them.
- **LenisProvider (new)**: instantiates Lenis on `<html>`, rAF loop, `data-lenis-prevent` on
  dialogs/tables/dropdown viewports, destroyed on unmount, disabled when
  `prefers-reduced-motion: reduce`.

## 6. Design System

- **Tokens** (globals.css `@theme inline`, oklch): **all visual token values are defined in the
  root [style.md](../style.md) — the authoritative design system (purple `#6C63FF` primary, pink
  secondary, coral attention, radius system pill/18/24/28/32, soft elevation scale)**; full
  `.dark` counterpart set. Fonts: DM Sans (sans) + JetBrains Mono (mono) via `next/font`.
  **Chart tokens** `--chart-1..5` (values per style.md §2, dark-tuned counterparts):
  `--chart-1` green (income/positive) · `--chart-2` coral (expense/negative) · `--chart-3` amber
  (pending/warning) · `--chart-4` purple (primary series) · `--chart-5` pink (secondary).
  Charts consume `var(--chart-*)` — never literal hex — so they follow dark mode
  ([14](14-reports-analytics.md) references this mapping).
- **Component classes** (ported, consolidated into globals.css): `.page-header`, `.kpi-grid/.kpi-card`,
  `.cs-card`, `.cs-table` + `.mobile-card-list` responsive pair, `.badge-pill` color variants,
  `.filter-bar`, `.empty-state` — Tailwind-layer utilities, no second stylesheet.
- **Primitives**: shadcn-on-Base-UI set (ported list: button, input, textarea, label, checkbox,
  switch, select, dropdown-menu, dialog, sheet, popover, tooltip, tabs, table, card, badge,
  avatar, separator, scroll-area, progress, calendar, command, pagination) + decorative
  (number-ticker, magic-card, blur-fade) used sparingly on dashboards.
- **Canonical list-page pattern** (ported from leads page): KPI cards (clickable filters) →
  `.filter-bar` (debounced search 300ms + selects + date-range + reset) → desktop `.cs-table` /
  mobile cards → `usePagination(items, 10)` + `<Pagination>` → Dialog-based modals →
  feature-hook mutations → sonner toasts.
- **Forms pattern (new)**: RHF + zodResolver; `<Form>` wrapper components; server 422 `details`
  mapped back into RHF field errors by a shared `applyServerErrors()` helper.
- **Motion language**: page sections `fadeUp` stagger (0.05s steps); KPI numbers count-up
  (number-ticker); dialogs scale/fade via AnimatePresence; kanban drag = framer-motion layout;
  respect reduced-motion globally (`MotionConfig reducedMotion="user"`).

## 7. Route Map & Nav Sections

Sidebar (permission-filtered by nav.php):
**Overview** `/` `/my` · **CRM** `/leads` `/leads/meetings` `/customers` `/works` ·
**Finance** `/invoices` `/expenses` `/expenses/insights` `/expenses/monthly`
`/expenses/categories` · **Inventory** `/inventory` `/inventory/purchases`
`/inventory/production` `/inventory/suppliers` · **HR** `/hr` `/hr/employees` `/hr/attendance`
`/hr/leaves` `/hr/payroll` `/hr/settings` (gated `hr.settings.manage`) ·
**Marketing** `/dashboard/google` `/dashboard/facebook` · **Insights** `/reports` ·
**Settings** `/settings/*`.

Non-sidebar pages: `/profile` (header avatar menu — profile edit, change password, active
sessions w/ revoke) and `/notifications` (header bell — latest 30 w/ unread badge, mark-read on
click, mark-all-read, `entity_type/entity_id/link_url` deep links). Both always in
`allowedHrefs` (§5). Invoice editing reuses `/invoices/create?id=` (no separate edit route).

## 8. Performance Rules (ported + kept honest)

- Recharts always dynamic-imported with pulse-skeleton loaders; chart components in sibling files.
- Route-level code splitting is automatic; heavy modals (invoice builder, purchase builder)
  lazy-loaded.
- Lists render ≤ page size (10) rows; server caps at 200.
- Integration dashboards read only local cache endpoints (never third-party APIs from browser).
- Lighthouse budget: initial JS < 300KB gz per route (old CRM discipline via
  optimizePackageImports).
