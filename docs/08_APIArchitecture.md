# 08 — API Architecture

## Existing route handlers (`app/api/`)
| Route | Purpose | Auth model |
|---|---|---|
| POST /api/booking-form | public inquiry → bookings + Sheets + admin email | public, validated |
| POST /api/approve-resident | activate resident post-onboarding | admin (verify!) |
| POST /api/archive-resident | vacate + cleanup | admin |
| POST /api/ensure-portal-user | create auth user for resident | server |
| POST /api/notify-admin | Resend wrapper | server |

## Planned
- `GET/POST /api/onboard/[token]` — SEC-01 (token-validated, field-whitelisted, single-use)
- `POST /api/onboard/[token]/upload-url` — SEC-02 (signed upload URLs)
- `GET /api/cron/daily` `GET /api/cron/monthly` — AUTO-01+ (CRON_SECRET header)
- `POST /api/webhooks/razorpay` — SAAS-03 (signature-verified)

## Standards for every route
1. Validate/whitelist all inputs (service role bypasses RLS)
2. Verify caller: admin routes must check the Supabase session server-side, cron routes check
   CRON_SECRET, webhooks verify signatures — never trust a body flag
3. External calls (Sheets, Resend) are non-fatal `Promise.allSettled` side-effects; Supabase
   write is the transaction that decides success (pattern already in booking-form — keep it)
4. Return `{ error }` with proper status; log with route-prefixed console.error
5. Shared logic → `lib/` (`lib/sheets.ts`, `lib/notify.ts`, `lib/receipt.ts` as they're built)
