# 14 — Payment Flows

## Current (manual, works)
1. Rent row exists for month (manual creation today → AUTO-03)
2. Resident pays via UPI/bank/cash outside the app
3. Admin records amount, mode, screenshot → status pending/partial/paid (+late fee field)
4. Receipt: resident requests → admin generates jsPDF → marks sent (→ AUTO-05 automates)
Deposits: `security_deposit` on resident; refund tracking missing → `deposit_settlements` (RES-06).

## Target end-state (SAAS-03)
Reminder email/WhatsApp contains **Razorpay Payment Link** for exact outstanding amount →
resident pays → webhook (signature-verified) marks paid + triggers receipt automatically →
admin only handles cash edge cases. Late fee auto-applied after grace day (setting), visible to
resident before it hits — no surprise fees.

## Invariants
- `total_amount = rent + electricity + late_fee`; `status` derived from `amount_paid` vs total —
  compute in one helper (`lib/rent.ts`), never per-page
- Money is NUMERIC in DB; format with a single MoneyText component (₹, Indian digit grouping)
- Every state change that touches money must be visible in payment history (audit trail)
