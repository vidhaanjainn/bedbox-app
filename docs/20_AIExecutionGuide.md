# 20 — AI Execution Guide

**Any AI model resuming work: read this + PROJECT_STATUS.md first. Then pick the Next
Recommended Task from PROJECT_STATUS.md and execute it fully.**

## The loop
1. Read `docs/PROJECT_STATUS.md` → find "Next Recommended Task"
2. Read that task's entry in `docs/03_MasterBacklog.md` (+ any doc it references)
3. Implement in small steps; keep the app deployable at all times
4. Verify against the task's test/acceptance criteria; run `npm run build`
5. Update: backlog (✅ + date), `18_ImplementationLog.md` (what/why/files), `21_Changelog.md`,
   `19_DecisionLog.md` (if an architectural choice was made), and `PROJECT_STATUS.md`
   (progress %, last completed, NEW next recommended task)
6. Commit with a clear message. Never bundle unrelated tasks in one commit.

## Project conventions
- **This repo uses a NEWER Next.js than your training data** (16.x). Per AGENTS.md: read
  `node_modules/next/dist/docs/` before writing Next.js-specific code. Heed deprecations.
- App Router, mostly client components with direct Supabase queries; new privileged logic goes
  in `app/api/*` route handlers using the service-role key with strict input validation
- Styling: Tailwind 4 utility classes; teal brand (#00d4c8 family); reusable pieces go in
  `components/ui/` (create it — UX-02)
- Types: `lib/types.ts` must mirror the LIVE Supabase schema (regenerate, don't hand-edit lies)
- Schema changes: write a migration SQL file under `supabase/` (create dir), also apply via
  Supabase MCP/dashboard; every new table gets RLS (admin-all + resident-own patterns)
- Secrets: server-only env vars never `NEXT_PUBLIC_`; cron routes check `CRON_SECRET`
- Email: all sending through Resend; sender must move off `onboarding@resend.dev` once the
  domain is verified (check PROJECT_STATUS "Blocked By")
- Currency ₹, timezone Asia/Kolkata, phone = 10-digit Indian mobiles
- No test framework exists; verification = manual flow + build. Don't add heavy test infra
  without a decision log entry.

## Environment variables (Vercel + .env.local)
| Var | Purpose |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY | client Supabase |
| SUPABASE_SERVICE_ROLE_KEY | server routes (RLS bypass — validate inputs!) |
| RESEND_API_KEY | email |
| GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY / GOOGLE_SHEET_ID | Sheets sync |
| CRON_SECRET | (to add in AUTO-01) protect cron routes |

## Guardrails
- Never weaken RLS to "make it work"; fix at the API layer instead
- Never expose Aadhaar/document URLs publicly; signed URLs only
- Don't refactor broadly while doing a feature task — log the idea in 17_FutureIdeas.md instead
- If blocked (missing env, needs owner action), record it under "Blocked By" in PROJECT_STATUS.md
  and pick the next unblocked task
