# Pi Provider Manager - one-click start
# Double-click start.bat, or run:
#   powershell -ExecutionPolicy Bypass -File E:\PiProviderManager\start.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$Url = "http://localhost:5173"
$ApiUrl = "http://127.0.0.1:8787"
$Port = 5173

Set-Location -LiteralPath $ProjectRoot

function Test-PortOpen {
    param([int]$PortNumber)
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $async = $client.BeginConnect("127.0.0.1", $PortNumber, $null, $null)
        $wait = $async.AsyncWaitHandle.WaitOne(400)
        $ok = $wait -and $client.Connected
        $client.Close()
        return $ok
    } catch {
        return $false
    }
}

function Wait-ForUrl {
    param(
        [string]$TargetUrl,
        [int]$TimeoutSec = 45
    )
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $TargetUrl -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return $true
            }
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
    return $false
}

# Console UTF-8 so Chinese messages render correctly
try {
    chcp 65001 | Out-Null
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

Write-Host ""
Write-Host "  Pi Provider Manager" -ForegroundColor DarkGreen
Write-Host "  $ProjectRoot" -ForegroundColor DarkGray
Write-Host ""

if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot "node_modules"))) {
    Write-Host "  First run: installing dependencies..." -ForegroundColor Yellow
    & npm.cmd install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  npm install failed" -ForegroundColor Red
        exit 1
    }
}

if (Test-PortOpen -PortNumber $Port) {
    Write-Host "  Already running, opening browser..." -ForegroundColor DarkGreen
    Start-Process $Url
    exit 0
}

Write-Host "  Starting dev server..." -ForegroundColor DarkGreen

$npmPath = $null
foreach ($name in @("npm.cmd", "npm.exe", "npm")) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd) {
        $npmPath = $cmd.Source
        break
    }
}

if (-not $npmPath) {
    Write-Host "  npm not found. Install Node.js first." -ForegroundColor Red
    if ($Host.Name -eq "ConsoleHost") { Read-Host "Press Enter to exit" | Out-Null }
    exit 1
}

$startArgs = @{
    FilePath         = $npmPath
    ArgumentList     = @("run", "dev")
    WorkingDirectory = $ProjectRoot
    PassThru         = $true
    WindowStyle      = "Minimized"
}
$proc = Start-Process @startArgs

Write-Host "  Waiting for Vite $Url ..." -ForegroundColor DarkGray
$viteReady = Wait-ForUrl -TargetUrl $Url
Write-Host "  Waiting for API $ApiUrl ..." -ForegroundColor DarkGray
$apiReady = Wait-ForUrl -TargetUrl "$ApiUrl/api/meta"

if ($viteReady -and $apiReady) {
    Write-Host "  Opened $Url" -ForegroundColor DarkGreen
    Write-Host "  API: $ApiUrl" -ForegroundColor DarkGray
    Write-Host "  Closing this window does NOT stop the server." -ForegroundColor DarkGray
    Start-Process $Url
} elseif ($viteReady -and -not $apiReady) {
    Write-Host "  Vite is up, but API on :8787 did not respond." -ForegroundColor Yellow
    Write-Host "  Check the minimized npm window for server errors, then refresh the page." -ForegroundColor Yellow
    Write-Host "  PID: $($proc.Id)" -ForegroundColor DarkGray
    Start-Process $Url
} else {
    Write-Host "  Startup timed out. Check the minimized npm window." -ForegroundColor Yellow
    Write-Host "  PID: $($proc.Id)" -ForegroundColor DarkGray
    if ($Host.Name -eq "ConsoleHost") { Read-Host "Press Enter to exit" | Out-Null }
    exit 1
}