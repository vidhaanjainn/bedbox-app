# 19 — Decision Log

Format: ID · Date · Decision · Why · Alternatives · Implications. Add an entry for every
architectural choice; never delete entries — supersede them.

## D-001 · 2026-07-12 · Repo-as-source-of-truth operating system
Docs folder + PROJECT_STATUS.md drive all AI-assisted work; every session reads status first,
updates it last. Alt: external tool (Notion/Linear) — rejected: context must travel with the code.
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
