# Fix 405 on api/login-form-submit

A **405** means the request never reaches your Function — Cloudflare’s asset server (which doesn’t handle POST) is answering. Do these checks in order.

---

## 1. Confirm `functions` is on GitHub

1. Open **https://github.com/Zahid273780/zahid-academy**
2. Make sure you see a **`functions`** folder at the **root** of the repo.
3. Open **`functions`** → **`api`** → you should see **`login-form-submit.js`**.

If `functions` or `functions/api/login-form-submit.js` is **missing**:

- In your project folder run:
  ```cmd
  cd "D:\Zahid School Management\Zahid2"
  git add functions/
  git status
  git commit -m "Add functions folder for API"
  git push origin main
  ```
- Then in Cloudflare, wait for the new deployment to finish and test again.

---

## 2. Cloudflare Pages build settings

1. Go to **https://dash.cloudflare.com** → **Workers & Pages** → your project.
2. Open **Settings** → **Builds & deployments** → **Build configuration**.
3. Set:
   - **Root directory:** leave **empty** (or `/`).
   - **Build command:** leave **empty** (unless you use a build step).
   - **Build output directory:** leave **empty** (or `.`).

So Cloudflare uses the **repo root** (where `functions/` lives), not a subfolder.

4. **Save** and go to **Deployments**.

---

## 3. Environment variables (required for Git deploys)

Cloudflare **does not** use `wrangler.toml` for Git-based deploys. You must set env vars in the dashboard:

1. In the same project: **Settings** → **Environment variables**.
2. For **Production** (and Preview if you use it), add:

| Name                         | Value                          |
|-----------------------------|---------------------------------|
| `SUPABASE_URL`              | Your Supabase project URL       |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key  |

3. **Save**.

Without these, the Function can return 500; with a wrong setup you can still see 405 if the Function isn’t invoked.

---

## 4. Redeploy

- **Deployments** tab → **…** on the latest deployment → **Retry deployment**,  
  or push an empty commit to trigger a new build:
  ```cmd
  cd "D:\Zahid School Management\Zahid2"
  git commit --allow-empty -m "Trigger redeploy"
  git push origin main
  ```
- Wait until the new deployment shows **Success**, then test the form again.

---

## 5. Deploy with Wrangler (to test that Functions work)

If Git deploy still returns 405, deploy from your machine so we know the same project works:

1. Install and log in (once):
   ```cmd
   cd "D:\Zahid School Management\Zahid2"
   npm install
   npx wrangler pages login
   ```
2. Deploy:
   ```cmd
   npx wrangler pages deploy . --project-name=zahidacademy1
   ```
   Use the exact project name from the Cloudflare dashboard if it’s different.

3. Test the form on the live URL again.

If it works after a Wrangler deploy but not after a Git deploy, the problem is with the **Git build configuration** (root/output directory or branch). If it still returns 405 after Wrangler deploy, the issue is project or account configuration (e.g. Pages plan, project name).

---

## Summary

| Check              | What to do |
|--------------------|------------|
| Functions in repo? | On GitHub: repo root must contain `functions/api/login-form-submit.js`. |
| Build config       | Root directory and Build output directory **empty** (or `.`) so repo root is used. |
| Env vars           | In dashboard: set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for Production. |
| Redeploy           | Retry deployment or push an empty commit, then test again. |
| Last resort        | Deploy with `npx wrangler pages deploy .` and test. |
