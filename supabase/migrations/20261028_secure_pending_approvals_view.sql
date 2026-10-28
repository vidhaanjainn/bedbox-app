-- Supabase advisor (critical): public.pending_approvals was a SECURITY DEFINER view,
-- i.e. it ran with its owner's rights and bypassed row level security, and the
-- public `anon` role had been granted access (plus write privileges, meaningless
-- on a view but wrong). It exposes resident name/email/mobile. Nothing in the app
-- reads it. Make it run with the caller's rights (so residents' RLS applies) and
-- strip public access; signed-in users keep read-only SELECT.
ALTER VIEW public.pending_approvals SET (security_invoker = true);
REVOKE ALL ON public.pending_approvals FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.pending_approvals FROM authenticated;
