-- ============================================================
-- SUBSCRIPTIONS TABLE (multiple plans per student)
-- Run this in Supabase SQL Editor. Safe to run if table already exists.
-- ============================================================

-- 1. Create table if not exists (with all columns, no UNIQUE on user_id)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  package_name text NOT NULL DEFAULT 'Free Trial'::text,
  mcq_limit integer NOT NULL DEFAULT 100,
  mcqs_used integer NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 days'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  student_name text NULL,
  email text NULL,
  class integer NULL,
  priority integer NOT NULL DEFAULT 0,
  note text NULL,
  allowed_subjects text NULL,
  CONSTRAINT subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT subscriptions_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- 2. If table already existed, add any missing columns
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
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'priority') THEN
    ALTER TABLE public.subscriptions ADD COLUMN priority integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'note') THEN
    ALTER TABLE public.subscriptions ADD COLUMN note text NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'allowed_subjects') THEN
    ALTER TABLE public.subscriptions ADD COLUMN allowed_subjects text NULL;
  END IF;
END $$;

-- 3. Drop UNIQUE on user_id so one student can have multiple rows
-- ============================================================
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_user_unique;

-- 4. Enable RLS and policies (requires check_permission to exist)
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

-- 5. Role permissions
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
