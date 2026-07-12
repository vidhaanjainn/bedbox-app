# 16 — QA Checklist

Run the relevant section after every task; run ALL before any "release" (sharing link with new people).

## Always
- [ ] `npm run build` passes, no new type errors
- [ ] Feature verified in browser (mobile viewport for portal/onboarding/book pages)
- [ ] No secrets in client code; no new `NEXT_PUBLIC_` sensitive vars

## Security regression (after any schema/API change)
- [ ] Anon client cannot select/update `residents` (post SEC-01)
- [ ] Anon cannot upload to storage directly (post SEC-02)
- [ ] Resident A cannot read resident B's rows (spot-check rent_payments)
- [ ] Cron routes 401 without CRON_SECRET

## Core flows smoke test
- [ ] /book submits → row in bookings + admin email
- [ ] Onboarding link: valid completes; used/expired rejected politely
- [ ] Approve → portal OTP login works → home shows correct rent
- [ ] Record payment → status/amounts correct → receipt generates
- [ ] Notice + maintenance submit from portal, visible in admin
- [ ] Dashboard numbers match reality after the change

## UX pass (per UX task)
- [ ] Empty, loading, error states present
- [ ] Toasts on every mutation; destructive actions confirm
- [ ] 44px touch targets; no horizontal scroll on 375px
