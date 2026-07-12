# 06 — System Architecture

```
Browser (admin / resident / public)
  │  Next.js 16 App Router on Vercel
  ├─ Client pages ──(anon key + RLS)──► Supabase Postgres
  ├─ app/api/* route handlers ─(service role)─► Supabase (privileged writes)
  │      ├─► Resend (email)
  │      └─► Google Sheets (mirror)
  ├─ Supabase Auth: admin = email+password; resident = email OTP → portal_user_id
  └─ Supabase Storage: resident-docs / private-docs (private buckets)
Future: Vercel Cron ─► /api/cron/daily|monthly (AUTO-01) · Razorpay webhooks (SAAS-03)
```

## Rules
- Supabase = single source of truth; Sheets = one-way mirror (D-005)
- Anon/privileged mutations go through API routes with service role + strict validation (D-002)
- RLS on every table: `admin_all_*` + `resident_read_own` patterns (see SUPABASE_SETUP.sql)
- Authorization root: `is_admin()` SQL fn — being generalized to an `admins` table (SEC-03)

## Scaling posture
Free-tier friendly by design. Single property today; SAAS-01 introduces `properties` +
`property_id` FKs + membership RLS — schema was typed for it once (`lib/types.ts` remnants)
but the live DB is single-tenant. Don't fake multi-tenancy before Phase 4.
