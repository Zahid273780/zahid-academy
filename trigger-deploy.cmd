@echo off
cd /d "D:\Zahid School Management\Zahid2"
git commit --allow-empty -m "Trigger Cloudflare redeploy"
git push origin main
echo.
echo Done. Check Cloudflare Deployments - a new build should start in a minute.
pause
