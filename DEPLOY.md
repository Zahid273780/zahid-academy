# How to deploy Zahid2 (Zahid Academy) to Cloudflare Pages

You have fixed the form page and the project is ready. Follow these steps to deploy.

---

## 1. Push your code to GitHub

Your Cloudflare site is connected to: **https://github.com/Zahid273780/zahid-academy**

1. Open **Command Prompt** or **PowerShell** in the project folder:
   ```powershell
   cd "D:\Zahid School Management\Zahid2"
   ```

2. If this folder is **not** yet a git repo, run:
   ```powershell
   git init
   git remote add origin https://github.com/Zahid273780/zahid-academy.git
   ```

3. Add everything, commit, and push:
   ```powershell
   git add .
   git status
   git commit -m "Deploy: form fix, share-modal fix, ready for Cloudflare"
   git branch -M main
   git push -u origin main
   ```
   If the repo already has a different default branch (e.g. `master`), use that instead of `main`. If you get “nothing to commit”, you have no new changes; that’s fine.

**Important:** The **root** of what you push must contain:
- All your HTML/JS/CSS (e.g. `form.html`, `form.js`, `login.html`, `dashboard.html`, etc.)
- The **`functions`** folder (with `functions/api/login-form-submit.js` and other API files)

So either:
- Push the **contents** of `Zahid2` as the repo root (recommended), or  
- Push from the folder that has `Zahid2` as a subfolder only if your GitHub repo root is that parent and already includes `functions` at root.

---

## 2. Cloudflare Pages project settings

1. Go to **https://dash.cloudflare.com** → **Workers & Pages** → your project (**zahidacademy1** or the one that gives **e06132c4.zahidacademy1.pages.dev**).

2. **Build configuration**
   - **Framework preset:** None (or “Direct Upload” if you deploy with Wrangler only).
   - **Build command:** **`npm install`** (required so Pages Functions can resolve `@supabase/supabase-js`).
   - **Build output directory:** **`.`** (root).  
   Cloudflare must see the **repo root** (where `functions/` lives), not a subfolder like `dist` or `build`.

3. **Environment variables** (required for the form and APIs)
   - Go to **Settings** → **Environment variables**.
   - Add for **Production** (and optionally Preview):

   | Name                         | Value                    | Encrypt |
   |-----------------------------|--------------------------|--------|
   | `SUPABASE_URL`              | Your Supabase project URL | ✓      |
   | `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key | ✓  |

   You find these in Supabase: **Project settings** → **API** (URL and `service_role` key).  
   Without these, the student form and other APIs will return 500 or fail.

4. **Save** and go to **Deployments**.

---

## 3. Deploy

**Option A – Automatic (Git)**  
- Push to the branch that Cloudflare is watching (e.g. `main`).  
- A new deployment starts automatically.  
- Wait until it finishes; then open **https://e06132c4.zahidacademy1.pages.dev** (or your custom domain).

**Option B – From terminal (Wrangler)**  
- Install and log in once:
  ```powershell
  cd "D:\Zahid School Management\Zahid2"
  npm install
  npx wrangler pages login
  ```
- Link the project (first time only; use your Cloudflare account and project name):
  ```powershell
  npx wrangler pages project create zahidacademy1
  ```
- Deploy:
  ```powershell
  npx wrangler pages deploy . --project-name=zahidacademy1
  ```
  Use the exact project name from the Cloudflare dashboard if different.

---

## 4. Check that it worked

1. Open the live site and go to the **student fill form** page.
2. Submit a test request (use a unique username).  
   - If you see “Request saved. Your teacher will share your login ID.” → form and API are working.  
   - If you see 405 or “Form submission is not available…” → see **CLOUDFLARE-FORM-API.md** (repo root must include `functions/`, env vars set, then redeploy).

---

## Summary

| Step | What to do |
|------|------------|
| 1 | Push Zahid2 (with `functions/` at root) to **github.com/Zahid273780/zahid-academy** |
| 2 | In Cloudflare Pages: **Build command** = `npm install`, **Build output** = `.`, add **SUPABASE_URL** and **SUPABASE_SERVICE_ROLE_KEY** |
| 3 | Deploy (auto on push, or `npx wrangler pages deploy .`) |
| 4 | Test the form on the live URL |

The issues we fixed (share-modal error and form submit message) are already in the code; deploying with the steps above will put that version live.
