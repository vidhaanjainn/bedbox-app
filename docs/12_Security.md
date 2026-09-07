# 12 - Security

## Problem
The app is client-heavy: pages query Supabase directly with the anon key, so **RLS policies are
the entire security boundary**. Three policies in SUPABASE_SETUP.sql are unsafe, and resident PII
(Aadhaar images!) lives behind them.

## §1 (P0) Onboarding token policies expose/allow-overwrite of resident rows
Current (`SUPABASE_SETUP.sql:335-351`):
```sql
CREATE POLICY "onboard_token_select" ON residents FOR SELECT
  USING (onboard_token IS NOT NULL AND onboard_token_used = false
         AND onboard_token_expires_at > NOW());
CREATE POLICY "allow_onboard_token_update" ON residents FOR UPDATE
  USING (…same…) WITH CHECK (true);
```
**Why it's broken:** the policy never compares the token the visitor *has* to the row. Any anon
client can `select * from residents` and read every row with a live token (name, mobile, email,
emergency contacts), and can UPDATE those rows arbitrarily (`WITH CHECK (true)` - including
setting `rent_amount`, `status`, pointing `aadhaar_*_url` anywhere).

**Ideal implementation:** RLS cannot see the token in a WHERE clause safely (the client controls
the query). Move the onboarding read/write to a **server API route using the service-role key**:
- `GET /api/onboard/[token]` → validates token server-side, returns only the fields the wizard needs
- `POST /api/onboard/[token]` → validates token, whitelists writable fields, marks token used
- Then **drop both anon policies** on `residents`.
Also have the wizard upload docs via a server route (or signed upload URLs) - see §2.

**Acceptance criteria:** anon `select`/`update` on `residents` returns 0 rows / permission denied;
onboarding wizard still completes end-to-end; token single-use + expiry enforced server-side.

## §2 (P0) Open storage upload policy
`anon_upload_resident_docs` allows ANY anonymous INSERT into `resident-docs` (unlimited spam,
malware hosting, cost abuse). Fix: replace with server-generated **signed upload URLs** scoped to
`onboarding/{resident_id}/…` issued only after token validation (part of SEC-01's API route), then
drop the anon policy.

## §3 (P1) Hardcoded admin identity
`is_admin()` = email equality with `thebedbox.in@gmail.com`, duplicated in API routes and email
targets. Fix: `admins` table (user_id, role) + `is_admin()` checks membership; move admin
notification address into `settings`. Prereq for multi-admin, staff roles, and SaaS.

## §4 (P1) Service-role key usage
`/api/booking-form` falls back to the anon key if service key missing - fine, but audit every API
route: service-role code must validate inputs strictly (it bypasses RLS). Never expose service key
to client (`NEXT_PUBLIC_` prefix forbidden). `NEXT_PUBLIC_GEMINI_API_KEY` in .env.local is
client-exposed by design of the prefix - if unused, delete it; if used, move server-side.

## §5 (P2) Aadhaar/PII handling (legal - see 30_LegalCompliance.md)
- Keep buckets private; serve documents only via short-lived signed URLs to admin sessions
- Add an explicit consent checkbox + purpose text in onboarding (DPDP Act 2023 alignment)
- Data retention: delete/archive KYC docs N months after move-out (define N in settings)
- Add audit logging table for document access (SaaS-stage)

## §6 (RESOLVED 2026-09-03) Same open-RLS drift found across 7 tables total
What started as one bug (residents onboarding tokens) turned out to be a systemic pattern: at
some point, broad `auth.uid() IS NOT NULL` policies were added directly in the Supabase dashboard
(never committed to git) alongside the correct admin/own-row policies, on: `residents`, `admins`
(worse - allowed self-promotion to super_admin via INSERT), `beds`, `rooms`, `electricity_readings`,
`maintenance_requests`, `rent_payments`. Net effect: any authenticated user (any resident logged
into the portal) could read/edit/delete every other resident's financial and personal data, and
in the `admins` case, grant themselves admin access outright.
**All fixed** via migrations `sec01_close_open_residents_rls`, `sec_close_open_admins_rls`,
`sec_close_open_rls_remaining_tables` - verified via `pg_policies` that no `auth.uid() IS NOT NULL`
broad policy remains anywhere except the correctly-scoped
`portal_user_id = auth.uid()` one on `residents`. `is_admin()` also hardened to check
`is_active = true`. **Lesson for future work:** never edit RLS policies directly in the Supabase
dashboard - always via a migration file in `supabase/migrations/`, so drift like this can't recur
silently. `bookings`, `notice_periods`, `short_stays`, `properties`, `settings`, `notifications`
were checked and were already correctly scoped.

## Roles target model (future)
admin (owner) → manager (per property) → staff (tasks only) → resident (own data only).
All new tables get RLS from day one: admin-all + resident-own-select patterns as in current schema.
