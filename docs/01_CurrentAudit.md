# 01 — Current Audit (as of 2026-07-12)

## Stack
- **Next.js 16.2.1** (App Router, client-heavy pages), React 19, TypeScript, Tailwind CSS 4, Radix UI primitives, lucide-react, Recharts, date-fns, jsPDF
- **Supabase**: Postgres + Auth (admin password login, resident email OTP) + Storage (`resident-docs`, `private-docs` private buckets) + RLS
- **Resend** for email (currently sandbox sender `onboarding@resend.dev`)
- **googleapis** for Google Sheets append (booking form only)
- Deployed on Vercel (`bedbox-app-alpha.vercel.app`); no cron jobs configured

## Codebase shape (~7,000 lines of TS/TSX)
```
app/
  admin/            ← 13 admin pages behind app/admin/layout.tsx (sidebar shell)
    dashboard, residents (list/new/[id]/[id]/edit), rooms, rent, electricity,
    bookings, short-stays, notices, maintenance, receipts, reports, settings
  portal/           ← resident portal (OTP login): home, maintenance, notice, receipt
  book/             ← public booking inquiry form
  onboard/[token]/  ← resident self-onboarding wizard (token link, 7-day expiry)
  login/            ← admin + resident login
  api/              ← booking-form, approve-resident, archive-resident,
                      ensure-portal-user, notify-admin
lib/ supabase clients, types.ts (OUT OF DATE — see drift below), utils.ts
```
No components/ dir in use, no tests, README is the default create-next-app template.

## Database (source of truth: SUPABase_SETUP.sql at repo root)
Tables: `rooms`, `beds`, `residents` (core, with onboarding/portal/doc columns),
`rent_payments`, `electricity_readings`, `notice_periods`, `maintenance_requests`,
`bookings`, `short_stays`, `receipt_requests`, `settings` (key-value).
Helper fns: `is_admin()` (hardcoded email check), `generate_onboard_token()`.
Extra root files: SEED_RESIDENTS.sql, SETTINGS_MIGRATION.sql (uncommitted).

## What WORKS today (verified by code reading)
- **Public booking funnel**: /book → POST /api/booking-form → Supabase `bookings` (source of
  truth) + Google Sheets append (non-fatal if unconfigured) + Resend admin notification
- **Booking pipeline**: admin bookings page with statuses inquiry→booked→onboarding_sent→onboarded
- **Resident onboarding**: token link → /onboard/[token] wizard → Aadhaar front/back upload to
  `resident-docs`, emergency contact, agreement acceptance w/ timestamp+IP → admin approves
  (/api/approve-resident) → portal user provisioned (/api/ensure-portal-user)
- **Admin manual onboarding**: residents/new (uploads to `private-docs` — parallel path)
- **Rent**: monthly rent_payments with electricity merge, late fee, partial payments, payment
  screenshots, receipt requests; receipts sidebar + jsPDF
- **Electricity**: per-resident readings, generated units, rate from settings
- **Notices**: 60-day notice periods, portal submission + admin management
- **Maintenance**: categories/priorities, portal submission + admin management
- **Short stays**: daily-rate guests with KYC + payment tracking
- **Reports**: Recharts dashboards; **Settings**: property config key-value
- Archive resident flow; PWA meta tags (per commit history)

## Gaps vs. the product vision (details → 03_MasterBacklog.md)
1. **No automations**: zero cron jobs → no rent reminders, no auto receipts, no Sheets sync on
   resident changes (Sheets only on booking inquiry), no monthly reports
2. **Resident app is thin**: no WiFi password, house rules, nearby places, vendor directory,
   announcements, payment history UI polish, document downloads
3. **No staff/expense module**: staff salaries, payouts pending/done, maintenance spend per month
4. **Security holes** in onboarding RLS + open storage uploads (12_Security.md) — P0
5. **Schema drift & duplicate columns** (types.ts fantasy schema; two onboarding paths)
6. **Single-tenant hardcoding**: admin email in SQL + API routes; no properties table in live
   schema → blocks multi-property and SaaS
7. **No notifications infra**: Notification type exists in types.ts but no table, no push
8. **UI/UX**: functional but inconsistent (see 04_UIUXReview.md); default README; dark-navy email
   theme vs app theme mismatch
9. **Email**: sandbox sender; admin address hardcoded in 3+ places
10. **No tests, no CI**, tsconfig.tsbuildinfo committed, .DS_Store noise in git

## Technical debt list
- `lib/types.ts` must be regenerated from live schema (supabase gen types)
- Consolidate duplicate resident columns + single onboarding path/bucket
- Extract admin email / property identity into `settings` or a `properties` table
- Hardcoded Google Sheet ID fallback in booking-form route
- Client-side pages doing direct Supabase queries — fine for now, but note RLS is the ONLY
  security boundary, which is why the RLS bugs are P0
