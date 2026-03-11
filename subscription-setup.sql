-- ============================================================
-- SUBSCRIPTION SYSTEM: Run this in Supabase SQL Editor
-- ============================================================

-- 1. Create subscriptions table (with student_name, email, class)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  student_name text NULL,
  email text NULL,
  class integer NULL,
  package_name text NOT NULL DEFAULT 'Free Trial'::text,
  mcq_limit integer NOT NULL DEFAULT 100,
  mcqs_used integer NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 days'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT subscriptions_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT subscriptions_user_unique UNIQUE (user_id)
) TABLESPACE pg_default;

-- 2. If table already exists without these columns, add them
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'student_name') THEN
    ALTER TABLE public.subscriptions ADD COLUMN student_name text NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'email') THEN
    ALTER TABLE public.subscriptions ADD COLUMN email text NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'class') THEN
    ALTER TABLE public.subscriptions ADD COLUMN class integer NULL;
  END IF;
END $$;

-- 3. Auto-assign Free Trial to all existing students (with name, email, class from users + admission_form)
-- ============================================================
INSERT INTO public.subscriptions (user_id, student_name, email, class, package_name, mcq_limit, mcqs_used, starts_at, expires_at, is_active)
SELECT u.id,
  u.name,
  u.email,
  a.class,
  'Free Trial',
  100,
  0,
  now(),
  now() + interval '15 days',
  true
FROM public.users u
LEFT JOIN public.admission_form a ON a.roll = u.roll
WHERE lower(u.role) = 'student'
  AND NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.user_id = u.id);

-- 4. Backfill student_name, email, class for existing subscription rows
-- ============================================================
UPDATE public.subscriptions s
SET
  student_name = u.name,
  email = u.email,
  class = a.class
FROM public.users u
LEFT JOIN public.admission_form a ON a.roll = u.roll
WHERE s.user_id = u.id
  AND (s.student_name IS DISTINCT FROM u.name OR s.email IS DISTINCT FROM u.email OR s.class IS DISTINCT FROM a.class);

-- 5. Enable RLS
-- ============================================================
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sub_self_read" ON public.subscriptions;
CREATE POLICY "sub_self_read" ON public.subscriptions FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "sub_admin_read" ON public.subscriptions;
CREATE POLICY "sub_admin_read" ON public.subscriptions FOR SELECT
  USING (check_permission('subscriptions', 'read'));

DROP POLICY IF EXISTS "sub_admin_insert" ON public.subscriptions;
CREATE POLICY "sub_admin_insert" ON public.subscriptions FOR INSERT
  WITH CHECK (check_permission('subscriptions', 'write'));

DROP POLICY IF EXISTS "sub_admin_update" ON public.subscriptions;
CREATE POLICY "sub_admin_update" ON public.subscriptions FOR UPDATE
  USING (check_permission('subscriptions', 'write'));

DROP POLICY IF EXISTS "sub_admin_delete" ON public.subscriptions;
CREATE POLICY "sub_admin_delete" ON public.subscriptions FOR DELETE
  USING (check_permission('subscriptions', 'delete'));

-- 6. Add subscriptions to role_permissions
-- ============================================================
INSERT INTO public.role_permissions (role, table_name, can_view, can_read, can_write, can_delete)
VALUES
  ('admin', 'subscriptions', true, true, true, true),
  ('teacher', 'subscriptions', true, true, false, false),
  ('student', 'subscriptions', false, true, false, false),
  ('accountant', 'subscriptions', true, true, false, false)
ON CONFLICT (role, table_name) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_read = EXCLUDED.can_read,
  can_write = EXCLUDED.can_write,
  can_delete = EXCLUDED.can_delete;
