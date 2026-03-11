# Run and test HTML locally

## Option A: Full app (login, API, everything) – Wrangler

**Requires free disk space.** If you see `ENOSPC: no space left on device`, free space on your C: drive first.

1. Open **PowerShell** (or Terminal).
2. Go to the project folder:
   ```powershell
   cd "d:\Zahid School Management\Zahid2"
   ```
3. Start the dev server:
   ```powershell
   npm run dev
   ```
   Or:
   ```powershell
   npx wrangler pages dev .
   ```
4. Wait until you see: **Ready on http://127.0.0.1:8788**
5. In your browser open: **http://127.0.0.1:8788**
   - You can also try: **http://127.0.0.1:8788/login.html**

Use **http://127.0.0.1:8788** (not `localhost` if that fails). Do **not** open the HTML files with `file://` — that will not work.

---

## Option B: Static only (just to view pages) – no API

If Wrangler fails or you only want to open the HTML/JS:

1. Open PowerShell in the project folder:
   ```powershell
   cd "d:\Zahid School Management\Zahid2"
   ```
2. Run:
   ```powershell
   npm run dev:static
   ```
3. In the browser open: **http://localhost:3000/login.html**
   - Or: http://localhost:3000/dashboard.html, http://localhost:3000/portal.html, etc.

**Note:** With this, `/api/*` (login, subscription, etc.) will not work. Use this only to check layout and navigation. For full login and API, use Option A or deploy to Cloudflare.

---

## If “none of these work”

1. **Disk space:** Free at least 500 MB on the drive where the project and npm cache live (often C:). Then try Option A again.
2. **URL:** Use the exact URL from the terminal (e.g. **http://127.0.0.1:8788** or **http://localhost:3000**), including the port.
3. **No file://:** Always use `http://127.0.0.1:...` or `http://localhost:...`. Opening the `.html` file from Explorer (file://) will not run the app correctly.
4. **Firewall:** If the page never loads, allow Node/terminal app through Windows Firewall, or temporarily disable it to test.
5. **Browser:** Try a different browser or an incognito/private window in case an extension is blocking.
