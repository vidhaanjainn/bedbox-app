# 22 — Known Issues

| # | Sev | Issue | Fix task |
|---|-----|-------|----------|
| 1 | P0 | RLS: anon can read/update any resident row with a live onboard token (no token equality check; `WITH CHECK (true)`) | SEC-01 |
| 2 | P0 | Storage: anyone can upload to `resident-docs` bucket (spam/abuse) | SEC-02 |
| 3 | P1 | `lib/types.ts` describes non-existent tables/columns (Property, Admin, Notification, property_id) — misleads all future AI sessions | DATA-01 |
| 4 | P1 | Duplicate resident columns from two onboarding paths (`emergency_contact_phone` vs `_number`, `aadhaar_*_url` vs `_path`, `tc_agreed_at` vs `agreement_signed_at`); two doc buckets for same purpose | DATA-02 |
| 5 | P1 | Admin identity hardcoded (`is_admin()` email in SQL, email in API routes) | SEC-03 |
| 6 | P1 | Emails sent from `onboarding@resend.dev` sandbox — deliverability + unprofessional; admin recipient hardcoded | Owner: verify domain; then AUTO-02 |
| 7 | P2 | Google Sheet ID hardcoded fallback in `app/api/booking-form/route.ts:6` | AUTO-04 |
| 8 | P2 | `NEXT_PUBLIC_GEMINI_API_KEY` in .env.local — client-exposed; appears unused | OPS-01 (remove or move server-side) |
| 9 | P2 | Repo hygiene: default README, committed `tsconfig.tsbuildinfo`, untracked `.next/`, `.DS_Store` churn, root-level SQL not organized as migrations | OPS-01 |
| 10 | P3 | No tests/CI; verification is manual | Revisit Phase 3 |
