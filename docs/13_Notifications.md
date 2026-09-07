# 13 - Notifications & 29 - Notification Architecture (merged)

## Channels roadmap
1. **Email (Resend)** - live for admin inquiry alerts; residents blocked on domain verification
2. **In-app** - `notifications` table + portal bell (SAAS-04 groundwork, can land in Phase 2)
3. **Push (PWA)** - web-push after portal PWA polish (UX-04); nice-to-have
4. **WhatsApp** - highest impact in India; via provider (Gupshup/Twilio/Interakt) post-revenue,
   templates pre-approved for rent reminders

## Architecture rule (D-004)
All sending goes through `lib/notify.ts` - ✅ built 2026-09-03: `sendEmail()` (Resend) and
`sendWhatsApp()` (Meta Cloud API, no-ops until configured). Adapters per channel; call sites never
know the channel. Log every send (table `notification_log` when in-app lands) for debugging "did
the reminder go out?".

## WhatsApp setup (free, owner action required - cannot be done by an AI session)
Meta's WhatsApp Cloud API itself has no Anthropic/Vercel/AI-session path to provision - it
requires YOUR business identity. One-time setup (~20-30 min):
1. Go to business.facebook.com → create a Meta Business Account (if you don't have one)
2. Go to developers.facebook.com → create an App → add the "WhatsApp" product
3. In the WhatsApp product setup, either use the free test number Meta provides (can only message
   a handful of pre-verified test recipients - fine for trying it out) or add your own business
   phone number and verify it via OTP
4. Create a message **template** (e.g. `rent_reminder`) in the WhatsApp Manager and submit for
   approval (templates are required for any business-initiated message outside a 24h customer
   service window; approval is usually minutes to a few hours)
5. Copy the **Temporary/Permanent Access Token** and **Phone Number ID** from the app dashboard
6. Add to Vercel env: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` - `lib/notify.ts`'s
   `sendWhatsApp()` is already wired to use them the moment they exist, no code change needed
Cost: Meta's own India pricing has a free tier of service/utility conversations per month before
any per-conversation charge kicks in - check current rates in WhatsApp Manager since Meta changes
these; for TheBedBox's resident volume this should stay free or near-free indefinitely.

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
