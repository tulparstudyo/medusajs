#requires -Version 5.1
<#
.SYNOPSIS
  Frontend (8000) ve backend (9000) durdur, derle, yeniden baslat.

.EXAMPLE
  .\restart.ps1
  .\restart.ps1 -Dev
#>
param(
  [switch]$Dev
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend = Join-Path $Root 'backend'
$Frontend = Join-Path $Root 'frontend'
$Ports = @(9000, 8000)

function Write-Step([string]$Message) {
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Get-ListenPids([int]$Port) {
  try {
    return @(
      Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique |
        Where-Object { $_ -and $_ -ne 0 }
    )
  } catch {
    return @()
  }
}

function Stop-ListenPort([int]$Port) {
  foreach ($procId in (Get-ListenPids $Port)) {
    Write-Host "  Port $Port : PID $procId kapatiliyor"
    & taskkill.exe /PID $procId /T /F 2>$null | Out-Null
  }
}

function Wait-PortFree([int]$Port, [int]$TimeoutSec = 25) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  do {
    if (-not (Get-ListenPids $Port)) { return }
    Start-Sleep -Milliseconds 400
  } while ((Get-Date) -lt $deadline)

  throw "Port $Port hala dolu. Sureci elle kapatip tekrar deneyin."
}

function Invoke-Pnpm([string]$Directory, [string]$ScriptName) {
  Push-Location $Directory
  try {
    & pnpm $ScriptName
    if ($LASTEXITCODE -ne 0) {
      throw "pnpm $ScriptName basarisiz ($Directory), kod: $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}

function Start-AppWindow([string]$Title, [string]$Directory, [string]$ScriptName) {
  $command = "`$Host.UI.RawUI.WindowTitle = '$Title'; pnpm $ScriptName"
  Start-Process -FilePath 'powershell.exe' -WorkingDirectory $Directory -ArgumentList @(
    '-NoExit',
    '-NoLogo',
    '-Command',
    $command
  )
}

Write-Step 'Frontend ve backend durduruluyor'
foreach ($port in $Ports) { Stop-ListenPort $port }
Start-Sleep -Seconds 1
foreach ($port in $Ports) {
  Stop-ListenPort $port
  Wait-PortFree $port
}

$scriptName = if ($Dev) { 'dev' } else { 'start' }

if (-not $Dev) {
  Write-Step 'Backend derleniyor'
  Invoke-Pnpm $Backend 'build'

  Write-Step 'Frontend derleniyor'
  Invoke-Pnpm $Frontend 'build'
}

Write-Step "Yeniden baslatiliyor (pnpm $scriptName)"
Start-AppWindow 'Medusa backend' $Backend $scriptName
Start-AppWindow 'Next frontend' $Frontend $scriptName

Write-Host "`nHazir. Backend http://localhost:9000/app  |  Vitrin http://localhost:8000/dk" -ForegroundColor Green
if ($Dev) {
  Write-Host 'Gelistirme modu: kaynak degisince yenilenir. Yayin icin parametresiz calistirin.' -ForegroundColor DarkGray
}
