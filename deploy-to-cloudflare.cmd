@echo off
cd /d "D:\Zahid School Management\Zahid2"
echo Installing dependencies...
call npm install
echo.
echo Deploying to Cloudflare Pages...
call npx wrangler pages deploy . --project-name=zahidacademy1
echo.
pause
