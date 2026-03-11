-- Attendance: one row per date, class, subject, roll. Status: present | absent | holiday
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  att_date date NOT NULL,
  class integer NOT NULL,
  subject text NOT NULL,
  roll integer NOT NULL,
  student_name text NULL,
  status text NOT NULL DEFAULT 'absent' CHECK (status IN ('present', 'absent', 'holiday')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_unique UNIQUE (att_date, class, subject, roll)
);

-- Add student_name if table already existed without it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'attendance' AND column_name = 'student_name') THEN
    ALTER TABLE public.attendance ADD COLUMN student_name text NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS attendance_date_class_subject_idx ON public.attendance (att_date, class, subject);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_select" ON public.attendance;
CREATE POLICY "attendance_select" ON public.attendance FOR SELECT
  USING (check_permission('attendance', 'read'));

DROP POLICY IF EXISTS "attendance_insert" ON public.attendance;
CREATE POLICY "attendance_insert" ON public.attendance FOR INSERT
  WITH CHECK (check_permission('attendance', 'write'));

DROP POLICY IF EXISTS "attendance_update" ON public.attendance;
CREATE POLICY "attendance_update" ON public.attendance FOR UPDATE
  USING (check_permission('attendance', 'read'))
  WITH CHECK (check_permission('attendance', 'write'));

DROP POLICY IF EXISTS "attendance_delete" ON public.attendance;
CREATE POLICY "attendance_delete" ON public.attendance FOR DELETE
  USING (check_permission('attendance', 'write'));

-- Add role permissions for attendance (run after rbac-setup or add to role_permissions)
INSERT INTO public.role_permissions (role, table_name, can_view, can_read, can_write, can_delete)
VALUES
  ('admin', 'attendance', true, true, true, true),
  ('teacher', 'attendance', true, true, true, true),
  ('accountant', 'attendance', true, true, false, false)
ON CONFLICT (role, table_name) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_read = EXCLUDED.can_read,
  can_write = EXCLUDED.can_write,
  can_delete = EXCLUDED.can_delete;
