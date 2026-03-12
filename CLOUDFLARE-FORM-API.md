# Student form & Cloudflare Pages (405 fix)

If the **student fill form** shows "Could not submit" and the browser reports **405** for `api/login-form-submit`, the API is not running on Cloudflare Pages.

## Requirements

1. **`functions` folder at repo root**  
   Cloudflare Pages only runs Functions when the `functions` directory is at the **root** of the connected repository (e.g. `zahid-academy`), not inside a build output folder.

   Required structure:
   ```
   your-repo/
   ├── form.html
   ├── form.js
   ├── functions/
   │   └── api/
   │       └── login-form-submit.js
   └── ... other files
   ```

2. **Environment variables**  
   In Cloudflare Pages → your project → **Settings** → **Environment variables**, set:
   - `SUPABASE_URL` – your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` – Supabase service role key (keep secret)

3. **No build output hiding the repo root**  
   If you use a build step, the **root** of the repo (where `functions/` lives) must still be the project root in the Cloudflare Pages settings. Do not set "Build output directory" to a folder that is the only thing deployed; Pages needs the repo root so it can see `functions/`.

## After changing the repo

Redeploy the project (e.g. push to the connected branch or trigger a deploy in the Cloudflare dashboard). The form should then submit without 405.
