# 18 — Implementation Log

Newest first.

## 2026-09-03 (part 2) · Found and fixed the same open-RLS drift on 6 more tables
While building the multi-admin feature, checked `admins` table RLS and found any authenticated
user could INSERT themselves as super_admin (with_check `auth.uid() IS NOT NULL`, no ownership
check at all). Widened the check to ALL public tables in one query — found the identical drift
pattern on `beds`, `rooms`, `electricity_readings`, `maintenance_requests`, `rent_payments`
(broad `auth.uid() IS NOT NULL` policies alongside/instead of correct admin/own-row scoping).
With owner approval, applied 2 migrations dropping all the unsafe policies; verified via
`pg_policies` query that zero broad policies remain anywhere except the correct
`portal_user_id = auth.uid()` one on residents. `is_admin()` hardened to also require
`is_active = true`. Full writeup: 12_Security.md §6.

## 2026-07-12 (part 2) · Found & fixed the real "prod DB unreachable" root cause + a live P0 hole
- **Investigation:** owner unpaused a Supabase project named "bedbox" (ref `rskbrdzbbfyyhaxucmgg`)
  but the app's env vars (Vercel + `.env.local`) pointed at a *different* ref
  (`nbhmjqkhpdpdxkkzfgca`) that still didn't resolve. First check of `rskbrdzbbfyyhaxucmgg`
  showed 0 rows everywhere (looked like a stale scaffold) — but that was a momentary
  just-unpaused read; a repeat query moments later showed real data (2 residents, 20 rooms, 31
  beds, 1 rent payment, 6 settings). Owner then independently confirmed via the Supabase
  dashboard that `rskbrdzbbfyyhaxucmgg` is the one shown as connected to the bedbox app — this
  is the real production database and always has been.
- **Root cause confirmed:** forced a fresh Vercel production build (empty commit → deploy) and
  inspected the freshly-built client JS bundle; it still baked in the dead
  `nbhmjqkhpdpdxkkzfgca` URL. This proves Vercel's saved Production env var for
  `NEXT_PUBLIC_SUPABASE_URL` is genuinely wrong (not a stale-build artifact) — at some point it
  was pointed at the wrong/now-dead project while everyone kept using the real one directly via
  the Supabase dashboard.
- **Bigger finding while investigating:** the live `residents` table had RLS policies (edited
  directly in the Supabase dashboard at some point, never committed to git) that were WORSE than
  the already-known SEC-01 bug: `allow_token_lookup` (SELECT, roles=public, qual=`true`) let
  ANYONE with the anon key read every resident's full record including Aadhaar file paths with
  zero authentication; `allow_onboard_token_update` (UPDATE, qual=`true`, with_check=`true`) let
  anyone overwrite any resident; `residents_select/update/insert/delete` (all
  `auth.uid() IS NOT NULL`) let any logged-in user read/edit/delete every other resident.
  `storage.objects` had zero policies at all (not even the admin ones).
- **Fix applied (with owner's explicit approval — platform's safety classifier correctly required
  it for a production DB migration):** migration `sec01_close_open_residents_rls` dropped all of
  the above dangerous policies, kept the legitimate `Admins full access to residents` (is_admin()
  based — verified it now checks a real `admins` table membership, not a hardcoded email as the
  repo's SQL implied), added a correctly-scoped `resident_read_own` (portal_user_id = auth.uid()),
  and added back admin read/delete on `resident-docs` + admin-all on `private-docs` in storage.
- **Verified closed:** live curl against `rskbrdzbbfyyhaxucmgg` with the real anon key —
  anonymous SELECT on residents returns `[]`; anonymous UPDATE affects 0 rows. Confirmed via
  `pg_policies` that only 2 policies remain on `residents`.
- **Also discovered:** production's `is_admin()` already reads from a real `admins` table (1 row)
  and a `properties` table already exists (1 row) — SEC-03 is effectively done live; the repo's
  `SUPABASE_SETUP.sql` and `lib/types.ts` are BOTH out of sync with the real schema, in different
  directions than originally audited. DATA-01 needs to re-pull live schema truth via Supabase
  MCP/CLI, not trust either committed file.
- **Fixed `.env.local`:** URL and anon key corrected to the real project; service-role line
  blanked with instructions (never fetched/handled directly — that secret was not accessible to
  the AI session and shouldn't be pasted into chat).
- **Still needed (owner, blocking):** Vercel Production (and Preview/Dev) env vars —
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — must
  be updated in the Vercel dashboard to match `rskbrdzbbfyyhaxucmgg` (values in
  PROJECT_STATUS.md's Blocked By section). The AI session has no tool that can write Vercel env
  vars and the local `vercel` CLI's saved login is expired, so this cannot be done by AI right
  now. After the owner updates it, trigger a redeploy and re-verify the full onboarding + admin +
  portal flow against real data.

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
