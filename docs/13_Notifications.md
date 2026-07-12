# 13 — Notifications & 29 — Notification Architecture (merged)

## Channels roadmap
1. **Email (Resend)** — live for admin inquiry alerts; residents blocked on domain verification
2. **In-app** — `notifications` table + portal bell (SAAS-04 groundwork, can land in Phase 2)
3. **Push (PWA)** — web-push after portal PWA polish (UX-04); nice-to-have
4. **WhatsApp** — highest impact in India; via provider (Gupshup/Twilio/Interakt) post-revenue,
   templates pre-approved for rent reminders

## Architecture rule (D-004)
All sending goes through `lib/notify.ts`:
`notify({ to: residentId|'admin', type, subject, body, channels?: ['email','inapp'] })`
Adapters per channel; call sites never know the channel. Log every send (table `notification_log`
when in-app lands) for debugging "did the reminder go out?".

## Notification catalog (target)
| Event | To | Channel(s) |
|---|---|---|
| New inquiry | admin | email ✅ |
| Onboarding link | resident | email (today: manual WhatsApp) |
| Onboarding submitted / approved | admin / resident | email |
| Rent upcoming/due/overdue | resident | email → +whatsapp later (AUTO-02) |
| Payment recorded + receipt | resident | email w/ PDF (AUTO-05) |
| Notice submitted / last-day nearing | admin+resident | email (AUTO-06) |
| Maintenance status change | resident | in-app/email |
| Staff payout due, monthly digest | admin | email (STAFF-01, AUTO-07) |
| Announcement | residents | in-app (+email optional) |
