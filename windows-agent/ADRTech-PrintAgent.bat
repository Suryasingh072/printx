<# :
@echo off
setlocal
title printx - Windows Desktop Spooler Agent
color 0b

:: Self-elevating or direct execution script that looks and behaves like an executable installer
echo ======================================================================
echo    printx - Windows Desktop Printing Agent v2.4
echo    Native Windows Spooler Connector for Shop Workstations
echo ======================================================================
echo.

set "APP_DIR=%USERPROFILE%\printx-PrintAgent"
if not exist "%APP_DIR%" mkdir "%APP_DIR%"
cd /d "%APP_DIR%"

echo [*] Initializing Windows Desktop Workstation components...
powershell -NoProfile -ExecutionPolicy Bypass -Command "& ([ScriptBlock]::Create((Get-Content -Path '%~f0' -Raw)))"
goto :eof
#>

$ErrorActionPreference = "SilentlyContinue"
$Host.UI.RawUI.WindowTitle = "printx - Desktop Print Agent"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "    printx - Windows Native Desktop Agent" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$WorkDir = Join-Path $env:USERPROFILE "printx-PrintAgent"
if (!(Test-Path $WorkDir)) {
    New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null
}
Set-Location $WorkDir

# Check if Python is installed
$PythonCmd = Get-Command python -ErrorAction SilentlyContinue

if (!$PythonCmd) {
    Write-Host "[!] Python is not installed or not in PATH." -ForegroundColor Yellow
    Write-Host "[*] Launching standalone Windows PowerShell Background Spooler..." -ForegroundColor Green
    Write-Host "This will connect directly to your shop printers without requiring Python!" -ForegroundColor Cyan
    Write-Host ""
}

# WinForms GUI in PowerShell (Works on 100% of Windows 10 & 11 PCs without installing anything!)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$Form = New-Object System.Windows.Forms.Form
$Form.Text = "printx - Windows Desktop Spooler Agent"
$Form.Size = New-Object System.Drawing.Size(720, 560)
$Form.StartPosition = "CenterScreen"
$Form.BackColor = [System.Drawing.Color]::FromArgb(248, 250, 252)

# Title
$TitleLabel = New-Object System.Windows.Forms.Label
$TitleLabel.Text = "printx Desktop Agent"
$TitleLabel.Font = New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)
$TitleLabel.Location = New-Object System.Drawing.Point(20, 15)
$TitleLabel.Size = New-Object System.Drawing.Size(400, 30)
$TitleLabel.ForeColor = [System.Drawing.Color]::FromArgb(15, 23, 42)
$Form.Controls.Add($TitleLabel)

# Status Badge
$StatusBadge = New-Object System.Windows.Forms.Label
$StatusBadge.Text = "Ready to Connect"
$StatusBadge.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$StatusBadge.Location = New-Object System.Drawing.Point(520, 18)
$StatusBadge.Size = New-Object System.Drawing.Size(160, 25)
$StatusBadge.TextAlign = "MiddleCenter"
$StatusBadge.BackColor = [System.Drawing.Color]::FromArgb(226, 232, 240)
$StatusBadge.ForeColor = [System.Drawing.Color]::FromArgb(71, 85, 105)
$Form.Controls.Add($StatusBadge)

# Server Input
$ServerLabel = New-Object System.Windows.Forms.Label
$ServerLabel.Text = "Shop Server URL:"
$ServerLabel.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$ServerLabel.Location = New-Object System.Drawing.Point(20, 60)
$ServerLabel.Size = New-Object System.Drawing.Size(120, 20)
$Form.Controls.Add($ServerLabel)

$ConfigFile = Join-Path $PSScriptRoot "printx-agent-config.json"
$SavedServer = "https://ais-dev-j4wzxf4ek3yadrvyzajprv-973482974092.asia-southeast1.run.app"
$SavedCode = ""
if (Test-Path $ConfigFile) {
    try {
        $cfg = Get-Content $ConfigFile -Raw | ConvertFrom-Json
        if ($cfg.server_url) { $SavedServer = $cfg.server_url }
        if ($cfg.pairing_code) { $SavedCode = $cfg.pairing_code }
    } catch {}
}

$ServerBox = New-Object System.Windows.Forms.TextBox
$ServerBox.Text = $SavedServer
$ServerBox.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$ServerBox.Location = New-Object System.Drawing.Point(140, 58)
$ServerBox.Size = New-Object System.Drawing.Size(540, 24)
$Form.Controls.Add($ServerBox)

# Pairing Code / Utility Key
$KeyLabel = New-Object System.Windows.Forms.Label
$KeyLabel.Text = "6-Digit Pair Code:"
$KeyLabel.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$KeyLabel.Location = New-Object System.Drawing.Point(20, 95)
$KeyLabel.Size = New-Object System.Drawing.Size(120, 20)
$Form.Controls.Add($KeyLabel)

$KeyBox = New-Object System.Windows.Forms.TextBox
$KeyBox.Text = $SavedCode
$KeyBox.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
$KeyBox.Location = New-Object System.Drawing.Point(140, 92)
$KeyBox.Size = New-Object System.Drawing.Size(160, 26)
$Form.Controls.Add($KeyBox)

# Printer Selection
$PrinterLabel = New-Object System.Windows.Forms.Label
$PrinterLabel.Text = "Target Printer:"
$PrinterLabel.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$PrinterLabel.Location = New-Object System.Drawing.Point(320, 95)
$PrinterLabel.Size = New-Object System.Drawing.Size(100, 20)
$Form.Controls.Add($PrinterLabel)

$PrinterBox = New-Object System.Windows.Forms.ComboBox
$PrinterBox.DropDownStyle = "DropDownList"
$PrinterBox.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$PrinterBox.Location = New-Object System.Drawing.Point(420, 92)
$PrinterBox.Size = New-Object System.Drawing.Size(260, 24)

# Detect Windows Printers natively
try {
    $Printers = Get-CimInstance Win32_Printer | Select-Object -ExpandProperty Name
    foreach ($p in $Printers) {
        $PrinterBox.Items.Add($p) | Out-Null
    }
} catch {
    $PrinterBox.Items.Add("Default Windows Printer") | Out-Null
}

if ($PrinterBox.Items.Count -gt 0) {
    $PrinterBox.SelectedIndex = 0
}
$Form.Controls.Add($PrinterBox)

# Connect Button
$ConnectBtn = New-Object System.Windows.Forms.Button
$ConnectBtn.Text = "Connect & Stay Online"
$ConnectBtn.Font = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Bold)
$ConnectBtn.Location = New-Object System.Drawing.Point(20, 135)
$ConnectBtn.Size = New-Object System.Drawing.Size(180, 36)
$ConnectBtn.BackColor = [System.Drawing.Color]::FromArgb(37, 99, 235)
$ConnectBtn.ForeColor = [System.Drawing.Color]::White
$ConnectBtn.FlatStyle = "Flat"
$Form.Controls.Add($ConnectBtn)

# Dedicated Logout / Disconnect Button
$LogoutBtn = New-Object System.Windows.Forms.Button
$LogoutBtn.Text = "Logout / Unpair"
$LogoutBtn.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$LogoutBtn.Location = New-Object System.Drawing.Point(210, 135)
$LogoutBtn.Size = New-Object System.Drawing.Size(130, 36)
$LogoutBtn.BackColor = [System.Drawing.Color]::FromArgb(241, 245, 249)
$LogoutBtn.ForeColor = [System.Drawing.Color]::FromArgb(100, 116, 139)
$LogoutBtn.FlatStyle = "Flat"
$Form.Controls.Add($LogoutBtn)

# Dry Run Checkbox
$DryRunBox = New-Object System.Windows.Forms.CheckBox
$DryRunBox.Text = "Test Simulation Mode (Print without paper)"
$DryRunBox.Font = New-Object System.Drawing.Font("Segoe UI", 8.5)
$DryRunBox.Location = New-Object System.Drawing.Point(360, 142)
$DryRunBox.Size = New-Object System.Drawing.Size(300, 24)
$DryRunBox.Checked = $false
$Form.Controls.Add($DryRunBox)

# Log Window
$LogBox = New-Object System.Windows.Forms.TextBox
$LogBox.Multiline = $true
$LogBox.ScrollBars = "Vertical"
$LogBox.ReadOnly = $true
$LogBox.Font = New-Object System.Drawing.Font("Consolas", 9)
$LogBox.BackColor = [System.Drawing.Color]::FromArgb(15, 23, 42)
$LogBox.ForeColor = [System.Drawing.Color]::FromArgb(56, 189, 248)
$LogBox.Location = New-Object System.Drawing.Point(20, 190)
$LogBox.Size = New-Object System.Drawing.Size(660, 300)
$Form.Controls.Add($LogBox)

function LogMessage($msg) {
    $time = (Get-Date).ToString("HH:mm:ss")
    $LogBox.AppendText("[$time] $msg`r`n")
}

LogMessage "ADRTech Windows Agent v2.5 initialized."
LogMessage "Detected local printers: $($PrinterBox.Items.Count) available."
LogMessage "Permanent 6-Digit Pairing Code connects 24/7 until you click 'Logout'."

# Timer for Background Job Polling
$Timer = New-Object System.Windows.Forms.Timer
$Timer.Interval = 4000
$Global:AgentToken = ""
$Global:IsConnected = $false
$Global:PairingCode = $SavedCode

function ConnectShopAgent($isSilent = $false) {
    $Server = $ServerBox.Text.Trim().TrimEnd('/')
    if ($Server -notmatch '^https?://') {
        $Server = "https://$Server"
        $ServerBox.Text = $Server
    }
    $Code = $KeyBox.Text.Trim()
    if ($Code.Length -lt 4) {
        if (!$isSilent) {
            [System.Windows.Forms.MessageBox]::Show("Please enter the 6-Digit Pairing Code from your Shop Dashboard.", "Input Required")
        }
        return
    }

    $Global:PairingCode = $Code
    LogMessage "Connecting to $Server with fixed code '$Code'..."

    try {
        $body = @{
            pairingCode = $Code
            deviceName = $env:COMPUTERNAME
        } | ConvertTo-Json

        $resp = Invoke-RestMethod -Uri "$Server/api/agent/pair" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 15

        if ($resp.token) {
            $Global:AgentToken = $resp.token
            $Global:IsConnected = $true

            # Save config permanently so restart/reboot reconnects automatically
            try {
                @{
                    server_url = $Server
                    pairing_code = $Code
                    agent_token = $resp.token
                } | ConvertTo-Json | Set-Content $ConfigFile -Force
            } catch {}

            $ConnectBtn.Text = "Connected (24/7)"
            $ConnectBtn.BackColor = [System.Drawing.Color]::FromArgb(16, 185, 129)
            $StatusBadge.Text = "Online (Connected)"
            $StatusBadge.BackColor = [System.Drawing.Color]::FromArgb(209, 250, 229)
            $StatusBadge.ForeColor = [System.Drawing.Color]::FromArgb(6, 95, 70)
            LogMessage "SUCCESS: Windows Agent paired and connected!"
            LogMessage "Active Shop: $($resp.shopId)"
            LogMessage "Continuous 24/7 spooler monitoring active..."
            $Timer.Start()
        }
    } catch {
        $errDetail = $_.Exception.Message
        LogMessage "Connection attempt note: $errDetail"
        if (!$isSilent) {
            [System.Windows.Forms.MessageBox]::Show("Connection note: $errDetail`n`nPlease verify your server URL and 6-digit code in Shop Dashboard.", "Connection")
        }
    }
}

$ConnectBtn.Add_Click({
    ConnectShopAgent($false)
})

# Explicit Logout handler
$LogoutBtn.Add_Click({
    $Timer.Stop()
    $Global:IsConnected = $false
    $Global:AgentToken = ""
    $Global:PairingCode = ""
    $KeyBox.Text = ""
    if (Test-Path $ConfigFile) {
        try { Remove-Item $ConfigFile -Force } catch {}
    }
    $ConnectBtn.Text = "Connect & Stay Online"
    $ConnectBtn.BackColor = [System.Drawing.Color]::FromArgb(37, 99, 235)
    $StatusBadge.Text = "Logged Out"
    $StatusBadge.BackColor = [System.Drawing.Color]::FromArgb(254, 226, 226)
    $StatusBadge.ForeColor = [System.Drawing.Color]::FromArgb(185, 28, 28)
    LogMessage "Logged out from shop. Device unlinked until new code is entered."
})

# Auto-connect immediately when form is displayed if code is saved!
$Form.Add_Shown({
    if ($SavedCode -and $SavedCode.Length -ge 4) {
        LogMessage "Found saved permanent 6-digit code '$SavedCode'. Auto-connecting now..."
        ConnectShopAgent($true)
    }
})

$Timer.Add_Tick({
    if (!$Global:IsConnected) { return }

    $Server = $ServerBox.Text.Trim().TrimEnd('/')
    $headers = @{
        "Authorization" = "Bearer $Global:AgentToken"
        "x-agent-token" = "$Global:AgentToken"
    }

    try {
        # 1. Send Heartbeat
        $hbBody = @{
            status = "online"
            activePrinter = $PrinterBox.Text
        } | ConvertTo-Json
        Invoke-RestMethod -Uri "$Server/api/agent/heartbeat" -Method Post -Headers $headers -Body $hbBody -ContentType "application/json" -TimeoutSec 5 | Out-Null

        # 2. Poll Jobs
        $jobsResp = Invoke-RestMethod -Uri "$Server/api/agent/jobs" -Method Get -Headers $headers -TimeoutSec 5
        if ($jobsResp.jobs -and $jobsResp.jobs.Count -gt 0) {
            foreach ($job in $jobsResp.jobs) {
                $jobId = $job.jobId
                $orderNum = $job.orderNumber
                $docName = $job.documentName

                LogMessage "NEW ORDER DETECTED: #$orderNum ($docName)"

                # Claim job
                $claimResp = Invoke-RestMethod -Uri "$Server/api/agent/jobs/$jobId/claim" -Method Post -Headers $headers -TimeoutSec 5
                $claimToken = $claimResp.claimToken

                if ($claimToken) {
                    LogMessage "Claimed #$orderNum. Spooling to '$($PrinterBox.Text)'..."

                    # Download file
                    $tmpFile = Join-Path $WorkDir "$orderNum-$docName"
                    Invoke-RestMethod -Uri "$Server/api/agent/jobs/$jobId/document?token=$claimToken" -Headers $headers -OutFile $tmpFile -TimeoutSec 15

                    if ($DryRunBox.Checked) {
                        LogMessage "[TEST MODE] Simulated print of $tmpFile completed."
                    } else {
                        # Physical Windows print command using shell print verb
                        Start-Process -FilePath $tmpFile -Verb Print -PassThru | Out-Null
                        LogMessage "[SPOOL SUCCESS] Sent #$orderNum directly to Windows printer."
                    }

                    # Report success
                    $report = @{ claimToken = $claimToken; status = "printed" } | ConvertTo-Json
                    Invoke-RestMethod -Uri "$Server/api/agent/jobs/$jobId/report" -Method Post -Headers $headers -Body $report -ContentType "application/json" -TimeoutSec 5 | Out-Null
                }
            }
        }
    } catch {
        # If server restarted or token expired, auto-re-pair using the permanent code so connection never breaks!
        $exMsg = $_.Exception.Message
        if ($exMsg -match "401" -or $exMsg -match "Unauthorized") {
            LogMessage "Token refreshed. Auto-re-authenticating with permanent code..."
            ConnectShopAgent($true)
        }
    }
})

[System.Windows.Forms.Application]::Run($Form)
