alter table public.rent_payments add column if not exists received_by_name text;
alter table public.old_due_payments add column if not exists received_by_name text;
comment on column public.rent_payments.received_by_name is 'Who received the money when it was not an app admin (collected_by is null then), e.g. a family member or staff.';
comment on column public.old_due_payments.received_by_name is 'Who received the money when it was not an app admin (collected_by is null then).';
