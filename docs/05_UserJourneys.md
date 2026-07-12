# 05 — User Journeys

## J1: Inquiry → Resident (the money journey)
1. Prospect finds /book link (Instagram bio, Google Maps) → submits inquiry
   → saved to `bookings` (inquiry) + Sheets + admin email ✅ works
2. Admin calls, finalises price/bed → status `booked`, token amount + screenshot logged ✅
3. Admin sends onboarding link → `onboarding_sent`; resident opens /onboard/[token] on phone:
   personal details → emergency contact → Aadhaar front/back upload → agreement + consent ✅
   ⚠ P0 security holes in this step (SEC-01/02); ⚠ no auto-email of the link (manual WhatsApp today)
4. Admin approves → resident `active`, portal user created, bed occupied ✅
   ⚠ should trigger welcome email w/ portal link + WiFi + house rules (Phase 2)
5. Monthly: rent row → reminder → payment → receipt ⚠ reminders/receipt emails not automated (AUTO-02/03/05)
6. Move-out: notice via portal ✅ → checklist/deposit settlement ✖ missing (RES-06) → archive ✅

## J2: Resident daily life (portal)
Login (email OTP) → home: rent status, quick actions ✅ thin — target: WiFi card, announcements,
nearby directory, documents (RES-01..05). Complaint → maintenance ticket ✅. Receipt request ✅.

## J3: Landlord daily/monthly ops
Today: open dashboard → see occupancy/pending ✅ but no unified "needs action today" list (UX-03).
Monthly: enter electricity readings ✅ → generate rent rows ⚠ manual (AUTO-03) → chase payments
⚠ manual (AUTO-02) → mark paid + screenshot ✅ → receipts ⚠ manual (AUTO-05) → expenses/staff
payouts ✖ nowhere to record (STAFF-01, EXP-01).

## J4: Short-stay guest
Admin creates short stay w/ KYC + daily rate → checkout + payment status ✅ (admin-only; fine for now).

Legend: ✅ works · ⚠ works but manual/unsafe · ✖ missing
