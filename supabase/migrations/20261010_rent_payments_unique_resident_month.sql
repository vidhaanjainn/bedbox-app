-- 2026-10-10: one rent row per resident per month.
-- 14 duplicate September-2026 rows (all Rs 0 paid, created in one batch on 2026-09-21 by the
-- Rent page's "Generate Monthly Rent" button) were removed first; full copies are kept in
-- public.rent_payments_dup_backup_20261010 (RLS on, no policies = not readable via the API).
alter table public.rent_payments
  add constraint rent_payments_resident_month_year_key unique (resident_id, month, year);
