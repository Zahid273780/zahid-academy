-- ============================================================
-- RBAC Setup: Run this ENTIRE script in Supabase SQL Editor
-- ============================================================
--
-- IMPORTANT: After running this, pages that query Supabase
-- will need an authenticated session (admin login) to work.
-- Pages that currently lack auth (admission.html, students.html,
-- mcqs.html, subjects.html, course-structure.html, bulkimport.html,
-- results.html, publisher.html, rbac.html) will need auth added.
-- Pages that already have auth (index.html, users.html) will
-- continue to work normally.
-- Cloudflare Pages Functions use the service role key and
-- BYPASS RLS -- they do their own auth checks.
-- ============================================================

-- 1. Drop old table and recreate with granular permissions
-- ============================================================
DROP TABLE IF EXISTS public.role_permissions;

CREATE TABLE public.role_permissions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role text NOT NULL,
  table_name text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_read boolean NOT NULL DEFAULT false,
  can_write boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  CONSTRAINT unique_role_table UNIQUE (role, table_name)
);

-- 2. Seed default permissions
-- ============================================================
-- Each role gets:
--   a) Per-page entries (page:xxx) controlling frontend View access + R/W/D for pages with DB tables
--   b) DB-table entries (users, mcqs, etc.) used by RLS check_permission()

-- ======================== ADMIN ========================
-- Admin: full access to everything
INSERT INTO public.role_permissions (role, table_name, can_view, can_read, can_write, can_delete) VALUES
  -- Per-page entries
  ('admin', 'page:login',            true, false, false, false),
  ('admin', 'page:portal',           true, false, false, false),
  ('admin', 'page:practice-test',    true, false, false, false),
  ('admin', 'page:give-test',        true, false, false, false),
  ('admin', 'page:admission',        true, true,  true,  true),
  ('admin', 'page:students',         true, true,  true,  true),
  ('admin', 'page:import-mcqs',      true, true,  true,  true),
  ('admin', 'page:manage-mcqs',      true, true,  true,  true),
  ('admin', 'page:publisher',        true, true,  true,  true),
  ('admin', 'page:results',          true, true,  true,  true),
  ('admin', 'page:course-structure', true, true,  true,  true),
  ('admin', 'page:subjects',         true, true,  true,  true),
  ('admin', 'page:user-form',        true, true,  true,  true),
  ('admin', 'page:import-users',     true, true,  true,  true),
  ('admin', 'page:users',            true, true,  true,  true),
  ('admin', 'page:rbac',             true, true,  true,  true),
  ('admin', 'page:dashboard',        true, false, false, false),
  -- DB-table entries (for RLS)
  ('admin', 'users',            true, true, true, true),
  ('admin', 'admission_form',   true, true, true, true),
  ('admin', 'mcqs',             true, true, true, true),
  ('admin', 'studentpractice',  true, true, true, true),
  ('admin', 'subjects',         true, true, true, true),
  ('admin', 'coursestructure',   true, true, true, true),
  ('admin', 'role_permissions', true, true, true, true);

-- ======================== TEACHER ========================
INSERT INTO public.role_permissions (role, table_name, can_view, can_read, can_write, can_delete) VALUES
  -- Per-page entries
  ('teacher', 'page:login',            false, false, false, false),
  ('teacher', 'page:portal',           false, false, false, false),
  ('teacher', 'page:practice-test',    false, false, false, false),
  ('teacher', 'page:give-test',        false, false, false, false),
  ('teacher', 'page:admission',        true,  true,  true,  false),
  ('teacher', 'page:students',         true,  true,  true,  false),
  ('teacher', 'page:import-mcqs',      true,  true,  true,  true),
  ('teacher', 'page:manage-mcqs',      true,  true,  true,  true),
  ('teacher', 'page:publisher',        true,  true,  true,  true),
  ('teacher', 'page:results',          true,  true,  false, false),
  ('teacher', 'page:course-structure', true,  true,  true,  false),
  ('teacher', 'page:subjects',         true,  true,  true,  false),
  ('teacher', 'page:user-form',        false, false, false, false),
  ('teacher', 'page:import-users',     false, false, false, false),
  ('teacher', 'page:users',            true,  true,  false, false),
  ('teacher', 'page:rbac',             false, false, false, false),
  ('teacher', 'page:dashboard',        true,  false, false, false),
  -- DB-table entries (for RLS)
  ('teacher', 'users',            true, true,  false, false),
  ('teacher', 'admission_form',   true, true,  true,  false),
  ('teacher', 'mcqs',             true, true,  true,  true),
  ('teacher', 'studentpractice',  true, true,  false, false),
  ('teacher', 'subjects',         true, true,  true,  false),
  ('teacher', 'coursestructure',   true, true,  true,  false),
  ('teacher', 'role_permissions', true, false,  false, false);

-- ======================== STUDENT ========================
INSERT INTO public.role_permissions (role, table_name, can_view, can_read, can_write, can_delete) VALUES
  -- Per-page entries
  ('student', 'page:login',            true,  false, false, false),
  ('student', 'page:portal',           true,  false, false, false),
  ('student', 'page:practice-test',    true,  false, false, false),
  ('student', 'page:give-test',        true,  false, false, false),
  ('student', 'page:admission',        false, false, false, false),
  ('student', 'page:students',         false, false, false, false),
  ('student', 'page:import-mcqs',      false, false, false, false),
  ('student', 'page:manage-mcqs',      false, false, false, false),
  ('student', 'page:publisher',        false, false, false, false),
  ('student', 'page:results',          false, false, false, false),
  ('student', 'page:course-structure', false, false, false, false),
  ('student', 'page:subjects',         false, false, false, false),
  ('student', 'page:user-form',        false, false, false, false),
  ('student', 'page:import-users',     false, false, false, false),
  ('student', 'page:users',            false, false, false, false),
  ('student', 'page:rbac',             false, false, false, false),
  ('student', 'page:dashboard',        false, false, false, false),
  -- DB-table entries (for RLS)
  ('student', 'users',            true, false, false, false),
  ('student', 'admission_form',   true, false, false, false),
  ('student', 'mcqs',             true, true,  false, false),
  ('student', 'studentpractice',  true, true,  true,  false),
  ('student', 'subjects',         true, true,  false, false),
  ('student', 'coursestructure',   true, true,  false, false),
  ('student', 'role_permissions', true, false,  false, false);

-- ======================== ACCOUNTANT ========================
INSERT INTO public.role_permissions (role, table_name, can_view, can_read, can_write, can_delete) VALUES
  -- Per-page entries
  ('accountant', 'page:login',            false, false, false, false),
  ('accountant', 'page:portal',           false, false, false, false),
  ('accountant', 'page:practice-test',    false, false, false, false),
  ('accountant', 'page:give-test',        false, false, false, false),
  ('accountant', 'page:admission',        true,  true,  false, false),
  ('accountant', 'page:students',         true,  true,  false, false),
  ('accountant', 'page:import-mcqs',      false, false, false, false),
  ('accountant', 'page:manage-mcqs',      false, false, false, false),
  ('accountant', 'page:publisher',        false, false, false, false),
  ('accountant', 'page:results',          true,  true,  false, false),
  ('accountant', 'page:course-structure', false, false, false, false),
  ('accountant', 'page:subjects',         false, false, false, false),
  ('accountant', 'page:user-form',        false, false, false, false),
  ('accountant', 'page:import-users',     false, false, false, false),
  ('accountant', 'page:users',            true,  true,  false, false),
  ('accountant', 'page:rbac',             false, false, false, false),
  ('accountant', 'page:dashboard',        true,  false, false, false),
  -- DB-table entries (for RLS)
  ('accountant', 'users',            true, true,  false, false),
  ('accountant', 'admission_form',   true, true,  false, false),
  ('accountant', 'mcqs',             true, false,  false, false),
  ('accountant', 'studentpractice',  true, true,  false, false),
  ('accountant', 'subjects',         true, false,  false, false),
  ('accountant', 'coursestructure',   true, false,  false, false),
  ('accountant', 'role_permissions', true, false,  false, false);


-- 3. Create the permission-check helper function
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_permission(target_table text, permission text)
RETURNS boolean AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role FROM public.users WHERE id = auth.uid();

  IF user_role IS NULL THEN RETURN false; END IF;
  IF lower(user_role) = 'admin' THEN RETURN true; END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.role_permissions
    WHERE role = lower(user_role)
      AND table_name = target_table
      AND CASE permission
        WHEN 'read'   THEN can_read
        WHEN 'write'  THEN can_write
        WHEN 'delete' THEN can_delete
        ELSE false
      END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- 4. Enable RLS and create policies on all tables
-- ============================================================

-- ---- users ----
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can always read their OWN row (needed to look up role, avoids circular dependency)
CREATE POLICY "users_self_read" ON public.users FOR SELECT
  USING (id = auth.uid());

-- Users with 'read' permission on users table can see all users
CREATE POLICY "users_role_read" ON public.users FOR SELECT
  USING (check_permission('users', 'read'));

CREATE POLICY "users_role_write" ON public.users FOR INSERT
  WITH CHECK (check_permission('users', 'write'));

CREATE POLICY "users_role_update" ON public.users FOR UPDATE
  USING (check_permission('users', 'write'));

CREATE POLICY "users_role_delete" ON public.users FOR DELETE
  USING (check_permission('users', 'delete'));


-- ---- admission_form ----
ALTER TABLE public.admission_form ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admission_read" ON public.admission_form FOR SELECT
  USING (check_permission('admission_form', 'read'));

CREATE POLICY "admission_write" ON public.admission_form FOR INSERT
  WITH CHECK (check_permission('admission_form', 'write'));

CREATE POLICY "admission_update" ON public.admission_form FOR UPDATE
  USING (check_permission('admission_form', 'write'));

CREATE POLICY "admission_delete" ON public.admission_form FOR DELETE
  USING (check_permission('admission_form', 'delete'));


-- ---- mcqs ----
ALTER TABLE public.mcqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mcqs_read" ON public.mcqs FOR SELECT
  USING (check_permission('mcqs', 'read'));

CREATE POLICY "mcqs_write" ON public.mcqs FOR INSERT
  WITH CHECK (check_permission('mcqs', 'write'));

CREATE POLICY "mcqs_update" ON public.mcqs FOR UPDATE
  USING (check_permission('mcqs', 'write'));

CREATE POLICY "mcqs_delete" ON public.mcqs FOR DELETE
  USING (check_permission('mcqs', 'delete'));


-- ---- studentpractice ----
ALTER TABLE public.studentpractice ENABLE ROW LEVEL SECURITY;

CREATE POLICY "studentpractice_read" ON public.studentpractice FOR SELECT
  USING (check_permission('studentpractice', 'read'));

CREATE POLICY "studentpractice_write" ON public.studentpractice FOR INSERT
  WITH CHECK (check_permission('studentpractice', 'write'));

CREATE POLICY "studentpractice_update" ON public.studentpractice FOR UPDATE
  USING (check_permission('studentpractice', 'write'));

CREATE POLICY "studentpractice_delete" ON public.studentpractice FOR DELETE
  USING (check_permission('studentpractice', 'delete'));


-- ---- subjects ----
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subjects_read" ON public.subjects FOR SELECT
  USING (check_permission('subjects', 'read'));

CREATE POLICY "subjects_write" ON public.subjects FOR INSERT
  WITH CHECK (check_permission('subjects', 'write'));

CREATE POLICY "subjects_update" ON public.subjects FOR UPDATE
  USING (check_permission('subjects', 'write'));

CREATE POLICY "subjects_delete" ON public.subjects FOR DELETE
  USING (check_permission('subjects', 'delete'));


-- ---- coursestructure ----
ALTER TABLE public.coursestructure ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coursestructure_read" ON public.coursestructure FOR SELECT
  USING (check_permission('coursestructure', 'read'));

CREATE POLICY "coursestructure_write" ON public.coursestructure FOR INSERT
  WITH CHECK (check_permission('coursestructure', 'write'));

CREATE POLICY "coursestructure_update" ON public.coursestructure FOR UPDATE
  USING (check_permission('coursestructure', 'write'));

CREATE POLICY "coursestructure_delete" ON public.coursestructure FOR DELETE
  USING (check_permission('coursestructure', 'delete'));


-- ---- role_permissions (this table itself) ----
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read role_permissions (needed for frontend permission checks)
CREATE POLICY "role_permissions_read" ON public.role_permissions FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only admins can modify role_permissions
CREATE POLICY "role_permissions_write" ON public.role_permissions FOR INSERT
  WITH CHECK (check_permission('role_permissions', 'write'));

CREATE POLICY "role_permissions_update" ON public.role_permissions FOR UPDATE
  USING (check_permission('role_permissions', 'write'));

CREATE POLICY "role_permissions_delete" ON public.role_permissions FOR DELETE
  USING (check_permission('role_permissions', 'delete'));


-- ============================================================
-- DONE! The RBAC system is now active.
-- Admin always has full access via check_permission().
-- Other roles are controlled by the role_permissions table.
-- ============================================================
