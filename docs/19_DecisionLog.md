# 19 - Decision Log

Format: ID · Date · Decision · Why · Alternatives · Implications. Add an entry for every
architectural choice; never delete entries - supersede them.

## D-001 · 2026-07-12 · Repo-as-source-of-truth operating system
Docs folder + PROJECT_STATUS.md drive all AI-assisted work; every session reads status first,
updates it last. Alt: external tool (Notion/Linear) - rejected: context must travel with the code.
Implication: docs discipline is part of Definition of Done.

## D-002 · 2026-07-12 · Harden RLS + server routes for privileged flows (keep client-heavy pages)
Alt considered: move ALL data access behind API routes (more control, more code) or trust RLS
alone (current, broken for onboarding). Chosen middle path: RLS for authenticated read paths,
service-role API routes for anon/privileged mutations (onboarding, approvals, crons).
Revisit at SAAS-01 (may introduce a data-access layer then).

## D-003 · 2026-07-12 · Brand: light teal (#00d4c8) on warm neutrals
Per owner preference + existing email accent. Crib/Stripe/Linear interaction patterns, original
visual identity. Dark navy reserved for email/marketing.

## D-004 · 2026-07-12 · Email via Resend; notifications behind an abstraction later
Resend already integrated. Push/WhatsApp deferred; AUTO tasks write to a thin `lib/notify.ts`
so channels can be added without touching call sites (formalized in SAAS-04).

## D-005 · 2026-07-12 · Google Sheets is a mirror, never a source
One-way push on data change (AUTO-04). Two-way sync rejected: conflict hell, and Supabase must
stay authoritative for RLS-protected data.

## D-006 · 2026-07-12 · Phase order: security → automation → resident value → ops → SaaS
Rationale: real residents' Aadhaar data is at stake (P0), automations deliver the owner's biggest
pain relief per hour of work, SaaS scaffolding too early would slow everything.

## D-007 · 2026-10-28 · Stay on Supabase; harden the client instead of migrating (e.g. to Neon)
The 2026-10-28 outage was Supabase's free Nano instance stalling (see 18_ImplementationLog), not region or code alone. Migrating to Neon was rejected: it is Postgres only - Auth, Storage and RLS-through-API (29+ files, real Aadhaar documents) would need rewriting mid-incident. Instead: resilient client (lib/supabase/net.ts), same-origin fallback route, health endpoint + uptime monitor, regression test `scripts/resilience-check.cjs` (needs Playwright; no test framework added to package.json). Owner cannot pay, so no paid plan: free mitigations only (restart, self-healing client, monitoring); free nightly backup still to build. Measured 2026-10-28: dashboard queries take 5-20ms on 22 residents/34 rent rows - the app is not the load, so RLS policy rewrites for speed were rejected (risk, no gain).
