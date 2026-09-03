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
✅ **App is operational.** Owner updated Vercel prod env vars, AI triggered redeploy, verified live:
client bundle now bakes in the correct Supabase URL, `/api/onboard/[token]`, `/admin/dashboard`,
`/portal` all respond correctly against the real database.

✅ **AUTO-01/02/03 built:** `lib/notify.ts` (central email + WhatsApp-ready sender),
`app/api/cron/daily/route.ts` (auto-creates this month's rent row per active resident +
sends tiered rent reminder emails: T-3, due day, then every 3 days overdue, max 4), wired into
`vercel.json` (daily cron, Hobby-plan compatible). Code builds clean. **Not yet verified live** —
needs `CRON_SECRET` set in Vercel first (see Blocked By) before it can be triggered/tested.

Next up: owner sets 3 new env vars (below) → AI verifies the cron end-to-end → DATA-01 schema
re-audit → WhatsApp (needs owner to complete Meta Business setup first, see 13_Notifications.md).

## Blocked By (OWNER ACTIONS NEEDED) — round 2
- **Add to Vercel (Production) env vars:**
  - `CRON_SECRET` = `c0ea58ff11090174d90a4a7bb9347e415a1ee9302bdaa0a3` (generated 2026-09-03; this
    protects the cron endpoint from being triggered by randoms — Vercel automatically sends it
    as `Authorization: Bearer <value>` when it fires the cron)
  - `REMINDERS_DRY_RUN` = `1` **to start** (logs what it would send instead of sending — flip to
    unset/`0` once you've watched a dry run in the logs and I've confirmed it looks right)
  - `ADMIN_NOTIFY_EMAIL` = your preferred inbox for booking/onboarding alerts (optional — defaults
    to `thebedbox.in@gmail.com` if unset)
- **Resend domain verification (for reminders/receipts to send from your own domain instead of
  the sandbox):** a domain `thebedbox.in` was added to your Resend account
  (id `07bcca76-7d0f-4d17-8013-1e7635aee1bd`). Add these 3 DNS records wherever `thebedbox.in`'s
  DNS is managed (your domain registrar, or Vercel → Domains if it's there):
  | Type | Name | Value | Priority |
  |---|---|---|---|
  | TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDYU2QqwOUjAY9gT5V7Hm7Vu1aUvIhDEFoJa8N7QIrfPiHB9YuTS5AiJMFH5MXX+JuIAxvvzRvqFKcbcBryNw/MIsc/MEHBjLMACHbCUDHnFitwUTG+R9ZRWk01PjPWeNor27F91KRVG/up3JOuQJrN8gnDw9hrGTPOMUTBNfWEtQIDAQAB` | — |
  | MX | `send` | `feedback-smtp.ap-northeast-1.amazonses.com` | 10 |
  | TXT | `send` | `v=spf1 include:amazonses.com ~all` | — |
  DNS can take up to 24-48h to propagate (usually much faster). Once verified in Resend, add
  `RESEND_FROM_EMAIL` = `TheBedBox <hello@thebedbox.in>` to Vercel env — until then everything
  keeps working via the sandbox sender (non-fatal fallback already coded in).
- **WhatsApp (free via Meta's own WhatsApp Cloud API — no third-party fees):** this needs YOU to
  create a Meta Business account + WhatsApp Business Platform app and verify a phone number —
  this is identity/business verification Meta requires directly from the account owner and cannot
  be done by an AI session. Full walkthrough in 13_Notifications.md. Once you have
  `WHATSAPP_ACCESS_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID`, the code in `lib/notify.ts` is already
  written to use them — just add the env vars and it activates.

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
