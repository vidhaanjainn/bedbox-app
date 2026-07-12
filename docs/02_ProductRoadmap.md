# 02 — Product Roadmap

Principle: tiny, independently deployable milestones. The app must stay working after every task.
Task IDs reference 03_MasterBacklog.md.

## Phase 0 — Foundation Hardening (do first, ~1 week of sessions)
Goal: safe to hand to real residents. No new features until this is done.
- SEC-01 Onboarding via server routes; drop unsafe RLS policies (P0)
- SEC-02 Signed upload URLs for KYC docs; kill anon bucket writes (P0)
- DATA-01 Regenerate lib/types.ts from live schema; delete fantasy types
- DATA-02 Consolidate duplicate resident columns; single onboarding path + bucket
- SEC-03 `admins` table + settings-driven admin email
- OPS-01 Repo hygiene: README rewrite, .gitignore (.DS_Store, tsbuildinfo, .next), commit SQL migrations properly

## Phase 1 — Automation Engine (the "it just does the work" phase)
- AUTO-01 Vercel Cron + `/api/cron/*` scaffold with shared secret
- AUTO-02 Rent reminder emails (upcoming 3 days before due, overdue nudges) via Resend
  ⚠ blocked by domain verification in Resend
- AUTO-03 Auto-generate monthly rent_payments rows on the 1st (rent + carried electricity)
- AUTO-04 Google Sheets two-way-ish sync: push resident row on create/update/status change
- AUTO-05 Receipt auto-email on payment marked paid (jsPDF → Resend attachment)
- AUTO-06 Notice-period and contract-expiry reminders (admin + resident)
- AUTO-07 Monthly digest to admin: occupancy, collected vs pending, expenses

## Phase 2 — Resident Delight (portal becomes genuinely useful)
- RES-01 Home hub: WiFi password card, house rules, property contacts (settings-driven)
- RES-02 Nearby & essentials directory (restaurants/grocery/pharmacy/hospital/transport) + vendors
- RES-03 Announcements (admin posts → portal feed)
- RES-04 Payment history + downloadable receipts, outstanding balance banner
- RES-05 Documents vault (agreement PDF, receipts) + profile self-view
- RES-06 Move-out workflow (notice → checklist → deposit settlement)
- UX-01→UX-06 design-system pass (see 04_UIUXReview.md)

## Phase 3 — Landlord Ops (staff, money, insight)
- STAFF-01 Staff table + salaries, payouts (pending/done/advance), payout reminders
- EXP-01 Expense tracking (maintenance/vendor/monthly categories) + monthly totals
- FIN-01 Cash-flow view: income vs expenses vs pending, collection efficiency
- RPT-01 Report exports (CSV/PDF), analytics upgrades (churn, avg stay, vacancy days)

## Phase 4 — SaaS Foundation (only after 0–3 are solid)
- SAAS-01 `properties` table + property_id on all tables + RLS by membership
- SAAS-02 Multi-admin/roles, onboarding for new landlords, per-property settings
- SAAS-03 Payment gateway (Razorpay) for rent collection + subscription billing
- SAAS-04 WhatsApp notifications (architecture ready via notification abstraction in Phase 1)
See 23_SaaSRoadmap.md and 11_Monetization.md.

## Explicit non-goals for now
Native mobile apps (PWA is enough), attendance hardware, accounting-grade ledgers,
building our own chat. Revisit post Phase 3.
