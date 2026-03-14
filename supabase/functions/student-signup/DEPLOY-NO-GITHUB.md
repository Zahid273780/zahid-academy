# Deploy student-signup Edge Function (no GitHub)

Your form already calls this function at:
`https://uygtxlehwtgaftcwsxrr.supabase.co/functions/v1/student-signup`

## Option A: Supabase Dashboard (easiest, no CLI)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Edge Functions** in the left sidebar.
3. Click **Deploy a new function** → **Via Editor**.
4. Name the function: `student-signup`.
5. Delete the template code and paste in the contents of `index.ts` from this folder.
6. Click **Deploy function**.

Done. The form will use this API when students sign up (no folder/zip deploy needed).

## Option B: Supabase CLI (from your PC)

1. Install [Supabase CLI](https://supabase.com/docs/guides/cli) and run:
   ```bash
   supabase login
   supabase link --project-ref uygtxlehwtgaftcwsxrr
   ```
2. From your project root (where `supabase` folder is):
   ```bash
   supabase functions deploy student-signup
   ```

No GitHub is required for either option. The function uses your project’s **service role** key automatically (set by Supabase).
