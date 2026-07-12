-- SEC-01 / SEC-02: remove unsafe anon RLS policies.
-- Onboarding now goes through /api/onboard/[token] (service role, token validated
-- server-side) and uploads use server-issued signed URLs.
-- DEPLOY ORDER: apply this ONLY AFTER the app code with the new API route is live.

-- Anon could read ANY resident row with a live token (no token equality check)
DROP POLICY IF EXISTS "onboard_token_select" ON residents;

-- Anon could update ANY such row arbitrarily (WITH CHECK (true))
DROP POLICY IF EXISTS "allow_onboard_token_update" ON residents;

-- Anyone could upload unlimited files to the resident-docs bucket
DROP POLICY IF EXISTS "anon_upload_resident_docs" ON storage.objects;
