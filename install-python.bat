@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Installing Python and OCR Packages
echo ========================================
echo.

REM Check if Python is already installed
where python >nul 2>&1
if %errorlevel%==0 (
  echo Python is already installed!
  python --version
  goto install_packages
)

echo Python not found. Attempting to install...
echo.
echo Option 1: Using winget to install Python
echo.

winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements

REM Refresh environment
call "%programfiles%\Python312\python.exe" --version >nul 2>&1
if %errorlevel%==0 (
  setx PATH "%PATH%;%programfiles%\Python312"
  echo Python installed successfully!
  goto install_packages
)

echo.
echo ERROR: Could not install Python automatically.
echo Please install Python manually from: https://www.python.org/downloads/
echo - Download the Windows 64-bit installer
echo - IMPORTANT: Check 'Add Python to PATH' during installation
echo.
pause
exit /b 1

:install_packages
echo.
echo Installing required Python packages...
python -m pip install --upgrade pip --quiet
python -m pip install pytesseract pillow --quiet

if %errorlevel%==0 (
  echo.
  echo SUCCESS! Python and packages are installed.
  echo.
  echo Next steps:
  echo 1. Download Tesseract OCR from: https://github.com/UB-Mannheim/tesseract/wiki
  echo 2. Install it
  echo 3. Then use ocr_one_click.bat to convert images to text
  echo.
) else (
  echo ERROR: Could not install Python packages.
)

pause

