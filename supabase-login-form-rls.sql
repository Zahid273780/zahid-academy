-- Run this once in Supabase SQL Editor (project: uygtxlehwtgaftcwsxrr)
-- Fixes: "permission denied for table login_form" (403) when loading form requests or submitting the student form.

ALTER TABLE public.login_form ENABLE ROW LEVEL SECURITY;

-- Remove any existing policies that might block access
DROP POLICY IF EXISTS "allow_select_login_form" ON public.login_form;
DROP POLICY IF EXISTS "allow_insert_login_form" ON public.login_form;

-- Allow anonymous SELECT (e.g. admin import page loading requests, or API fallback)
CREATE POLICY "allow_select_login_form"
ON public.login_form FOR SELECT
TO anon
USING (true);

-- Allow anonymous INSERT (student request form submission)
CREATE POLICY "allow_insert_login_form"
ON public.login_form FOR INSERT
TO anon
WITH CHECK (true);

-- Verify (optional): list policies on login_form
-- SELECT tablename, policyname, roles, cmd FROM pg_policies WHERE tablename = 'login_form';
