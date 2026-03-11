-- Attempts: one row per student answer per MCQ (for analytics: accuracy, topic-wise, learning curve, mistake frequency).
-- Run in Supabase SQL Editor after mcqs and users exist.

CREATE TABLE IF NOT EXISTS public.attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mcq_id uuid NOT NULL,
  selected_option text NULL,
  is_correct boolean NOT NULL,
  time_taken_sec integer NULL,
  attempt_date timestamptz NOT NULL DEFAULT now(),
  course text NULL,
  class_exam text NULL,
  subject text NULL,
  unit text NULL,
  category text NULL,
  test_number integer NULL,
  test_type text NULL,
  CONSTRAINT attempts_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS attempts_user_date_idx ON public.attempts (user_id, attempt_date);
CREATE INDEX IF NOT EXISTS attempts_user_mcq_idx ON public.attempts (user_id, mcq_id);

ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attempts_insert" ON public.attempts;
CREATE POLICY "attempts_insert" ON public.attempts FOR INSERT
  WITH CHECK (true);
DROP POLICY IF EXISTS "attempts_select" ON public.attempts;
CREATE POLICY "attempts_select" ON public.attempts FOR SELECT
  USING (true);
-- Service role / API will use service key; RLS allows for authenticated student inserts from API.

-- Optional: extend mistake_bucket for repeated-mistake count
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'mistake_bucket' AND column_name = 'mistake_count') THEN
    ALTER TABLE public.mistake_bucket ADD COLUMN mistake_count integer NOT NULL DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'mistake_bucket' AND column_name = 'last_attempt') THEN
    ALTER TABLE public.mistake_bucket ADD COLUMN last_attempt timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- Function: add or increment mistake_bucket for given user and MCQ IDs (for use by save-attempts API).
CREATE OR REPLACE FUNCTION public.add_mistakes(p_user_id uuid, p_mcq_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mid uuid;
BEGIN
  IF p_mcq_ids IS NULL OR array_length(p_mcq_ids, 1) IS NULL THEN
    RETURN;
  END IF;
  FOREACH mid IN ARRAY p_mcq_ids
  LOOP
    INSERT INTO public.mistake_bucket (user_id, mcq_id, mistake_count, last_attempt)
    VALUES (p_user_id, mid, 1, now())
    ON CONFLICT (user_id, mcq_id)
    DO UPDATE SET
      mistake_count = public.mistake_bucket.mistake_count + 1,
      last_attempt = now();
  END LOOP;
END;
$$;

-- If mistake_bucket has no mistake_count/last_attempt yet, the function will fail; add columns first (see DO $$ above).
-- If your mistake_bucket has no such columns, use a simpler function that only inserts (no increment):
-- INSERT INTO public.mistake_bucket (user_id, mcq_id) VALUES (p_user_id, mid) ON CONFLICT (user_id, mcq_id) DO NOTHING;
