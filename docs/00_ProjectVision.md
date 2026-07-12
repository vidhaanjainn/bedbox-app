# 00 — Project Vision

## One-liner
**Bedbox is the operating system for Indian rental living** — starting as the app that runs
TheBedBox (Bhopal PG), growing into SaaS any PG/hostel/co-living/Airbnb operator can run their
property on.

## The problem (India-specific)
Landlords run their business on WhatsApp + notebooks + memory: chasing rent, photographing
Aadhaar cards, guessing occupancy, forgetting staff payouts, retyping data into sheets. Residents
get zero product experience: no receipts, no visibility, awkward rent conversations.

## What winning looks like
- **For the landlord (Vidhaan today):** open one dashboard and know money in, money pending,
  money out, who's moving in/out, what's broken — and the app chases rent, syncs the sheet, and
  emails receipts *by itself*. Admin time on ops drops from hours/week to minutes.
- **For residents:** onboard fully from their phone in 5 minutes (KYC, agreement, consent),
  then use the portal for WiFi, rent status, receipts, complaints, notice — never needing to
  ask the landlord basic questions.
- **For the future SaaS customer:** sign up, add property + rooms, share one booking link, done.

## Users we design for (in priority order)
1. Owner-operator landlord (non-technical, mobile-first, WhatsApp-native)
2. Resident (student/young professional, expects app-grade UX)
3. Staff/manager (task-level access) — Phase 3+
4. Multi-property operator / co-living startup — Phase 4 (SaaS)

## Product principles
1. **Automate the chase.** Every reminder a landlord sends manually is a bug.
2. **One source of truth** (Supabase), mirrored outward (Sheets) — never the reverse.
3. **Trust by design.** KYC handled with bank-grade care; consent explicit; receipts always.
4. **Premium-minimal UI** (Stripe-level polish, Crib-inspired patterns, our teal identity).
5. **Every milestone ships.** Small, deployable, reversible changes.
6. **Zero marginal cost** until revenue: Vercel free tier, Supabase free tier, Resend free tier.

## Where this becomes a business
Prove it on TheBedBox → package as SaaS (per-bed pricing sweet spot for India) → layer payments
(Razorpay rent collection = transaction revenue) → marketplace (vendors, laundry, food, internet).
Full analysis: 11_Monetization.md, 23_SaaSRoadmap.md.
