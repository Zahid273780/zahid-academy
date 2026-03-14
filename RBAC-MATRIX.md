# Access Control Matrix – What Each Role Can Do

**V = View (can open the page)** · **R = Read (SELECT)** · **W = Write (INSERT/UPDATE)** · **D = Delete**

---

## Student (customer – portal only)

Students only have access to **Login**, **Portal**, **Practice Test**, and **Give Test**. They cannot open any staff pages (no Dashboard, no MCQs, no bulk import, no users, etc.).

| Page / Resource | View | Read | Write | Delete |
|------------------|------|------|-------|--------|
| Login | ✓ | — | — | — |
| Portal | ✓ | — | — | — |
| Practice Test | ✓ | — | — | — |
| Give Test | ✓ | — | — | — |
| **All other pages** (Admission, Students, Import MCQs, Manage MCQs, Publisher, Results, Course Structure, Subjects, User Form, Import Users, Users, Subscriptions, Access Control, Dashboard, Attendance, etc.) | ✗ | ✗ | ✗ | ✗ |
| MCQs (table – for taking tests only) | ✓ | ✓ | ✗ | ✗ |
| Student practice (table – own attempts) | ✓ | ✓ | ✓ | ✗ |
| Subjects / Course structure (table – for tests) | ✓ | ✓ | ✗ | ✗ |
| Users, Admission form, Role permissions (table) | ✓ view only | ✗ | ✗ | ✗ |

**Summary for students:** Can only use the student portal (login, portal, practice test, give test). No access to staff HTMLs like MCQs, bulk import, admission, users, or dashboard.

---

## Admin

| Page / Resource | View | Read | Write | Delete |
|------------------|------|------|-------|--------|
| All pages | ✓ | ✓ where applicable | ✓ | ✓ |
| All DB tables | ✓ | ✓ | ✓ | ✓ |

**Summary:** Full access to everything.

---

## Teacher

| Page / Resource | View | Read | Write | Delete |
|------------------|------|------|-------|--------|
| Dashboard | ✓ | — | — | — |
| Admission, Students, Import MCQs, Manage MCQs, Publisher, Results, Course Structure, Subjects, Users | ✓ | ✓ | ✓ (no Delete on some) | ✓ only on MCQs/import |
| User Form, Import Users, Access Control | ✗ | ✗ | ✗ | ✗ |
| DB tables (users, admission_form, mcqs, etc.) | ✓ | ✓ | ✓ for admission/mcqs; Read-only for results, subjects, course structure | ✓ only where allowed |

**Summary:** Can manage admission, students, MCQs, publisher, results, course structure, subjects, and view users; cannot access User Form, Import Users, or Access Control.

---

## Accountant

| Page / Resource | View | Read | Write | Delete |
|------------------|------|------|-------|--------|
| Dashboard | ✓ | — | — | — |
| Admission, Students, Results, Users | ✓ | ✓ | ✗ | ✗ |
| Import MCQs, Manage MCQs, Publisher, Course Structure, Subjects, User Form, Import Users, Access Control | ✗ | ✗ | ✗ | ✗ |
| DB tables | ✓ Read-only for admission, students, results, users | ✓ | ✗ | ✗ |

**Summary:** Read-only access to admission, students, results, and users; no MCQs or access control.

---

## How to apply “student = portal only” in the database

1. In **Supabase SQL Editor**, run the script **`student-permissions-fix.sql`** from this project.
2. In your app, open **Access Control (rbac.html)** and confirm the Student column shows ✓ only for Login, Portal, Practice Test, Give Test (and the required table rows for tests).
3. Students will then be limited to their portal only; they will not see or open MCQs, bulk import, or other staff pages.
