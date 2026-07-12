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
DOC-01: Full repo audit + documentation system installed (this docs folder).

## Next Recommended Task
**SEC-01 — Fix onboarding RLS policies (P0, security).** See 03_MasterBacklog.md and 12_Security.md.
The current `onboard_token_select` / `allow_onboard_token_update` policies let ANY anonymous
visitor read and overwrite ANY resident row that has an outstanding onboarding token. Fix before
sharing the app more widely.

After SEC-01, execute in order: SEC-02 → DATA-01 → AUTO-01 → UX-01 (see backlog).

## Blocked By
- Resend: sending from `onboarding@resend.dev` (sandbox). Need a verified domain (e.g. thebedbox.in)
  before resident-facing emails (reminders, receipts) can ship. Owner action: verify domain in Resend.
- Google Sheets sync beyond the booking form needs `GOOGLE_SERVICE_ACCOUNT_EMAIL`,
  `GOOGLE_PRIVATE_KEY`, `GOOGLE_SHEET_ID` set in Vercel env.

## High Priority Bugs / Risks
1. (P0) RLS: anon can read/update any resident with a live onboard token — 12_Security.md §1
2. (P0) RLS: anyone can upload unlimited files to `resident-docs` bucket — 12_Security.md §2
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
