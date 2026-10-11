# 21 - Changelog

## [Unreleased]
### Added
- 2026-10-11 - Fix: onboarding uploads are compressed, retried, have a server fallback, skip already-uploaded files on retry, and typed answers survive a reload
- 2026-10-11 - Vacated residents separated (Past residents tab, close-out with hide); one shared rule for counts; duplicate invoices never counted
- 2026-10-10 - Old Dues tab; cash received includes old-due payments; dashboard/tracker use one definition of pending
- 2026-10-11 - Fix: removed 14 duplicate Sept rent rows (dashboard Rent Outstanding ₹1,00,250 → ₹7,500); DB now enforces one rent row per resident per month; Generate Monthly Rent checks the DB
- 2026-10-10 - Performance: functions pinned to Mumbai (bom1), proxy skips auth call when logged out, non-blocking fonts
- 2026-10-10 - Fix: marking a resident vacated (status dropdown / notice settlement) now keeps a full record and frees the bed; room 204 opened as single
- 2026-10-10 - Admin Rooms page: Edit Room (type, floor, bed rates, block/remove vacant beds, make single occupancy); room 204 set to single @ ₹9,000
- 2026-10-10 - October 2026 rent records entered (data only); Hassan added to 305; old-dues noted in notes
- 2026-07-12 - docs/ operating system (audit, roadmap, backlog, execution guide, status, logs)

## Pre-docs history (from git, for context)
- feat: public booking form at /book with Google Sheets + Supabase (94b1a3b5)
- feat: portal OTP fix, archive resident, PWA tags, receipts in sidebar (b22915a2)
- update resident onboarding process (934372ff)
- node_modules removed from history (011d81cf, e0018455)
