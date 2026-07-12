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
SEC-01 + SEC-02 (code): secure onboarding API (`/api/onboard/[token]`, service role, token
validated server-side, field whitelist, signed upload URLs) built, tested, deployed to prod
(commit d410150c). Migration `supabase/migrations/20260712_sec01_secure_onboarding.sql` is
written but **NOT YET APPLIED** — see Blocked By.

## Next Recommended Task
1. OWNER: restore Supabase + run the SEC-01 migration (see Blocked By below)
2. Then AI: verify anon access is closed (curl check in 18_ImplementationLog.md), mark SEC-01/02 ✅
3. Then: DATA-01 → DATA-02 → SEC-03 → OPS-01 → AUTO-01 (see backlog)

## Blocked By (OWNER ACTIONS NEEDED)
- **🔴 CRITICAL: production Supabase project is unreachable.** The app (prod + .env.local) points
  at `nbhmjqkhpdpdxkkzfgca.supabase.co`, which no longer resolves (NXDOMAIN) — the project is
  paused (free-tier inactivity) or deleted, in a Supabase account NOT connected to this session's
  MCP. Every DB-backed feature in production is currently failing. Owner: log into that Supabase
  account → restore/unpause the project (or migrate to a live project and update Vercel envs).
- **SEC-01 migration pending:** after restoring, paste
  `supabase/migrations/20260712_sec01_secure_onboarding.sql` into the Supabase SQL editor and run
  it (app code is already deployed, so this is safe and closes the P0 holes).
- Resend: sending from `onboarding@resend.dev` (sandbox). Verify domain (e.g. thebedbox.in) to
  unlock resident-facing emails (AUTO-02/05).
- Google Sheets sync needs `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`,
  `GOOGLE_SHEET_ID` in Vercel env.

## High Priority Bugs / Risks
1. (P0) Production DB unreachable — see Blocked By (owner)
2. (P0→pending migration) RLS: anon could read/update residents with live onboard tokens; code
   fix deployed, policies dropped only once the migration runs — 12_Security.md §1–2
3. (P1) Schema drift: `lib/types.ts` describes tables/columns that don't exist (Property, Admin,
   Notification, property_id everywhere) — 22_KnownIssues.md
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
