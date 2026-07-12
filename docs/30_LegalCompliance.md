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

## Agreements
- Onboarding acceptance (checkbox + timestamp + IP) is reasonable click-wrap evidence; keep the
  agreement text versioned in settings so we know WHICH terms were accepted (add version key)
- 60-day notice rule encoded in notice_periods — must match the written agreement text
- Rent receipts: include property name/address, resident name, period, amount, mode — current
  jsPDF receipt should be checked against this list (AUTO-05)

## Other
- Short-stay guests: local police verification norms for lodging vary by state — keep KYC copies
- GST: not applicable below threshold; revisit at SaaS revenue
- SaaS stage: privacy policy + ToS pages, data-processing terms for landlords (their residents'
  data), breach notification plan
