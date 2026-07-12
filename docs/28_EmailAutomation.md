# 28 — Email Automation

## Current
Resend REST API, only for admin inquiry alerts; sender `onboarding@resend.dev` (sandbox),
recipient hardcoded. Free tier: 3,000 emails/mo — plenty.

## Blockers (owner action)
1. Verify a domain in Resend (thebedbox.in) → sender becomes `TheBedBox <hello@thebedbox.in>`
2. Put admin notification address in `settings` (SEC-03)

## Build plan
- `lib/notify.ts` email adapter (D-004): one send function, template registry, per-type
  enable/disable in settings, dry-run env flag
- Templates (light theme to match app, teal accent, mobile-first table-free HTML):
  onboarding link · welcome (portal+WiFi+rules) · rent upcoming/due/overdue · receipt (PDF
  attached) · notice ack/last-day · admin digest · payout due
- Copy voice: warm, short, bilingual-friendly; always show the ₹ breakdown and one clear CTA
- Log sends (start with console + `receipt_sent_at`-style columns; `notification_log` table later)
- Deliverability: SPF/DKIM auto via Resend domain setup; from-name consistent; no link shorteners
