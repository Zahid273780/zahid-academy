# Zahid Academy – Role-Based Control (RBC)

## Overview

- **Admin**: Full access – Admission Management, User Management (create Admin/Teacher/Student).
- **Teacher**: Read-only – can view admitted students list (no edit, no user creation).
- **Student**: Student portal only – “Welcome back, student” and Sign out (no tables, no lists).

## Flow

1. **Single login**: Everyone signs in at **index.html** (Zahid Academy – Sign in).
2. **Redirect by role** (from `users` table):
   - **admin** → **admin.html** (links to admission.html, users.html)
   - **teacher** → **teacher.html** (read-only student list)
   - **student** → **students.html** (welcome dashboard only)
3. **Page protection**: Each HTML checks role via `auth.js` → `requireRole(['admin'])` etc. Wrong or no role → redirect to **index.html**.

## Files

| File | Who can open | What they see |
|------|----------------|----------------|
| **index.html** | Anyone | Login form. After login, redirect by role. |
| **admin.html** | Admin only | Dashboard with links to Admission, User Management. |
| **admission.html** | Admin only | Admission form + admitted students table. |
| **users.html** | Admin only | Create user (Admin/Teacher/Student). |
| **teacher.html** | Teacher only | Read-only table of admitted students. |
| **students.html** | Student only | “Welcome back, student” + email + Sign out. |
| **auth.js** | (shared) | Supabase client, `getSessionRole()`, `requireRole([])`. |

## Supabase setup

1. **Table `users`** (you already have): `id` (uuid, = auth.uid()), `name`, `email`, `role` (text: `admin` / `teacher` / `student`).
2. **RLS (recommended)**: Run **supabase/rls-policies.sql** in Supabase SQL Editor so that:
   - **users**: user can read own row (to get role).
   - **admission_form**: admin = full access, teacher = SELECT only.
   - **students**: admin = full access, teacher = SELECT only.
   - Student role has no access to these tables (only the student portal UI).

## How to test

1. Create an admin user from **users.html** (you may need to open it once without RLS or create the first admin via Supabase Dashboard → Authentication → Users and then insert a row in `users` with that `id` and `role = 'admin'`).
2. Sign in at **index.html** with that admin → you should land on **admin.html**.
3. Create teacher and student users from **users.html**, then sign in as each and confirm redirect to **teacher.html** and **students.html** and that students cannot open admin/teacher pages.
