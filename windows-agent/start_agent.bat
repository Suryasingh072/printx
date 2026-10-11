@echo off
setlocal enabledelayedexpansion
title ADRTech PrintQR - Windows Desktop Spooler Agent
color 0b

echo ======================================================================
echo    ADRTech PrintQR - Windows Desktop Printing Agent v2.0
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
echo [*] Checking dependencies (requests, PySide6, pywin32)...
echo.

python -c "import requests, PySide6" >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [*] Installing required components (one-time setup)...
    python -m pip install --upgrade pip
    pip install requests PySide6 pywin32
    if %ERRORLEVEL% neq 0 (
        echo [!] PySide6 installation encountered an issue, trying minimal fallback...
        pip install requests pywin32
    )
)

echo.
echo ======================================================================
echo [*] Starting ADRTech Desktop Agent in Shop Counter Mode...
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
