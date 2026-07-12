# 11 — Monetization

## Stage 0 (now): the app IS the monetization
Bedbox saves TheBedBox admin hours and prevents leakage (missed rent, forgotten late fees,
untracked expenses). Ship Phases 0–3 before selling anything.

## SaaS pricing models (Phase 4)
| Model | Pros | Cons | Verdict |
|---|---|---|---|
| **Per bed / month (₹20–40/bed)** | Scales with customer value; tiny PGs pay tiny; easy mental math | Needs bed-count honesty; low ACV per small PG | **Primary.** India PG market standard-friendly |
| Per property flat (₹499–1,999/mo) | Predictable | Punishes small, undercharges large | Use as tier caps on per-bed |
| Freemium (≤10 beds free) | Distribution engine, word of mouth | Support cost; conversion discipline needed | **Yes** — free tier = acquisition |
| Transaction fee on rent (0.5–1%) | Revenue scales with GMV; landlords accept if collection improves | Needs gateway + trust; UPI P2P is free competition | **Layer later** via Razorpay collection links (SAAS-03) |
| White label / Enterprise | High ACV (co-living chains) | Custom work distraction | Only inbound, post PMF |

**Recommended ladder:** Free (≤10 beds, Bedbox branding) → Growth ₹29/bed/mo (automations,
Sheets sync, receipts) → Pro ₹49/bed/mo (staff+expenses, analytics, WhatsApp, multi-property)
→ +0.5% optional on gateway-collected rent.

## Adjacent revenue (post-PMF, Phase 4+)
- **Vendor marketplace** (laundry, food, cleaning, internet, movers): listing fee or commission —
  natural fit since the resident directory (RES-02) already exists
- **Background/KYC verification** as paid add-on per resident
- **Insurance & deposits** (deposit-free move-in partners), **rental agreements** e-stamp partners
- **Payments float/FinOps** and lending referrals — regulated, much later
- AI features (rent pricing suggestions, occupancy forecasting) as Pro differentiators

## Payment integration plan
Razorpay (India-first): Payment Links for rent (no PCI burden) → auto-reconcile webhook →
receipt automation already built (AUTO-05). Subscriptions via Razorpay Subscriptions for SaaS
billing. Keep gateway behind an interface so PhonePe/Setu can swap in.

## Unit economics guardrail
Infra stays ~₹0 on free tiers until ~thousands of users; Resend free 3k emails/mo covers ≈100
residents' reminders. First real cost = custom domain + Resend paid tier — trigger only at revenue.
