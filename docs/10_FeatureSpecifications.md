# 10 — Feature Specifications

Deep specs live next to their tasks; this file holds specs too big for a backlog entry.
Currently specified inline in 03_MasterBacklog.md. Expand here when a task needs >1 screen of
spec (write the spec BEFORE coding the task, then link it from the backlog entry).

## Spec template
**Problem · Current implementation · Ideal implementation · Why it matters · Tradeoffs ·
Recommended solution · Future improvements · Priority · Dependencies · Estimated effort ·
Acceptance criteria**

## SPEC-SEC-01 — Secure self-onboarding (summary; details in 12_Security.md §1–2)
- Problem: anon RLS policies expose/permit-overwrite of resident PII rows and open bucket uploads
- Ideal: token validated server-side; GET returns whitelist (name, room_number, rent_amount,
  property policies); POST accepts whitelist (personal details, emergency contact, doc paths,
  agreement acceptance) + captures IP + marks token used atomically; uploads via signed URLs
- Acceptance: see backlog SEC-01/02; plus: replaying a used token → 410; expired → 410 with
  "ask admin for a new link" copy; wizard UX unchanged or better

## SPEC-AUTO-02 — Rent reminder engine (summary)
- Due day = day-of-month of `date_of_joining` (clamped to month length). T-3 "upcoming", T0 "due
  today", T+3/T+6/T+9 overdue (max 4), stop when status=paid. Track `last_reminded_at`,
  `reminder_count` on rent_payments. Copy: warm, includes breakdown (rent+electricity+late fee −
  paid), UPI id + QR from settings, portal link. `REMINDERS_DRY_RUN=1` env logs instead of sends.
