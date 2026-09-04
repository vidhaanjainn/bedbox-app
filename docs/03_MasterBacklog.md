# 03 — Master Backlog

Task format: **ID · Priority · Difficulty · Est hours · Depends on**. Each task is small enough
for one AI session and must leave the app deployable. Mark ✅ + date when done, and mirror the
change in PROJECT_STATUS.md + 18_ImplementationLog.md.

## Phase 0 — Foundation Hardening

### SEC-01 · P0 · Medium · 4h · deps: none — ✅ DONE 2026-07-12. Code deployed + migration applied directly to the real production project (`rskbrdzbbfyyhaxucmgg`) and verified closed via live curl (anon SELECT/UPDATE both blocked). Full story: 18_ImplementationLog.md.
**Move onboarding to server API routes; remove unsafe RLS.**
Why: anon can read/overwrite any resident with a live token (12_Security.md §1).
Files: new `app/api/onboard/[token]/route.ts` (GET validate+fetch, POST submit with field
whitelist, mark token used); rewrite data calls in `app/onboard/[token]/page.tsx`; SQL migration
dropping `onboard_token_select` + `allow_onboard_token_update`.
Test: wizard completes end-to-end; anon `select`/`update` on residents denied; expired/used token
rejected. ✅ when deployed + verified in prod.

### SEC-02 · P0 · Medium · 3h · deps: SEC-01 — ✅ DONE 2026-07-12 (bundled with SEC-01). Storage RLS also restored (was completely missing — 0 policies on storage.objects).
**Signed upload URLs for KYC docs; drop `anon_upload_resident_docs`.**
Server route issues `createSignedUploadUrl` for `resident-docs/onboarding/{residentId}/{side}.jpg`
after token validation. Test: upload works in wizard; direct anon upload to bucket fails.

### DATA-01 · P1 · Easy · 2h · deps: none — ⚠️ REVISED 2026-07-12: `properties`/`admins`/`notifications`
are REAL tables on the live DB (not fantasy) — `admins` has 1 row and IS what `is_admin()` checks;
`properties` has 1 row. Task is now: pull live schema via `supabase gen types typescript` (or
Supabase MCP `list_tables`/`execute_sql` against `rskbrdzbbfyyhaxucmgg`), reconcile with what the
app code actually uses (most pages still assume single-tenant, no property_id filtering), decide
whether to wire `properties`/`admins` into the app now or keep them dormant until SAAS-01, and
replace `lib/types.ts` with the true schema either way. Also re-diff `SUPABASE_SETUP.sql` against
the live DB and update it — it's now the one that's behind. Test: `next build` clean.

### DATA-02 · P1 · Medium · 4h · deps: DATA-01
**Consolidate duplicate resident columns + single onboarding path.**
Migration: keep `emergency_contact_phone`, `aadhaar_front_path`/`back_path` (single bucket
`resident-docs`), keep `agreement_signed_at` (backfill from `tc_agreed_at`); drop aliases. Update
all pages referencing dropped columns (grep first). Test: admin new-resident + self-onboard both
write same columns; existing rows backfilled.

### SEC-03 · P1 · Medium · 3h · deps: none — ✅ DONE 2026-09-03. Built `app/api/admin/invite`
(GET list / POST invite / PATCH activate-deactivate) + a Team section in
`app/admin/settings/page.tsx` — invite by email (real Supabase Auth invite email, they set their
own password), assign staff/super_admin role, deactivate without deleting. Login/layout already
had zero hardcoded email gating (confirmed by reading the code) — multi-admin now fully works
end to end. `thebedbox.in@gmail.com` fallback remains only as the default for
`ADMIN_NOTIFY_EMAIL` (which internal admin should get booking alerts — orthogonal to login access).

### OPS-01 · P2 · Easy · 1h · deps: none
**Repo hygiene.** Rewrite README (what/stack/setup/env table/deploy); .gitignore `.DS_Store`,
`tsconfig.tsbuildinfo`, `.next/`; move root SQL files to `supabase/migrations/`-style folder.

## Phase 1 — Automation Engine

### AUTO-01 · P1 · Easy · 2h · deps: none — ✅ CODE DONE 2026-09-03
`vercel.json` cron → `/api/cron/daily`, protected by `CRON_SECRET` header check (Vercel sends it
automatically). Awaiting owner to add `CRON_SECRET` to Vercel env, then AI verifies via curl.

### AUTO-02 · P1 · Medium · 4h · deps: AUTO-01, Resend domain ⚠ — ✅ CODE DONE 2026-09-03
`app/api/cron/daily/route.ts`: pending/partial rent_payments → email T-3 before due (due day =
`date_of_joining` day-of-month), due day, then overdue every 3 days, max 4 nudges (tracked via
`last_reminded_at`/`reminder_count`, migration applied to prod). `REMINDERS_DRY_RUN=1` env flag
logs instead of sending — recommended to test with this on first. Still on the sandbox Resend
sender until domain DNS verifies (see PROJECT_STATUS.md Blocked By); non-fatal either way.
Not yet run live — needs CRON_SECRET in Vercel first.

### AUTO-03 · P1 · Medium · 3h · deps: AUTO-01 — ✅ CODE DONE 2026-09-03 (folded into the same
daily cron rather than a separate monthly one, for simplicity): ensures a rent_payments row
exists for the current month for every active resident, idempotent (skips existing rows). Does
NOT yet fold in unbilled electricity — future refinement once electricity workflow is reviewed.

### AUTO-04 · P1 · Medium · 4h · deps: none — 🟢 PARTIALLY DONE 2026-09-03: `lib/sheets.ts` built
(generic `syncSheetSnapshot` helper, snapshot-overwrite style rather than upsert-by-row — simpler
and predictable for a "click to sync" button) + wired into a one-click "Sync to Sheets" button on
the Rent Tracker page (`app/api/sync-rent-dues`), syncing current month's dues (name, mobile,
room, total/paid/outstanding, status) to a dated tab. Remaining: do the same for the full
Residents list (not just rent dues) and auto-trigger on approve/archive/edit rather than only
manual click — both are quick extensions of the same `lib/sheets.ts` helper.

### WA-01 · P1 · Easy · 2h · deps: none — ✅ DONE 2026-09-03 (workaround for Meta Business
Verification being stuck): "Send WhatsApp" button per pending/partial row on the Rent Tracker page
using a `wa.me` deep link with a prefilled reminder message — opens WhatsApp Web/App with the
message ready, admin taps send. Zero API, zero approval, zero cost, works today. Not a replacement
for AUTO-02's automated email reminders — a manual-but-one-tap channel alongside them. Revisit
full Cloud API automation once Business Verification clears (blocked on Meta, see 13_Notifications.md).

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
