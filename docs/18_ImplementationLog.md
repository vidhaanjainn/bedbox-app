# 18 — Implementation Log

Newest first.

## 2026-07-12 · SEC-01 + SEC-02 (code deployed; migration pending owner)
- **What:** New `app/api/onboard/[token]/route.ts` — GET validates token server-side (service
  role) and returns only name/email/mobile; POST issues signed upload URLs for Aadhaar images
  (`onboarding/{id}/…` paths) and accepts a whitelisted, length-clamped submit payload; captures
  IP from request headers (removed ipify call); guards double-submit with
  `.eq('onboard_token_used', false)`. Rewired `app/onboard/[token]/page.tsx` to use the API +
  `uploadToSignedUrl`. Removed unsafe policies from SUPABASE_SETUP.sql with explanatory notes;
  wrote `supabase/migrations/20260712_sec01_secure_onboarding.sql` (drops `onboard_token_select`,
  `allow_onboard_token_update`, `anon_upload_resident_docs`).
- **Why:** P0 — anon could read/overwrite any pending resident and spam the docs bucket.
- **Testing:** `npm run build` clean; local dev: GET/POST with short/invalid tokens → correct
  400/404 JSON; prod deploy verified live (route responds). Full happy-path retest requires a
  live DB (blocked — see below).
- **Blocked:** prod Supabase project `nbhmjqkhpdpdxkkzfgca` is NXDOMAIN (paused/deleted; in an
  account not connected here) → migration NOT applied, DB-backed prod features currently down.
- **Verify after owner restores + runs migration:**
  `curl "https://<proj>.supabase.co/rest/v1/residents?select=id&limit=1" -H "apikey: <ANON>" -H "Authorization: Bearer <ANON>"`
  must return `[]`; then complete one real onboarding link end-to-end. Every completed task adds: date · task ID · what changed · why · files · testing ·
remaining work.

## 2026-07-12 · DOC-01 · Documentation operating system installed
- **What:** Full repo audit; created docs/ (status, audit, roadmap, backlog, security, UX review,
  vision, monetization, decision/implementation logs, supporting guides); AGENTS.md pointed at
  the execution guide.
- **Why:** Turn the repo into a self-driving project any AI model can resume (owner directive).
- **Files:** docs/* (new), AGENTS.md (pointer added). No app code changed.
- **Testing:** n/a (docs only).
- **Remaining:** deep specs (10_FeatureSpecifications.md) get written per-task before coding;
  next code task = SEC-01.
