-- Old (pre-system / carried-forward) dues, tracked separately from monthly
-- rent_payments invoices. A due has an original amount; every payment against
-- it is a dated row, so the money shows up as real cash received in the month
-- it was actually collected. Outstanding = original_amount - sum(payments).

create table if not exists public.old_dues (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references public.residents(id),
  original_amount numeric not null check (original_amount > 0),
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.old_due_payments (
  id uuid primary key default gen_random_uuid(),
  old_due_id uuid not null references public.old_dues(id) on delete cascade,
  resident_id uuid not null references public.residents(id),
  amount numeric not null check (amount > 0),
  paid_at timestamptz not null default now(),
  payment_mode text check (payment_mode in ('upi','bank_transfer','cash')),
  notes text,
  collected_by uuid references public.admins(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_old_dues_resident on public.old_dues(resident_id);
create index if not exists idx_old_due_payments_due on public.old_due_payments(old_due_id);
create index if not exists idx_old_due_payments_paid_at on public.old_due_payments(paid_at);

alter table public.old_dues enable row level security;
alter table public.old_due_payments enable row level security;

create policy "admin_all_old_dues" on public.old_dues for all using (is_admin()) with check (is_admin());
create policy "admin_all_old_due_payments" on public.old_due_payments for all using (is_admin()) with check (is_admin());
create policy "residents_view_own_old_dues" on public.old_dues for select
  using (resident_id in (select id from public.residents where portal_user_id = auth.uid()));
create policy "residents_view_own_old_due_payments" on public.old_due_payments for select
  using (resident_id in (select id from public.residents where portal_user_id = auth.uid()));

-- Seed: figures given by the owner on 2026-10-10.
-- Shivam: ₹4,500 old pending, ₹1,000 received today -> ₹3,500 pending.
-- Shourya: ₹2,000 old pending, ₹1,000 received today -> ₹1,000 pending.
with d as (
  insert into public.old_dues (resident_id, original_amount, reason)
  select id, case name when 'Shivam Tiwari' then 4500 else 2000 end, 'Old pending dues carried forward (entered 2026-10-10)'
  from public.residents where room_number = '104' and name in ('Shivam Tiwari','Shourya Raikwar')
  returning id, resident_id
)
insert into public.old_due_payments (old_due_id, resident_id, amount, paid_at, notes)
select id, resident_id, 1000, '2026-10-10 12:00:00+05:30', 'Received 10 Oct 2026 along with October rent' from d;
