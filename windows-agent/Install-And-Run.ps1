# printx - Windows Desktop Setup & Runner (PowerShell 1-Liner)
param (
    [string]$ServerUrl = "https://your-shop.printqr.in"
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "    printx - Windows Desktop Agent Setup" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

$AppDir = Join-Path $env:USERPROFILE "printx-PrintAgent"
if (!(Test-Path $AppDir)) {
    New-Item -ItemType Directory -Force -Path $AppDir | Out-Null
}

Set-Location $AppDir
Write-Host "[*] Working directory: $AppDir" -ForegroundColor Gray

# Download agent script
$ScriptPath = Join-Path $AppDir "agent.py"
Write-Host "[*] Fetching latest Windows Agent core..." -ForegroundColor Gray
try {
    Invoke-WebRequest -Uri "$ServerUrl/api/agent/download-script" -OutFile $ScriptPath
} catch {
    Write-Host "[!] Note: Could not download fresh script directly, using local copy if present." -ForegroundColor Yellow
}

# Check Python
$PythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (!$PythonCmd) {
    Write-Host "[!] Python not found on PATH. Attempting Microsoft Store Python or standard installer..." -ForegroundColor Red
    Write-Host "Please download Python from: https://www.python.org/downloads/ (Check 'Add to PATH')" -ForegroundColor Yellow
    Start-Process "https://www.python.org/downloads/"
    exit
}

Write-Host "[*] Checking Python dependencies (requests, PySide6, pywin32)..." -ForegroundColor Green
& python -m pip install --quiet --upgrade pip
& pip install --quiet requests PySide6 pywin32

Write-Host "[*] Launching printx Windows Spooler Desktop Agent..." -ForegroundColor Cyan
& python agent.py
