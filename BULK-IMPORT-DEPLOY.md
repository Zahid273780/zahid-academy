# Bulk User Import – Deploy Edge Function

This guide gets the **bulk-create-users** Edge Function running so admins can upload a CSV and create many users at once.

---

## 1. Prerequisites

- Supabase project (already in use for Zahid Academy)
- [Supabase CLI](https://supabase.com/docs/guides/cli) installed (optional for local testing)
- **Node.js** (for `npx supabase`) if you use CLI

---

## 2. Add secret: Anon key (for admin check)

The Edge Function must verify that the caller is an **admin**. It does this by validating the JWT using the **anon** key. The **service_role** key is only used inside the function (never in the frontend).

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Project Settings** (gear) → **Edge Functions** (or **API** / **Secrets** depending on your dashboard).
3. Add a **secret**:
   - **Name:** `SUPABASE_ANON_KEY`
   - **Value:** your project’s **anon** (public) key from **Settings → API → Project API keys → anon public**.

Without this, the function cannot verify the JWT and will reject the request or fall back to unverified decoding (not safe for production).

---

## 3. Deploy the Edge Function

### Option A: Deploy with Supabase CLI (recommended)

From your project root (where `supabase/` lives):

```bash
# Login once (if needed)
npx supabase login

# Link to your project (use your project ref from dashboard URL)
npx supabase link --project-ref uygtxlehwtgaftcwsxrr

# Deploy the function (--no-verify-jwt lets CORS preflight OPTIONS succeed from Netlify/other origins)
npx supabase functions deploy bulk-create-users --no-verify-jwt
```

**Important:** Use `--no-verify-jwt` so the Supabase gateway does not require a JWT for OPTIONS requests. Otherwise the browser preflight fails with "Response to preflight request doesn't pass access control check". The function still checks admin role for POST inside the code.

Set the anon key as a secret (one-time):

```bash
npx supabase secrets set SUPABASE_ANON_KEY=your_anon_key_here
```

Replace `your_anon_key_here` with the real anon key from the dashboard.

### Option B: Deploy from Dashboard (if your UI supports it)

If your Supabase project has **Edge Functions** in the dashboard with “Deploy” or “Create function”:

1. Create a new function named **bulk-create-users**.
2. Paste the contents of `supabase/functions/bulk-create-users/index.ts`.
3. Save and deploy.
4. In **Secrets**, add `SUPABASE_ANON_KEY` as above.

---

## 4. Confirm the function URL

After deployment, the endpoint is:

```
https://<PROJECT_REF>.supabase.co/functions/v1/bulk-create-users
```

For your project:

```
https://uygtxlehwtgaftcwsxrr.supabase.co/functions/v1/bulk-create-users
```

The frontend in `index.html` (Bulk Import) already uses this URL.

---

## 5. Database: `public.users` table

The function inserts into `public.users`. Ensure the table exists and has at least:

| Column     | Type      | Notes                          |
|-----------|-----------|---------------------------------|
| id        | uuid      | Primary key, same as auth.users |
| name      | text      |                                 |
| email     | text      |                                 |
| role      | text      | `admin` \| `teacher` \| `student` |
| created_at| timestamptz | Optional, default `now()`    |

If you already have `id, name, email, role`, that is enough. Add `created_at` if you want.

---

## 6. Security summary

- **Frontend:** Sends the logged-in user’s JWT in `Authorization: Bearer <token>`. No service_role key is ever used in the browser.
- **Edge Function:**
  - Validates the JWT (using `SUPABASE_ANON_KEY`).
  - Ensures the user has `role = 'admin'` in `public.users`.
  - Uses **service_role** only inside the function to call `auth.admin.createUser()` and insert into `public.users`.

---

## 7. How to use

1. Log in as an **admin** at **index.html**.
2. Go to **Admin** → **User Management** (or open **users.html**).
3. Open the site root or **index.html** (Bulk Import Users page).
4. Choose a CSV with columns: `name,email,password,role`.
5. Click **Upload and Create Users**.
6. Check the table for success/failure per user.

Example CSV is in **bulk-import-example.csv** (max 500 rows per file).

---

## 8. CORS when frontend is on Netlify

The Edge Function returns CORS headers and responds to **OPTIONS** with status **200**. Redeploy after changes: `npx supabase functions deploy bulk-create-users`.

## 9. Troubleshooting

| Issue | What to do |
|-------|------------|
| 401 Invalid token | Ensure `SUPABASE_ANON_KEY` is set and matches the project’s anon key. User must be logged in. |
| 403 Only admins can bulk create | Caller’s row in `public.users` must have `role = 'admin'`. |
| CORS errors | Edge Functions usually allow CORS; if not, add your site’s origin in the function’s CORS headers. |
| User created in Auth but not in `public.users` | Check RLS: service_role bypasses RLS, so the insert should succeed; confirm table and column names. |
| Rate limits | Creating users via Admin API in one function call avoids the normal sign-up rate limits; 500 users per request is supported. |
| `share-modal.js` addEventListener error | Comes from Netlify-injected script (e.g. share UI) looking for a missing element. Safe to ignore, or disable that feature in Netlify. |
