-- Run this in Supabase SQL Editor to lock STUDENT role to portal-only (no MCQs pages, no bulk import, no dashboard, etc.)
-- Students = customers: only Login, Portal, Practice Test, Give Test.

-- Remove any existing student rows so we replace with strict set
DELETE FROM public.role_permissions WHERE role = 'student';

-- Student: only portal-related pages (View only) + minimal DB access for taking tests
INSERT INTO public.role_permissions (role, table_name, can_view, can_read, can_write, can_delete) VALUES
  -- Pages: only login, portal, practice-test, give-test (no dashboard, no MCQs pages, no bulk import, no users, etc.)
  ('student', 'page:login',            true,  false, false, false),
  ('student', 'page:portal',           true,  false, false, false),
  ('student', 'page:practice-test',    true,  false, false, false),
  ('student', 'page:give-test',        true,  false, false, false),
  ('student', 'page:admission',        false, false, false, false),
  ('student', 'page:students',         false, false, false, false),
  ('student', 'page:attendance',       false, false, false, false),
  ('student', 'page:attendance-reports', false, false, false, false),
  ('student', 'page:import-mcqs',      false, false, false, false),
  ('student', 'page:manage-mcqs',      false, false, false, false),
  ('student', 'page:publisher',        false, false, false, false),
  ('student', 'page:results',          false, false, false, false),
  ('student', 'page:course-structure', false, false, false, false),
  ('student', 'page:subjects',         false, false, false, false),
  ('student', 'page:user-form',        false, false, false, false),
  ('student', 'page:import-users',     false, false, false, false),
  ('student', 'page:users',            false, false, false, false),
  ('student', 'page:subscriptions',    false, false, false, false),
  ('student', 'page:rbac',             false, false, false, false),
  ('student', 'page:dashboard',        false, false, false, false),
  -- DB tables: only what portal needs (read mcqs/subjects/coursestructure for tests; read+write own practice)
  ('student', 'users',            true, false, false, false),
  ('student', 'admission_form',   true, false, false, false),
  ('student', 'mcqs',             true, true,  false, false),
  ('student', 'studentpractice',  true, true,  true,  false),
  ('student', 'subjects',         true, true,  false, false),
  ('student', 'coursestructure',   true, true,  false, false),
  ('student', 'role_permissions', true, false,  false, false);
