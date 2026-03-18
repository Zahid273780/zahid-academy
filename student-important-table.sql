-- Student-specific Important bucket (global per student)
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.student_important_mcqs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mcq_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_important_unique UNIQUE (user_id, mcq_id)
);

CREATE INDEX IF NOT EXISTS idx_student_important_user ON public.student_important_mcqs(user_id);
CREATE INDEX IF NOT EXISTS idx_student_important_mcq ON public.student_important_mcqs(mcq_id);

ALTER TABLE public.student_important_mcqs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'student_important_mcqs' AND policyname = 'student_important_owner_read'
  ) THEN
    CREATE POLICY "student_important_owner_read"
      ON public.student_important_mcqs FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'student_important_mcqs' AND policyname = 'student_important_owner_write'
  ) THEN
    CREATE POLICY "student_important_owner_write"
      ON public.student_important_mcqs FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'student_important_mcqs' AND policyname = 'student_important_owner_delete'
  ) THEN
    CREATE POLICY "student_important_owner_delete"
      ON public.student_important_mcqs FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;
