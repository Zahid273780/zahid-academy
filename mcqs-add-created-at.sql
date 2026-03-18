-- Add created_at to mcqs for daily reporting
-- Run in Supabase SQL Editor

ALTER TABLE public.mcqs
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

ALTER TABLE public.mcqs
  ALTER COLUMN created_at SET DEFAULT now();

UPDATE public.mcqs
SET created_at = now()
WHERE created_at IS NULL;

CREATE INDEX IF NOT EXISTS mcqs_created_at_idx
  ON public.mcqs (created_at);
