-- Student-specific Not Relevant bucket (context-bound by test metadata)
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.student_not_relevant_mcqs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mcq_id text NOT NULL,
  course text NOT NULL,
  class_exam text NOT NULL,
  subject text NOT NULL,
  unit text NOT NULL,
  category text,
  test_number integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_not_relevant_unique UNIQUE (user_id, mcq_id, course, class_exam, subject, unit, category, test_number)
);

CREATE INDEX IF NOT EXISTS idx_student_not_relevant_user ON public.student_not_relevant_mcqs(user_id);
CREATE INDEX IF NOT EXISTS idx_student_not_relevant_context ON public.student_not_relevant_mcqs(user_id, course, class_exam, subject, unit, category, test_number);
CREATE INDEX IF NOT EXISTS idx_student_not_relevant_mcq ON public.student_not_relevant_mcqs(mcq_id);

ALTER TABLE public.student_not_relevant_mcqs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'student_not_relevant_mcqs' AND policyname = 'student_not_relevant_owner_read'
  ) THEN
    CREATE POLICY "student_not_relevant_owner_read"
      ON public.student_not_relevant_mcqs FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'student_not_relevant_mcqs' AND policyname = 'student_not_relevant_owner_write'
  ) THEN
    CREATE POLICY "student_not_relevant_owner_write"
      ON public.student_not_relevant_mcqs FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'student_not_relevant_mcqs' AND policyname = 'student_not_relevant_owner_delete'
  ) THEN
    CREATE POLICY "student_not_relevant_owner_delete"
      ON public.student_not_relevant_mcqs FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;
