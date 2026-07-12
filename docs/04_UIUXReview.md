# 04 — UI/UX Review & Redesign Direction

## Verdict
Functional MVP UI, built page-by-page without a shared system. To reach "Stripe-level polish"
we need tokens + shared components first (UX-01/02), then per-screen passes. Do NOT restyle
screens ad hoc before the token layer exists — that's how inconsistency happened.

## Brand direction (D-003)
- **Primary: teal** `#00d4c8` (already used in emails) with a light, airy app theme:
  backgrounds warm white `#fafaf9`, cards white, ink `#0f172a`, muted `#64748b`
- Dark navy (`#070d1a`) stays for email/marketing accents, not the app shell
- Typography: Geist (already loaded). Scale: 24/18/15/13. Numbers (₹) always tabular-nums
- Radius 12–16px cards, 8px controls; shadows subtle (y=1 blur=2 + y=4 blur=12 @ 6%)
- Status colors: paid=teal/green, partial=amber, pending/overdue=rose, neutral=slate

## Borrowed interaction patterns (patterns only, never branding)
- **Crib**: resident home hub as card stack (rent status card on top → quick actions grid);
  onboarding as chat-like single-question steps
- **Stripe Dashboard**: KPI row with sparkline + delta; everything drill-downable
- **Linear**: command-K search everything (Phase 3); keyboard-fast tables; crisp empty states
- **Airbnb**: photo-forward room cards; trust signals (verified badge post-KYC)
- **Notion**: settings as editable content blocks (house rules as markdown)

## Heuristic findings (apply during UX tasks)
1. **Hierarchy**: admin dashboard should answer, in order: money collected/pending this month →
   occupancy → what needs my action today (approvals, overdue, maintenance, move-outs). Action
   items deserve a dedicated "Today" list, not scattered stat cards.
2. **States**: most tables lack empty/loading/error states → add EmptyState + Skeleton everywhere
   (UX-05). Every destructive action needs ConfirmDialog with consequence copy.
3. **Mobile**: admin is desk-usable but portal must be thumb-first — bottom tab bar (Home,
   Payments, Help, Profile), 44px+ targets, sticky primary CTA (UX-04).
4. **Forms**: residents/new is a 570-line monolith — chunk into sections with progress, inline
   validation on blur, Indian formats (10-digit mobile auto-format, ₹ prefixed amounts).
5. **Feedback**: use the Radix toast consistently for every mutation (success + failure copy).
6. **Trust & delight**: onboarding success screen ("You're in! Room 204 🎉" + portal button);
   receipts that look like real documents; friendly reminder copy, never scolding.
7. **Consistency**: one StatusBadge component mapping every status enum → color/label; today each
   page invents its own.

## Execution order
UX-01 tokens → UX-02 components → UX-03 dashboard → UX-06 onboarding → UX-04 portal mobile → UX-05 states sweep.
Acceptance for the track: any two screens shown side-by-side look like the same product.
