# CURRENT PROJECT STATUS

> **This is the living state file.** Every AI session MUST read this first and update it before ending.
> Last updated: 2026-07-12 (initial audit + documentation system created by Claude)

## Overall Progress: ~35% toward v1 "wholesome property OS"

The core admin + resident portal + booking + onboarding skeleton EXISTS and works.
What's missing: automations (reminders/sync), resident lifestyle content (WiFi/nearby/vendors),
staff & expense tracking, security hardening, UI/UX polish pass, multi-property/SaaS foundation.

## Current Phase
**Phase 0 — Foundation Hardening** (see 02_ProductRoadmap.md)

## Last Completed Task
**Root cause found + fixed for the "prod DB unreachable" incident, AND a live critical
vulnerability found + closed.** See full story in 18_ImplementationLog.md (2026-07-12 entries).
Short version: the app's env vars pointed at a dead/deleted Supabase project
(`nbhmjqkhpdpdxkkzfgca`) while the REAL, actively-used database has been
`rskbrdzbbfyyhaxucmgg.supabase.co` all along (owner recognized it on sight). That live database
had drifted far from the committed `SUPABASE_SETUP.sql` — including RLS policies, edited directly
in the Supabase dashboard at some point, that let **anyone with the public anon key read every
resident's data with zero login, and any logged-in user read/edit/delete any resident**. That
hole is now closed (migration applied + verified live: anon SELECT/UPDATE on `residents` both
return nothing). `.env.local` corrected to point at the real project.

**Bonus finding:** production's `is_admin()` already checks a real `admins` table (not a
hardcoded email) and a `properties` table already exists with 1 row — i.e. SEC-03 and part of
SAAS-01 are effectively already done in the live DB. The repo's `SUPABASE_SETUP.sql` and
`lib/types.ts` are both behind reality, not ahead of it as originally audited — re-verify schema
docs against the live DB (DATA-01) before trusting either file.

## Next Recommended Task
1. **OWNER (2 min, blocking):** fix Vercel production env vars — see Blocked By below. Nothing
   else can be verified end-to-end until this is done.
2. Then AI: redeploy, verify onboarding + admin dashboard + portal all work against the real DB
3. Then: DATA-01 (re-audit live schema properly — it has extra tables/columns beyond git) →
   DATA-02 → OPS-01 → AUTO-01 (see backlog). SEC-03 can likely be marked ✅ after a quick check.

## Blocked By (OWNER ACTIONS NEEDED)
- **🔴 Vercel production env vars point at the dead project.** Go to the Vercel dashboard →
  bedbox-app project → Settings → Environment Variables (Production) and set:
  - `NEXT_PUBLIC_SUPABASE_URL` = `https://rskbrdzbbfyyhaxucmgg.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJza2JyZHpiYmZ5eWhheHVjbWdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5Mzg1MzQsImV4cCI6MjA5MDUxNDUzNH0.0LTNA10XUuNltDsDc0c4q0xyVW5QFLI5WXY5RjxWXGs`
  - `SUPABASE_SERVICE_ROLE_KEY` = get from Supabase dashboard → rskbrdzbbfyyhaxucmgg → Project
    Settings → API → "service_role" secret (never share this one in chat — paste it directly
    into Vercel). This value could not be fetched or verified by the AI session; the current one
    in Vercel is almost certainly the old project's and must be replaced.
  Apply to Production **and** Preview/Development, then redeploy (or ask AI to trigger it).
  `.env.local` has already been corrected locally (URL + anon key); its service-role line is
  blank with instructions — fill it in from the same dashboard page.
- Resend: sending from `onboarding@resend.dev` (sandbox). Verify domain (e.g. thebedbox.in) to
  unlock resident-facing emails (AUTO-02/05).
- Google Sheets sync needs `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`,
  `GOOGLE_SHEET_ID` in Vercel env.

## High Priority Bugs / Risks
1. (P0 — FIXED 2026-07-12) Live RLS hole: anon could read every resident, any logged-in user
   could read/edit/delete every resident. Migration applied + verified closed on
   `rskbrdzbbfyyhaxucmgg`. See 18_ImplementationLog.md for full detail.
2. (P0 — blocked on owner) Vercel prod env vars point at a dead Supabase project — app is
   non-functional in production until fixed (see Blocked By)
3. (P1) Schema drift: `lib/types.ts` AND `SUPABASE_SETUP.sql` are both out of sync with the live
   DB in different ways — live DB has `admins`/`properties`/`notifications` tables (real,
   populated) that aren't in the committed SQL, and `is_admin()` differs from what's committed.
   Original audit assumed the fantasy schema. DATA-01 must re-pull live schema truth, not assume
   either file — 22_KnownIssues.md
4. (P1) Duplicate columns in `residents` (emergency_contact_phone/_number, aadhaar_*_url/_path,
   tc_agreed_at/agreement_signed_at) — two onboarding paths write to different columns
5. (P2) Admin email hardcoded in SQL `is_admin()` and in API routes — blocks multi-admin/SaaS

## Recent Decisions (full log: 19_DecisionLog.md)
- D-001: Repo itself is the source of truth; all AI work driven by docs/ + backlog
- D-002: Keep single Supabase project; harden RLS instead of moving to service-role-only API routes (revisit at SaaS stage)
- D-003: Brand = light teal (#00d4c8 family) on warm neutrals; Crib-inspired patterns, own identity

## Files Modified This Session
- Created docs/ (all files), updated AGENTS.md pointer. No app code touched.

## How to resume with any AI model
Open the repo and say: **"Read docs/PROJECT_STATUS.md and docs/20_AIExecutionGuide.md, then
continue from the Next Recommended Task."**
