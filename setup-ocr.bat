@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Image to Text Converter - Setup
echo ========================================
echo.

REM Step 1: Check if Python is available
echo [Step 1/3] Checking if Python is installed...
python --version >nul 2>&1
if %errorlevel%==0 (
  echo Python is installed!
  python --version
  goto install_packages
)

echo.
echo ERROR: Python is NOT installed globally.
echo.
echo SOLUTION: Install Python from https://www.python.org/downloads/
echo   1. Download Python 3.12
echo   2. RUN THE INSTALLER
echo   3. CHECK the "Add Python to PATH" checkbox (bottom left)
echo   4. Click "Install Now"
echo   5. Wait for installation to complete
echo   6. Close the installer
echo   7. Open a NEW command prompt and run this batch file again
echo.
echo After Python is installed in PATH, this script will:
echo   - Install pytesseract and pillow packages
echo   - Help you set up Tesseract OCR
echo.
pause
exit /b 1

:install_packages
echo.
echo [Step 2/3] Installing Python packages...
python -m pip install --upgrade pip --quiet
python -m pip install pytesseract pillow --quiet

if %errorlevel% neq 0 (
  echo ERROR: Failed to install Python packages
  pause
  exit /b 1
)

echo Python packages installed successfully!

echo.
echo [Step 3/3] Next: Install Tesseract OCR
echo.
echo Download Tesseract OCR from:
echo https://github.com/UB-Mannheim/tesseract/wiki
echo.
echo Get the Windows version: tesseract-ocr-w64-setup-v5.3.1.exe
echo.
echo Then run the installer and accept all defaults.
echo.
echo After Tesseract is installed, your ocr_one_click.bat will work!
echo.
pause
