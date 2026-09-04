# 30 — Legal & Compliance (India)

Not legal advice — a working checklist; get a lawyer's review before SaaS launch.

## KYC / Aadhaar (DPDP Act 2023 posture)
- Collect Aadhaar images with **explicit, logged consent** (onboarding already logs agreement
  timestamp + IP; add a distinct KYC-consent checkbox with purpose text — fold into SEC-01 UI)
- Store privately (done), serve via short-lived signed URLs to admin only (SEC-02)
- **Retention policy**: delete/anonymize KYC docs N months after move-out (default 6; make it a
  setting + monthly cron cleanup) — add as backlog item when Phase 1 lands
- Resident rights: on request, show what's stored (RES-05 documents vault helps) and delete
- Never put Aadhaar numbers in Sheets, emails, or logs — images stay in storage only

## Agreements — STATUS: functional and reasonably solid as of 2026-09-03
The full digital onboarding → agreement sign-up flow already exists and works:
1. Resident opens a token-linked wizard (`/onboard/[token]`, secured server-side — SEC-01)
2. Fills personal + emergency contact details, uploads Aadhaar front/back (signed upload URLs —
   SEC-02, stored in a private bucket, never public)
3. Reads all clauses (currently 28, covering rent/deposit/notice/conduct/liability/jurisdiction)
   and explicitly checks a box naming them by name before submitting
4. Server captures `agreement_signed_at` (timestamp), `agreement_ip` (from request headers,
   spoofing-resistant since it's read server-side not client-supplied), and — as of 2026-09-03 —
   `agreement_version` (a version tag baked into the onboarding page, bumped whenever the clause
   text changes, so a resident's proof-of-consent always reflects the exact terms shown to them
   even after the text is edited later)
5. Admin reviews + approves before the resident's status flips to `active`

This is reasonable click-wrap evidence under India's IT Act 2000 (electronic record + explicit
consent + audit trail). **Not yet done, lower priority:** a downloadable PDF of the signed
agreement (clause text + resident details + signature metadata) for the resident's own records —
today the clauses only exist as a hardcoded array in the onboarding page, not a document either
party can retrieve later. Worth building once other automations are stable (uses the jsPDF
already in the project).
- 60-day notice rule encoded in notice_periods — must match the written agreement text
- Rent receipts: include property name/address, resident name, period, amount, mode — current
  jsPDF receipt should be checked against this list (AUTO-05)

## Other
- Short-stay guests: local police verification norms for lodging vary by state — keep KYC copies
- GST: not applicable below threshold; revisit at SaaS revenue
- SaaS stage: privacy policy + ToS pages, data-processing terms for landlords (their residents'
  data), breach notification plan
