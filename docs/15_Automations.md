# 15 — Automations

Runtime: **Vercel Cron** → `/api/cron/daily` (07:30 IST) and `/api/cron/monthly` (1st, 06:00 IST),
`CRON_SECRET`-protected (AUTO-01). Every job idempotent (safe to re-run) and dry-runnable.

## Daily job pipeline (build up over AUTO tasks)
1. Rent reminders (AUTO-02) 2. Notice/last-day alerts (AUTO-06) 3. Onboarding nudges: token
expiring in 2 days & not submitted → remind resident+admin 4. Staff payout due alerts (STAFF-01)
5. KYC-incomplete flags for active residents

## Monthly job pipeline
1. Generate rent_payments rows for active residents incl. unbilled electricity (AUTO-03)
2. Admin digest: occupancy, collected vs pending, expenses, move-ins/outs (AUTO-07)

## Event-driven (in API routes, not cron)
- Booking inquiry → Sheets + admin email ✅ live
- Resident create/update/approve/archive → Sheets "Residents" tab sync (AUTO-04)
- Payment marked paid → receipt email (AUTO-05)
- Onboarding submitted → admin email; approved → welcome email w/ portal + WiFi + rules

## Rules
- Side effects non-fatal; DB write decides success. Log every automation run outcome.
- All copy/config (UPI id, grace days, reminder cadence) from `settings`, not code.
