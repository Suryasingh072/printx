@echo off
setlocal enabledelayedexpansion
title printx - Windows Desktop Spooler Agent
color 0b

echo ======================================================================
echo    printx - Windows Desktop Printing Agent v2.4
echo    Automated Real-Time Windows Spooler for Local Print Shops
echo ======================================================================
echo.

:: 1. Check Python installation
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python is not detected on your system.
    echo Please install Python 3.9+ from https://www.python.org/downloads/
    echo (Make sure to check "Add Python to PATH" during installation)
    echo.
    echo Press any key to open the Python download page...
    pause >nul
    start https://www.python.org/downloads/
    exit /b 1
)

echo [*] Python detected successfully.
echo.

:: 2. Install required dependencies
echo [*] Checking required Python dependencies...
python -m pip install --upgrade pip --quiet
pip install -r "%~dp0requirements.txt" --quiet
if %ERRORLEVEL% neq 0 (
    echo [!] Installing core dependencies directly...
    pip install requests PySide6 pywin32 --quiet
)

echo [*] Dependencies verified.
echo.

echo ======================================================================
echo [*] Starting printx Desktop Agent in Shop Counter Mode...
echo ======================================================================
echo.

if exist "agent.py" (
    python agent.py
) else (
    echo [!] agent.py not found in current folder.
    echo Downloading latest agent script from cloud...
    powershell -Command "Invoke-WebRequest -Uri '%~1/api/agent/download-script' -OutFile 'agent.py'"
    python agent.py
)

pause
