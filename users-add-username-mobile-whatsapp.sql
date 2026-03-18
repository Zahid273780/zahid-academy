-- Add student identity/contact fields to users table
-- Run in Supabase SQL Editor

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS mobile text,
  ADD COLUMN IF NOT EXISTS whatsapp text;

-- Ensure usernames are unique when present
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique_idx
  ON public.users (username)
  WHERE username IS NOT NULL;
