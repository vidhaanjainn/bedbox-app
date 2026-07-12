# 23 — SaaS Roadmap & 24 — Multi-Property Vision (merged)

**Gate: do not start until Phases 0–3 are complete and TheBedBox runs hands-off for a month.**
That month of hands-off operation IS the pitch.

## Multi-tenancy plan (SAAS-01/02)
1. `properties` table (name, address, settings jsonb, owner user_id)
2. Add `property_id` to rooms/residents/payments/expenses/staff/etc. (backfill = TheBedBox)
3. `memberships` (user_id, property_id, role: owner|manager|staff) replaces email `is_admin()`
4. RLS: `property_id IN (select property_id from memberships where user_id = auth.uid())`
5. Property switcher in admin shell; settings become per-property

## Supported property types (same schema, different presets)
PG/hostel (beds per room, monthly) · co-living (rooms, amenities-heavy) · rental apartments
(unit = room w/ 1 "bed") · Airbnb/short-term (short_stays becomes first-class w/ calendar).
Presets = seed settings + enabled modules, not code forks.

## Landlord onboarding funnel
Sign up → create property → add rooms/beds (CSV or quick-add grid) → import residents (CSV) →
share /book link → first automated reminder sent = activation moment. Target: <30 min to value.

## GTM sequence
1. Case study: TheBedBox numbers (hours saved, collection %)
2. 10 Bhopal/Indore PG owners hand-onboarded free (feedback loop)
3. Free ≤10 beds tier public; pricing per 11_Monetization.md
4. Distribution: PG-owner WhatsApp groups, broker networks, Google "PG management software India" SEO
