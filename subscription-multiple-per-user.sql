-- ============================================================
-- MULTIPLE SUBSCRIPTIONS PER STUDENT
-- Run this in Supabase SQL Editor after subscription-setup.sql
-- Allows each student to have several active subscriptions (e.g. Free Trial + Basic 500).
-- Deduction uses priority (lower = use first), then expires_at (soonest first).
--
-- If your table was created with UNIQUE(user_id), this migration drops that constraint
-- so you can add a second, third, etc. plan for the same student.
-- ============================================================

-- 1. Drop the UNIQUE constraint on user_id so one user can have many subscription rows
-- ============================================================
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_user_unique;

-- 2. Add priority column: lower number = used first when deducting MCQs (default 0)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'priority') THEN
    ALTER TABLE public.subscriptions ADD COLUMN priority integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 3. Optional: add a note column for admin (e.g. "Upgrade from Free Trial")
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'note') THEN
    ALTER TABLE public.subscriptions ADD COLUMN note text NULL;
  END IF;
END $$;

-- No RLS or role_permissions change needed; existing policies apply to all rows.
