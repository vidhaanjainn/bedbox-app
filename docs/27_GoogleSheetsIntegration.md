# 27 — Google Sheets Integration

## Current
Only `/api/booking-form` appends inquiries to Sheet `1Nz1…FAs` (hardcoded fallback,
`Sheet1!A:K`: Name|Phone1|Phone2|Email|RoomType|Institution|Course|Duration|Hometown|Message|
SubmittedAt) via service-account JWT. Skips silently if `GOOGLE_SERVICE_ACCOUNT_EMAIL` /
`GOOGLE_PRIVATE_KEY` unset. Non-fatal by design (Supabase is source of truth, D-005).

## Target (AUTO-04)
- Extract `lib/sheets.ts` (auth + append + upsert-by-key helpers); env-only sheet id (drop hardcode)
- New "Residents" tab, one row per resident keyed by resident UUID (col A), upserted on
  create/approve/edit/archive: Name, Phone, Email, Room, Property, Rent, Deposit, Move-in,
  Move-out, Status, Payment status (current month), Notice?, Docs complete?, Updated at
- Later tabs: Payments (monthly), Expenses — read-only mirrors for the owner's comfort
- Never read decisions back from Sheets; it's a view, not an input

## Setup (owner, once)
Google Cloud → service account → enable Sheets API → share the sheet with the service-account
email as Editor → set the three env vars in Vercel (private key with literal \n escapes).
