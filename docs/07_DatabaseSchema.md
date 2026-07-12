# 07 — Database Schema

**Authoritative DDL: `SUPABASE_SETUP.sql` (repo root; move to `supabase/` in OPS-01).**
Read that file for columns; this doc records intent and planned changes.

## Live tables
`rooms` → `beds` (rates live on bed) → `residents` (core; onboarding+portal+docs columns)
→ `rent_payments` (month/year, rent+electricity+late fee, partials, screenshot, receipt fields)
→ `electricity_readings` (generated units), `notice_periods` (60-day rule),
`maintenance_requests`, `bookings` (pre-resident funnel), `short_stays`, `receipt_requests`,
`settings` (key-value config).

## Known schema debt
- Duplicate resident columns (DATA-02) · `lib/types.ts` drift (DATA-01) · hardcoded `is_admin()` (SEC-03)

## Planned tables (create only when the task starts; RLS from day one)
| Table | Task | Sketch |
|---|---|---|
| admins | SEC-03 | user_id FK auth.users, role |
| staff / staff_payouts | STAFF-01 | name, phone, salary, payout(month, amount, status, paid_at, mode) |
| expenses | EXP-01 | category, vendor, amount, month/year, receipt_path, notes |
| announcements | RES-03 | title, body_md, published_at |
| nearby_places / vendors | RES-02 | name, category, phone, maps_url, distance_note |
| notifications | SAAS-04 | user_id, type, title, message, read, action_url |
| properties (+property_id FKs) | SAAS-01 | multi-tenant root |
| deposit_settlements | RES-06 | resident_id, deductions jsonb, refunded_amount, settled_at |

## Conventions
UUID PKs, `created_at` default now(), TEXT+CHECK enums, `settings` for property-level config,
money `NUMERIC(10,2)`, months as (month int, year int). Migrations: one SQL file per task under
`supabase/`, applied via dashboard/MCP, committed with the code that uses it.
