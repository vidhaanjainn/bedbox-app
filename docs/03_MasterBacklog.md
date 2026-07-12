# 03 — Master Backlog

Task format: **ID · Priority · Difficulty · Est hours · Depends on**. Each task is small enough
for one AI session and must leave the app deployable. Mark ✅ + date when done, and mirror the
change in PROJECT_STATUS.md + 18_ImplementationLog.md.

## Phase 0 — Foundation Hardening

### SEC-01 · P0 · Medium · 4h · deps: none
**Move onboarding to server API routes; remove unsafe RLS.**
Why: anon can read/overwrite any resident with a live token (12_Security.md §1).
Files: new `app/api/onboard/[token]/route.ts` (GET validate+fetch, POST submit with field
whitelist, mark token used); rewrite data calls in `app/onboard/[token]/page.tsx`; SQL migration
dropping `onboard_token_select` + `allow_onboard_token_update`.
Test: wizard completes end-to-end; anon `select`/`update` on residents denied; expired/used token
rejected. ✅ when deployed + verified in prod.

### SEC-02 · P0 · Medium · 3h · deps: SEC-01
**Signed upload URLs for KYC docs; drop `anon_upload_resident_docs`.**
Server route issues `createSignedUploadUrl` for `resident-docs/onboarding/{residentId}/{side}.jpg`
after token validation. Test: upload works in wizard; direct anon upload to bucket fails.

### DATA-01 · P1 · Easy · 2h · deps: none
**Regenerate types from live schema.** `supabase gen types typescript` → replace `lib/types.ts`;
delete Property/Admin/Notification fantasy types or move to `lib/types.future.ts`. Test: `next build` clean.

### DATA-02 · P1 · Medium · 4h · deps: DATA-01
**Consolidate duplicate resident columns + single onboarding path.**
Migration: keep `emergency_contact_phone`, `aadhaar_front_path`/`back_path` (single bucket
`resident-docs`), keep `agreement_signed_at` (backfill from `tc_agreed_at`); drop aliases. Update
all pages referencing dropped columns (grep first). Test: admin new-resident + self-onboard both
write same columns; existing rows backfilled.

### SEC-03 · P1 · Medium · 3h · deps: none
**`admins` table + membership-based `is_admin()`; admin email into settings.**
Migration + update `is_admin()`; replace hardcoded `thebedbox.in@gmail.com` in API routes with
settings lookup. Test: admin login still works; second admin can be added by insert.

### OPS-01 · P2 · Easy · 1h · deps: none
**Repo hygiene.** Rewrite README (what/stack/setup/env table/deploy); .gitignore `.DS_Store`,
`tsconfig.tsbuildinfo`, `.next/`; move root SQL files to `supabase/migrations/`-style folder.

## Phase 1 — Automation Engine

### AUTO-01 · P1 · Easy · 2h · deps: none
**Cron scaffold.** `vercel.json` crons → `/api/cron/daily` + `/api/cron/monthly`, protected by
`CRON_SECRET` header check. Test: manual curl with/without secret.

### AUTO-02 · P1 · Medium · 4h · deps: AUTO-01, Resend domain ⚠
**Rent reminders.** Daily cron: pending/partial rent_payments → email T-3 before due (due day =
`date_of_joining` day-of-month), overdue every 3 days, max 4 nudges (track `last_reminded_at`
column). Template: friendly Hinglish-friendly copy, UPI details from settings, amount breakdown.
Test: dry-run mode env flag logging instead of sending.

### AUTO-03 · P1 · Medium · 3h · deps: AUTO-01
**Auto-create monthly rent rows** on the 1st for active residents (rent + unbilled electricity),
idempotent (skip existing month/year rows).

### AUTO-04 · P1 · Medium · 4h · deps: none
**Sheets sync for residents.** `lib/sheets.ts` (reuse booking-form JWT code); call from
approve/archive/edit API paths; sync Name/Phone/Email/Room/Rent/Deposit/Move-in/Move-out/Status/
Payment status/Notice/Docs-complete to a "Residents" tab keyed by resident id. Non-fatal on error.

### AUTO-05 · P2 · Medium · 3h · deps: AUTO-01, Resend domain ⚠
**Auto receipt email** when payment marked paid; move jsPDF generation into `lib/receipt.ts`,
email PDF, set `receipt_sent_at`.

### AUTO-06 · P2 · Easy · 2h · deps: AUTO-01 — notice/last-day reminders (resident + admin).
### AUTO-07 · P2 · Medium · 3h · deps: AUTO-03 — monthly admin digest email.

## Phase 2 — Resident Delight

### RES-01 · P1 · Easy · 3h · deps: none
**Portal home hub**: WiFi password, house rules, contacts, quick actions — all from `settings`
keys (`wifi_password`, `house_rules_md`, …) + admin settings UI to edit them.

### RES-02 · P2 · Medium · 4h — `nearby_places` + `vendors` tables (name, category, distance,
phone, maps link), admin CRUD, portal directory grouped by category.
### RES-03 · P2 · Easy · 3h — `announcements` table, admin composer, portal feed + unread dot.
### RES-04 · P1 · Medium · 3h — portal payment history, outstanding banner, receipt downloads.
### RES-05 · P2 · Easy · 2h — documents vault (agreement, receipts via signed URLs).
### RES-06 · P2 · Medium · 4h — move-out workflow: notice → admin checklist → deposit settlement
record → auto-archive + Sheets sync.

## UX track (see 04_UIUXReview.md for specifics)
UX-01 · P1 · 3h — design tokens (teal palette, spacing, radius, typography) in globals + `components/ui/*`
UX-02 · P1 · 4h — shared components: PageHeader, StatCard, EmptyState, StatusBadge, Skeleton, ConfirmDialog
UX-03 · P1 · 3h — dashboard redesign (hierarchy: money → occupancy → action items)
UX-04 · P2 · 3h — mobile polish portal (bottom nav, large touch targets, PWA icon/splash)
UX-05 · P2 · 2h — empty/loading/error states everywhere (no blank tables)
UX-06 · P2 · 2h — onboarding wizard polish: progress, autosave, success screen with portal CTA

## Phase 3 — Landlord Ops
STAFF-01 · P1 · 5h — `staff` + `staff_payouts` tables, admin page (salary, pending/done/advance), payout-due reminders in daily cron
EXP-01 · P1 · 4h — `expenses` table (category, vendor, month, amount, receipt photo), admin page, monthly totals on dashboard
FIN-01 · P2 · 4h — cash-flow report (income vs expense vs pending, collection efficiency %)
RPT-01 · P2 · 3h — CSV exports (residents, payments, expenses)

## Phase 4 — SaaS (specs in 23_SaaSRoadmap.md; do not start before Phase 3)
SAAS-01 · 8h — properties table + property_id everywhere + RLS membership
SAAS-02 · 6h — roles/multi-admin + landlord onboarding
SAAS-03 · 8h — Razorpay: rent collection links + subscription billing
SAAS-04 · 4h — notification abstraction (email/push/WhatsApp adapters)

## Definition of Done (every task)
1. `npm run build` passes  2. Flow manually verified (or dry-run for crons)
3. RLS considered for any new table  4. PROJECT_STATUS.md + 18_ImplementationLog.md updated
5. Migration SQL committed under `supabase/` if schema changed  6. Deployed and spot-checked
