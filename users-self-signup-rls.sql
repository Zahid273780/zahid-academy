-- Run this in Supabase SQL Editor once.
-- Allows a newly signed-up user to insert their OWN row into public.users (for student self-registration).
-- They can only insert a row where id = auth.uid() (their own auth id). Other roles (admin/teacher) still use users_role_write.

CREATE POLICY "users_self_insert" ON public.users FOR INSERT
  WITH CHECK (id = auth.uid());
