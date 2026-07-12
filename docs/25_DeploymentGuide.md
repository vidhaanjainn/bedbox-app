# 25 — Deployment & 26 — Supabase Guide (merged)

## Deploy (Vercel)
- Prod: `bedbox-app-alpha.vercel.app`; push to `main` = deploy (verify branch in Vercel settings)
- Env vars: see table in 20_AIExecutionGuide.md — set in Vercel AND .env.local
- After deploy: run relevant 16_QA_Checklist.md section against prod
- Rollback: Vercel dashboard → previous deployment → promote

## Supabase operations
- DDL source of truth: `SUPABASE_SETUP.sql` (root; OPS-01 moves to `supabase/`); new changes as
  numbered migration files, applied via SQL editor or Supabase MCP, committed with the code
- Buckets: `resident-docs`, `private-docs` — must stay PRIVATE; access via signed URLs only
- Auth config: Site URL + redirect `https://bedbox-app-alpha.vercel.app/**`; OTP email template
  for resident portal login; admin user must match admin identity (SEC-03 generalizes this)
- Backups: free tier has limited PITR — before risky migrations, export affected tables to CSV
  (dashboard) or `pg_dump`. KYC images: periodically download bucket archive until paid tier.
- Never run destructive SQL against prod without a backup + a decision-log entry.
