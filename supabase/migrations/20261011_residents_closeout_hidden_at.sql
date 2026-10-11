alter table public.residents add column if not exists closeout_hidden_at timestamptz;
comment on column public.residents.closeout_hidden_at is 'Admin chose to hide this vacated resident''s pending close-out items from pending-action lists. Still visible on their own page.';
