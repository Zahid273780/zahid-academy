# Fix: "Permission denied for table login_form" (403)

This error comes from **Supabase Row Level Security (RLS)**. Fix it once in the Supabase dashboard.

## Steps (do this once)

1. Open **[Supabase Dashboard](https://supabase.com/dashboard)** and select project **uygtxlehwtgaftcwsxrr** (or your project that has the `login_form` table).

2. In the left sidebar, click **SQL Editor**.

3. Click **New query**.

4. Open the file **`supabase-login-form-rls.sql`** from this project, copy its **entire** contents, paste into the query box, and click **Run** (or press Ctrl+Enter).

5. You should see "Success. No rows returned." That means the policies were created.

6. **Verify:** In a new query, run:
   ```sql
   SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename = 'login_form';
   ```
   You should see two rows: `allow_select_login_form` (SELECT) and `allow_insert_login_form` (INSERT).

7. Reload your site and open **Form Requests** (Dashboard → Settings → Form Requests). Click **Load form requests** again; the 403 should be gone.

## If it still fails

- Confirm you are in the **correct** Supabase project (the one your app uses: `uygtxlehwtgaftcwsxrr`).
- In Supabase, go to **Table Editor** → **login_form** and confirm the table exists.
- If you see any error when running the SQL, copy the exact message and share it.
