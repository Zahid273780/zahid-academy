-- ============================================================
-- Protect announcements, motivational_messages, and quotes
-- with Row Level Security.
-- Run this in Supabase SQL Editor.
-- ============================================================

-- ---- announcements ----
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcements_read" ON public.announcements FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "announcements_write" ON public.announcements FOR INSERT
  WITH CHECK (check_permission('announcements', 'write'));

CREATE POLICY "announcements_update" ON public.announcements FOR UPDATE
  USING (check_permission('announcements', 'write'));

CREATE POLICY "announcements_delete" ON public.announcements FOR DELETE
  USING (check_permission('announcements', 'delete'));


-- ---- motivational_messages ----
ALTER TABLE public.motivational_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "motivational_messages_read" ON public.motivational_messages FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "motivational_messages_write" ON public.motivational_messages FOR INSERT
  WITH CHECK (check_permission('motivational_messages', 'write'));

CREATE POLICY "motivational_messages_update" ON public.motivational_messages FOR UPDATE
  USING (check_permission('motivational_messages', 'write'));

CREATE POLICY "motivational_messages_delete" ON public.motivational_messages FOR DELETE
  USING (check_permission('motivational_messages', 'delete'));


-- ---- quotes ----
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotes_read" ON public.quotes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "quotes_write" ON public.quotes FOR INSERT
  WITH CHECK (check_permission('quotes', 'write'));

CREATE POLICY "quotes_update" ON public.quotes FOR UPDATE
  USING (check_permission('quotes', 'write'));

CREATE POLICY "quotes_delete" ON public.quotes FOR DELETE
  USING (check_permission('quotes', 'delete'));
