# LeadSpark CRM — Design System (`style.md`)

> The single visual source of truth. Every screen, component, and pixel decision follows this
> document. It **supersedes the color/radius values previously sketched in
> [planning/04-frontend-architecture.md](planning/04-frontend-architecture.md) §6** (structure
> and stack there remain authoritative; visual tokens live here).
> Derived from two references: a cinematic split-panel login and a soft-UI purple dashboard —
> we adopt their *design language*, never their pixels.

---

## 1. Design Philosophy

1. **Floating, never boxed** — content lives on soft white cards that hover over a near-white
   canvas. Separation comes from spacing, radius, and gentle elevation — never from borders,
   dividers, or grid lines.
2. **One hero per screen** — each page has exactly one large gradient "hero" surface (analytics
   card, artwork panel); everything else stays quiet white so the hero carries the mood.
3. **Whitespace is a feature** — generous padding beats compact density. When in doubt, add 8px.
4. **Color is meaning, not decoration** — purple = brand/navigation/primary action; pink =
   secondary highlight; green = success/progress; coral = attention (CTA, warnings, alerts,
   overdue). No other hues, ever.
5. **Calm motion** — animation confirms and orients (fade, lift, slide); it never performs.
6. **Same product everywhere** — a login screen, an invoice builder, and a settings page must be
   recognizably the same application at a glance.

**Brand personality:** confident, warm, effortless. Premium SaaS (Linear/Stripe polish) with an
approachable rounded softness — professional without being cold, friendly without being toylike.

---

## 2. Color System

All colors ship as CSS custom properties in `globals.css` (`@theme inline`, expressed in oklch —
hex given here for reference; convert exactly once and never hand-tweak per page).

### Brand

| Token | Hex | Usage |
|---|---|---|
| `--primary` | `#6C63FF` | Sidebar, hero surfaces, focus rings, large accents, chart primary (non-text uses) |
| `--primary-deep` | `#5B4FE0` | Gradient end, hover/pressed, active nav circle |
| `--primary-strong` | `#4F46E5` | **AA text variant**: links, purple text/icons on white or soft tints, filled-button gradient base (6.3:1 on white ✓) |
| `--primary-soft` | `#EEEDFF` | Tinted backgrounds: selected rows, icon chips, hover fills |
| `--secondary` | `#FF6DA8` | Secondary hero cards, highlight widgets, chart secondary |
| `--secondary-soft` | `#FFEAF3` | Pink-tinted chips/backgrounds |

Gradients (the only ones allowed):
- **Hero purple** (large surfaces, ≥18px white text only — both stops ≥3:1 AA-large): `linear-gradient(135deg, #7062F8 0%, #5B4FE0 100%)`
- **Hero pink** (same rule — deepened so both stops pass AA-large vs white): `linear-gradient(135deg, #F0568F 0%, #D93D77 100%)`
- **Button purple** (14px white text — both stops AA vs white): `linear-gradient(135deg, #5B4FE0 0%, #4F46E5 100%)`

### Semantic — each hue has a *base* (fills, charts, large accents) and a *strong* (AA text)

| Token | Hex | Usage |
|---|---|---|
| `--success` | `#3FD16F` | Progress fills, chart income series, ≥3:1 non-text indicators — **never as text, never under white text** |
| `--success-strong` | `#15803D` | Success badge/delta TEXT on white (5.0:1 ✓) or `--success-soft` (4.5:1 ✓) |
| `--success-soft` | `#E4F8EC` | Success badge/tint background |
| `--warning` | `#F5A623` | Pending fills, chart pending series |
| `--warning-strong` | `#B45309` | Warning badge/helper TEXT (4.5:1 ✓) |
| `--warning-soft` | `#FEF3E2` | Warning tint background |
| `--attention` (coral) | `#FF5C6C` | Notification dots, coral tints, chart expense series, large accents |
| `--attention-strong` | `#BE123C` | Coral TEXT at any size ("Forgot password?", overdue values — AA on white AND on `--attention-soft` ✓) AND coral filled-button background (white text ≥6:1 ✓) |
| `--attention-soft` | `#FFE9EC` | Coral tint background |
| `--sky` | `#4DA6FF` | Chart secondary-info series and sparkline accents ONLY (badge "info" status is purple — see §6 status map; this token never labels statuses) |

### Neutrals

| Token | Hex | Usage |
|---|---|---|
| `--background` | `#F6F7FB` | Page canvas (very light cool gray) |
| `--card` | `#FFFFFF` | All cards/surfaces |
| `--foreground` | `#23262F` | Headings (charcoal — never pure black) |
| `--foreground-body` | `#3E4250` | Body/default text (10:1 ✓) |
| `--muted-foreground` | `#6B7280` | Body-secondary, captions, placeholders (4.8:1 on white ✓) |
| `--border` | `#E9EBF2` | Hairline input borders, table row hovers (only place borders exist) |

### Login artwork tokens (scoped to the login page + hero illustrations only)

`--art-navy: #0C0E1A` (canvas) · `--art-navy-2: #1B2140` (sky gradient) ·
`--art-copper: #FF8A5C` (warm accent light). These three exist solely for §12/§13 artwork —
never in application UI.

### Dark theme (`.dark` counterparts — dark mode is required, planning/04)

Canvas `#101118` · card `#181A23` · foreground `#F2F3F7` · muted `#9AA0AF` · border `#262938` ·
primary lifts to `#7C74FF`, soft tints become 12% alpha overlays of their hue. Hero gradients keep
their hues but drop lightness ~8%. Shadows are replaced by 1px inner borders + darker canvas
contrast (shadows don't read on dark).

### Rules

- **Text sits on AA-verified pairs only**: white text on `--primary-deep`/`--primary-strong`/
  `--attention-strong`/hero gradients (heroes carry ≥18px text, AA-large); colored text on
  white/soft tints always uses the `-strong` variant of its hue. Base hues (`#6C63FF`,
  `#FF5C6C`, `#3FD16F`, `#F5A623`) are for fills, charts, and non-text indicators — never for
  normal-size text and never under white text.
- Tinted (`*-soft`) backgrounds pair with the same hue's `-strong` token for text/icons.
- Never introduce a new hex. Need a shade? Use alpha of an existing token.

### Chart tokens (Recharts reads only these — see planning/14 role mapping)

| Token | Value | Role |
|---|---|---|
| `--chart-1` | green `#3FD16F` | income / positive |
| `--chart-2` | coral `#FF5C6C` | expense / negative |
| `--chart-3` | amber `#F5A623` | pending / warning |
| `--chart-4` | purple `#6C63FF` | primary series |
| `--chart-5` | pink `#FF6DA8` | secondary series |

---

## 3. Typography — DM Sans only

DM Sans (variable, via `next/font`) for every character in the app. JetBrains Mono solely for
codes/IDs (invoice numbers, item codes) at 90% size.

| Level | Size / line | Weight | Usage |
|---|---|---|---|
| Display | 40/48 | 700 | Login "Hi there", empty-state heroes |
| Page heading | 28/36 | 700 | One per page, top-left |
| Section heading | 20/28 | 600 | Card groups, modal titles |
| Card heading | 16/24 | 600 | Card titles |
| Body | 14/22 | 400 | Default text, table cells, inputs |
| Caption | 12/18 | 500 | Labels, column headers (uppercase +0.4px tracking) |
| Helper | 12/18 | 400 | Hints, timestamps, muted |
| Button | 14/20 | 600 | All buttons |
| KPI number | 32/40 | 700 | Stat tiles (count-up animated) |

Rules: headings `--foreground`, body `--foreground-body`, secondary `--muted-foreground`.
Max two weights per component.
Never letter-space body text. Numbers in tables/KPIs use `font-variant-numeric: tabular-nums`.

---

## 4. Layout, Grid & Spacing

### App frame (three-zone, from the dashboard reference)

```
┌──────────┬──────────────────────────────────────┬─────────────────┐
│ Sidebar  │  Main content (fluid)                │ Right panel     │
│ 88px     │  page pad 40px · card gap 24px       │ 320px (xl only) │
│ floating │                                      │ contextual      │
└──────────┴──────────────────────────────────────┴─────────────────┘
```

- Right panel appears only on ≥1440px screens and only where the page defines one (dashboard:
  activity feed; customer detail: timeline). Never forced.
- Grid: 12 columns desktop / 8 tablet / 4 mobile, 24px gutters. Cards snap to columns.

### Spacing scale (8px system, with 4px halves for micro spacing — no other values)

`4 · 8 · 12 · 16 · 24 · 32 · 40 · 48 · 64 · 80 · 96`

Canonical: page padding 40 · between cards 24 · card internal padding 24 (heroes 32) ·
heading-to-content 16 · label-to-input 8 · button gap 12. Component-internal paddings are
specified per component in §6 and always come from this scale.

### Radius system (one system, no exceptions)

| Element | Radius |
|---|---|
| Buttons, badges, search, segmented controls | `999px` (pill) |
| Inputs, dropdown menus, selects | `18px` |
| Cards, modals, table containers, chart cards | `24px` |
| Hero cards, login container, artwork frame | `28px` |
| Sidebar | `32px` |
| Avatars, icon chips, nav active state | circle |

No sharp corners anywhere. Nested surfaces step DOWN one level (card 24 → inner tile 18 → chip pill).

### Elevation (soft, diffuse — never harsh)

| Level | Shadow | Used for |
|---|---|---|
| 0 | none | Canvas, tinted chips |
| 1 | `0 2px 12px rgba(35,38,47,0.05)` | Resting cards, sidebar |
| 2 | `0 8px 24px rgba(35,38,47,0.08)` | Card hover, dropdowns, popovers |
| 3 | `0 16px 48px rgba(35,38,47,0.12)` | Modals, command palette |
| Hero | `0 12px 32px rgba(108,99,255,0.25)` | Purple/pink gradient cards only (colored glow) |

Rules: shadow color is charcoal at low alpha (or the card's own hue for heroes) — never black at
high opacity. Hover raises exactly one level with `translateY(-2px)`.

---

## 5. Iconography

Lucide (rounded line icons), stroke `1.75`, sizes 16/20/24. Icons are monochrome — inherit text
color; on purple surfaces white at 90%. Standalone icons sit inside circular or 18px-rounded
chips with a `*-soft` tint (e.g. purple icon on `--primary-soft` circle — the progress-card
pattern from the reference). Never mix icon families; never use filled variants except the active
nav item.

---

## 6. Components

### Buttons (pill, 40px default / 48px hero / 32px compact, side padding 24px)

| Variant | Style | Hover |
|---|---|---|
| Primary | **button purple gradient** (`#5B4FE0→#4F46E5`, both stops AA vs white text), hero shadow | lift −2px, glow +20% |
| CTA / attention | `--attention-strong` `#BE123C` fill, white text ≥6:1 ✓ (login submit, "record payment") | same |
| Secondary | white, 1px `--border`, `--primary-strong` text | `--primary-soft` fill |
| Ghost | transparent, charcoal text | `--background` fill |
| Destructive-confirm | `--attention-strong` fill (only inside confirm dialogs) | — |
| Icon button | 40px circle, ghost or white+shadow-1 | tint fill |

Press = scale 0.98. Loading = spinner replaces label, width locked. Disabled = 40% opacity, no shadow.

### Inputs & forms

48px tall, 18px radius, white fill, 1px `--border`, 16px side padding, placeholder
`--muted-foreground`. Focus: border `--primary` + glow `0 0 0 4px rgba(108,99,255,0.15)`
(purple focus glow — the one heavy-ish effect allowed). Error: coral border + helper 12px below.
Labels: caption style above, 8px gap. Selects/comboboxes/date pickers match input chrome exactly;
menus open at 18px radius, elevation 2, options 40px tall with `--primary-soft` hover.
RHF + zod wiring per planning/04 — visual states here.

### Cards

White, 24px radius, 24px padding, elevation 1. Header = card heading + optional right action
(ghost icon button). Hover (only when the whole card is clickable): elevation 2 + lift.
**Hero cards**: gradient, 28px radius, 32px padding, white text, inner stat tiles as
`rgba(255,255,255,0.14)` rounded-18 blocks (translucent, like the reference's chart stats).
**KPI tiles**: icon chip top-left, KPI number, caption, delta badge (green ↑ / coral ↓ pill),
optional **sparkline slot** (32px-tall curved mini-line in the tile's series color, no axes —
required by the integration dashboards, planning/12 §7 / 13 §7).
**Progress cards** (works, goals): icon chip → title → helper → green progress bar (6px pill
track `--border`, fill `--success`) → footer: percentage right + coral time-left pill.

### Badges & status pills

Pill, 24px tall, 12px caption text, `*-soft` tinted background + the hue's **`-strong` text**
(AA on tint). Status map (whole app): purple = new/info (`--primary-soft` + `--primary-strong`) ·
green = active/paid/completed · amber = pending/partial · coral = overdue/dropped/bounced ·
gray = draft/inactive/cancelled (`--background` fill + `--muted-foreground` text). One badge
style everywhere — leads, invoices, works, attendance all share it.

### Tables

Inside a card (24px radius, zero outer padding). Header row: caption-style uppercase labels on
`--background` tint, no vertical rules. Rows 56px, separated by nothing (whitespace) —
hover paints `--background`. First column may carry avatar+name stack. Row actions appear on
hover (ghost icons, right-aligned). Numeric columns right-aligned, tabular-nums. Mobile: table
transforms into stacked cards (planning/04 pattern). Pagination: centered pill group — ghost
arrows + number pills, active = purple fill.

### Modals & drawers

Modal: elevation 3, 24px radius, 32px padding, max-width 560 (forms) / 720 (builders); backdrop
`rgba(16,17,24,0.4)` + 4px blur; enter = fade + scale 0.96→1 (200ms). Title = section heading;
footer right-aligned: ghost cancel + primary confirm. Destructive confirms restyle confirm to
coral and require explicit noun ("Delete invoice"). Drawer (sheet): right side, 28px left radius,
same padding.

### Alerts, toasts & banners

Toasts (sonner, bottom-right): white card, elevation 2, left icon chip in semantic tint, 18px
radius, auto-dismiss 4s (errors persist). Inline banners: `*-soft` tinted rounded-18 strip with
`-strong` icon + text + optional action. The integrations "Reconnect" banner is **amber**
(warning family — per planning/12 §7 and 13 §9); coral banners are reserved for
overdue/critical states. Never browser alerts.

### Tabs & segmented controls

Segmented pill (the reference's Activities/Online toggle): container `--background` pill, active
segment white (or `--primary-deep` fill + white text for primary toggles — never base
`--primary` under white text), slide animation between segments. Page-level tabs (reports): ghost text tabs, active = purple text + 3px pill underline.

### Tooltips, accordions, misc

Tooltip: charcoal `--foreground` pill, white 12px text, 8px×12px padding, 150ms delayed fade.
Accordion: card-internal, chevron rotates, content fades in; no nested borders.
Avatars: circle, initials on deterministic `--primary-soft`-family tint. Skeletons: §9.

---

## 7. Sidebar (floating icon rail)

- 88px wide, full-height minus 24px margins (floats — canvas visible around it), **32px radius**,
  hero purple gradient, elevation 1.
- Logo mark (white, 28px) top, 32px below top edge.
- Nav = vertical icon stack, 48px circular hit areas, 12px gaps, white icons at 65% opacity.
- **Active**: 48px circle of `--primary-deep` (darker purple), icon at 100% white, soft inner
  glow — the reference's circular active state. Hover: 12% white circle, opacity → 100%.
- Tooltip with label on hover (rail is icon-only; labels always available).
- Logout icon isolated at the bottom, 40px from nav stack.
- Mobile: rail becomes a bottom floating pill dock (5 primary items + "more" sheet).
- Section order = nav.php sections (planning/04 §7); the rail shows section landing icons,
  section sub-pages render as pill tabs under the page heading.

## 8. Header (top bar, inside main column — not full-width)

Left: breadcrumb caption (muted) over page heading. Right cluster, 16px gaps: pill search
(40px tall, `--background` fill, search icon, ⌘K hint) · notification bell icon-button with coral
dot + count · theme toggle (ghost icon) · avatar (40px circle, elevation 1) opening profile menu.
Header is transparent (canvas shows through), 40px vertical padding, no border below.

---

## 9. States: empty, loading, error

**Empty states**: centered in the card — 96px illustration spot (single-color line illustration
in purple on `--primary-soft` blob), display-small heading ("No leads yet"), one-line helper,
primary action button. Never a bare "No data" string.
**Loading**: skeletons mirror the real layout (KPI tiles, table rows, chart block) using
`--border`-tinted shimmering blocks at the component's real radius; full-page loads show the
logo pulse on canvas. Buttons load inline (spinner). Charts show a pulsing rounded block.
**Error states**: inline coral banner + retry ghost button inside the failed card — the rest of
the page stays alive. 404/permission pages reuse the empty-state pattern with a coral accent.

---

## 10. Charts (Recharts — planning/14 owns the data rules)

- Only `var(--chart-*)` colors. Curved (`monotone`) lines, 2.5px stroke, soft 20%→0% gradient
  area fills, no vertical grid lines, horizontal grid `--border` dashed at 40%.
- Active point: 6px white dot ringed by series color + floating charcoal tooltip pill (the
  reference's "9.178 Steps" pattern).
- Axis labels: helper text, muted; no axis lines. Legends: pill chips, not squares.
- On hero purple cards, charts render white/translucent (white line, `rgba(255,255,255,.25)` fill).
- Donuts: 70% inner radius, center KPI number. Bars: 8px radius tops, 60% band width.

---

## 11. Dashboard composition (CRM mapping of the reference)

```
[Header: breadcrumb+title · search · bell · avatar]
[HERO: purple gradient analytics card ~7 cols]   [pink card: This-month Revenue w/ mini spark]
  cashflow curve chart + range dropdown           [white KPI: Outstanding ₹ + delta]
  inner translucent tiles: Revenue · Expenses ·
  Net (the reference's 748hr/9.178St pattern)
[Row: KPI tiles ×4 — Open Pipeline · Follow-ups Due · Active Works · Low Stock]
[Row: progress cards — works due this week (green bars, coral days-left pills)]
[Right panel (xl): Today's follow-ups list (avatar rows, no dividers) ·
  segmented toggle All/Mine · upcoming meetings mini-list]
```

Role dashboards (planning/14) rearrange the same widgets — never restyle them.

---

## 12. Login page (CRM adaptation of reference 1)

Full-viewport canvas: **left 50% deep-space navy `--art-navy`, right 50% white** — split behind
a floating central container (~88% viewport, 28px radius, elevation 3, white).

**Left panel — artwork** (edge-to-edge inside a 16px white inner frame, 24px radius):
cinematic illustration (§13). Overlays, all floating on the art: top-left caption
"LeadSpark CRM" in white caps; bottom-left a rotating value line ("Every lead, one flow — leads
→ customers → invoices") in white/70; bottom-right two 44px outline-circle carousel arrows
cycling three taglines/artworks. No sign-up buttons (internal app).

**Right panel — form** (centered column, max-width 400):
logo wordmark top-left; display heading **"Hi there"** + helper "Welcome back to LeadSpark";
Username/email + password inputs (18px radius, focus glow); "Forgot password?" right-aligned in
`--attention-strong` 12px (AA ✓); 48px **coral pill Login button** (`--attention-strong` fill,
white text — the reference's CTA); remember-me checkbox; OTP-reset modal flow per planning/08.
No social logins (internal CRM) — footer helper shows version + "Contact your admin for
access". Language selector top-right optional (phase 2).

Mobile: artwork collapses to a 200px banner above the form inside one card.

---

## 13. Illustration style (art direction — original work only)

Inspired by the reference's *quality*, never its content. Brief for the hero artwork(s):

- **Scene family**: vast dreamlike landscapes at dusk — canyon ridges, calm ocean horizon,
  terraced dunes — with one large celestial body (planet/moon) and a scatter of fine stars.
- **Palette**: deep navy → midnight blue base (`--art-navy → --art-navy-2`), **purple-biased**
  atmosphere (tie-in to brand: `--primary` glow on horizons), warm copper accent light
  (`--art-copper`) — the brand triad re-expressed as lighting, so artwork and UI share DNA.
- **Rendering**: painterly matte-painting digital art; soft gradients, atmospheric haze between
  three depth layers (foreground silhouette / midground forms / cosmic background); gentle rim
  lighting; zero text, zero characters, zero recognizable landmarks.
- **Composition**: focal celestial body upper third, leading lines toward it, calm lower third
  (safe zone for overlaid UI text).
- **Forbidden**: cartoon/flat vector clipart, stock-photo realism, harsh saturation, busy detail
  behind text zones, copies of any reference.
- **Code-built fallback** (ships first, replaced later without layout change): layered CSS/SVG —
  radial navy gradient sky, two blurred gradient "planet" circles (purple + coral), 1px SVG star
  field at 3 opacities, silhouette ridge as SVG path with dark gradient fill, subtle grain
  overlay (4% noise). Looks premium day one, zero licensing risk.

Empty-state spot illustrations: single-weight purple line drawings on soft blobs — same rounded
geometry as the icons, no gradients.

---

## 14. Motion (Framer Motion + Lenis)

Durations: 150ms micro (hover/press) · 200–250ms component (modal, dropdown, toast) · 350ms page
section stagger. Easing `cubic-bezier(0.22, 1, 0.36, 1)` everywhere.

- Page enter: sections `fadeUp` 12px, 50ms stagger. KPI numbers count-up once (600ms).
- Hover: cards lift −2px + elevation step; buttons glow; table rows tint. Press: scale 0.98.
- Modals scale 0.96→1 + fade; dropdowns fade + 4px slide; segmented controls slide their thumb;
  kanban drag uses layout animations with a 3° tilt on the dragged card.
- Lenis smooth scroll on the canvas; `data-lenis-prevent` on tables/modals/menus.
- `MotionConfig reducedMotion="user"` — all motion collapses to fades for reduced-motion users.
- Never: parallax, bounce easings, looping attention-seekers, animation on data refetch.

---

## 15. Responsive behavior

| Breakpoint | Frame |
|---|---|
| ≥1440 | rail + main + right panel (12 col) |
| 1024–1439 | rail + main, right-panel widgets fold to bottom of main (12 col) |
| 768–1023 | rail + main (8 col); tables → cards begin |
| <768 | bottom pill dock; 4 col; all tables are cards; modals become full-height sheets; page padding 16, card padding 16, hero padding 24 |

Identity (colors, radius, type scale) never changes across breakpoints — only density and layout.
Touch targets ≥44px on <1024.

---

## 16. Accessibility

- Contrast: AA minimum everywhere. Verified pairs: `--muted-foreground #6B7280` on white 4.8:1 ✓ ·
  `--attention-strong #BE123C` on white ≥6:1 ✓ and on `--attention-soft` ≥5:1 ✓ · white on
  `--attention-strong` ≥6:1 ✓ · white on button gradient (`#5B4FE0→#4F46E5`) ≥5.4:1 ✓ ·
  `--success-strong` on white 5.0:1 / on `--success-soft` 4.5:1 ✓ · hero gradients carry only
  ≥18px white text (all stops ≥3:1 AA-large). Base hues never carry normal-size text (§2 rules).
  **Enforcement**: a token contrast-check script runs in CI against every documented pair —
  when a token changes, the pair list is re-validated automatically (fix tokens, not claims).
- Full keyboard path: visible focus (2px purple ring, 2px offset) on every interactive element;
  focus is never `outline: none`d away without the ring replacement.
- Base UI primitives supply ARIA roles/traps (dialogs, menus, tabs) — never rebuild them raw.
- Color never carries meaning alone: badges keep their label text, deltas keep ↑/↓ glyphs.
- Forms: labels always visible (no placeholder-as-label), errors announced via `aria-live`.
- Charts: provide the underlying table via an accessible toggle on report pages.
- Respect `prefers-reduced-motion`; icons on buttons have `aria-label`s.

---

## 17. Consistency rules — Do's & Don'ts

**Do**
- Reuse the shared kit (`shared/ui`) for every control; new pages compose, never restyle.
- Keep one hero surface per screen; keep every other card white.
- Use the status-color map identically across all modules.
- Step radius down for nesting; keep spacing on the 8px scale; use tokens for every color.

**Don't**
- ❌ New colors, new fonts, new radii, new shadow recipes — ever.
- ❌ Borders as separators (whitespace + hover tints only; the 1px `--border` is for inputs).
- ❌ Pure black text or harsh black shadows.
- ❌ Two gradient cards side by side, gradients on small components, or text on busy artwork
  outside the safe zone.
- ❌ Dense tables with zebra stripes, vertical rules, or <56px rows.
- ❌ Component one-offs ("just this page") — if a variant is needed, add it to the system first.

---

## 18. Implementation notes (Tailwind v4)

Declare every token above in `globals.css` `@theme inline` (oklch), with `.dark` overrides;
components consume semantic utilities (`bg-card`, `text-muted-foreground`, `shadow-card`,
`rounded-input|card|hero`) — never raw hex in JSX. The radius scale maps to
`--radius-pill: 999px · --radius-input: 18px · --radius-card: 24px · --radius-hero: 28px ·
--radius-rail: 32px`. Elevation levels map to `--shadow-1..3` + `--shadow-hero`. cva variants for
buttons/badges implement §6 exactly. This file + planning/04 = everything a developer needs;
when they conflict on a visual value, **style.md wins**.
