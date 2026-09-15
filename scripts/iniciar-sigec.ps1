#Requires -Version 5.1
<#
.SYNOPSIS
  Arranque controlado de SIGEC-IGSS (backend + frontend) en Windows.
.DESCRIPTION
  Verifica prerrequisitos, instala dependencias si faltan, libera puertos,
  inicia servicios, espera respuestas HTTP reales y abre el navegador.
#>
[CmdletBinding()]
param(
  [int]$BackendPort = 3001,
  [int]$FrontendPort = 3003,
  [int]$DbPort = 5432,
  [int]$BackendTimeoutSec = 90,
  [int]$FrontendTimeoutSec = 180
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
$BackendDir = Join-Path $Root 'backend'
$FrontendDir = Join-Path $Root 'frontend'
$LogDir = Join-Path $Root 'logs'
$LogFile = Join-Path $LogDir ("inicio-sigec-{0:yyyyMMdd-HHmmss}.log" -f (Get-Date))
$LoginUrl = "http://localhost:$FrontendPort/login"
$ApiUrl = "http://localhost:$BackendPort/api"

function Write-Log {
  param([string]$Message, [string]$Level = 'INFO')
  $line = "[{0:HH:mm:ss}] [{1}] {2}" -f (Get-Date), $Level, $Message
  Write-Host $line
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

function Write-Ok($Message) { Write-Log $Message 'OK' }
function Write-WarnLog($Message) { Write-Log $Message 'AVISO' }
function Write-Fail($Message) { Write-Log $Message 'ERROR' }

function Fail-AndExit {
  param([string]$Message, [int]$Code = 1)
  Write-Fail $Message
  Write-Host ''
  Write-Host "Revise el registro: $LogFile"
  Write-Host 'Si las ventanas de Backend/Frontend ya se abrieron, ciérrelas y vuelva a intentar.'
  Write-Host ''
  Read-Host 'Pulse Enter para salir'
  exit $Code
}

function Test-CommandExists([string]$Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-ListeningPids([int]$Port) {
  # Emite enteros uno a uno. El llamador DEBE capturar con @(...).
  # No usar "return , @(...)" (anida arrays y StrictMode rompe Stop-Process -Id).
  $seen = @{}
  try {
    foreach ($c in @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)) {
      $procId = 0
      try { $procId = [int]$c.OwningProcess } catch { continue }
      if ($procId -gt 0 -and -not $seen.ContainsKey($procId)) {
        $seen[$procId] = $true
        $procId
      }
    }
  } catch {
    foreach ($line in @(netstat -ano | Select-String ":$Port\s+.+LISTENING")) {
      $parts = @(($line.Line -split '\s+') | Where-Object { $_ })
      if ($parts.Count -eq 0) { continue }
      $candidate = $parts[-1]
      if ($candidate -match '^\d+$') {
        $procId = [int]$candidate
        if ($procId -gt 0 -and -not $seen.ContainsKey($procId)) {
          $seen[$procId] = $true
          $procId
        }
      }
    }
  }
}

function Stop-ListeningPort([int]$Port) {
  $pids = @(Get-ListeningPids $Port | ForEach-Object { [int]$_ } | Where-Object { $_ -gt 0 } | Select-Object -Unique)
  if ($pids.Count -eq 0) {
    Write-Ok "Puerto $Port libre"
    return
  }
  foreach ($procId in $pids) {
    $id = [int]$procId
    try {
      $proc = Get-Process -Id $id -ErrorAction Stop
      Write-WarnLog "Puerto $Port ocupado por PID $id ($($proc.ProcessName)). Se cierra para evitar conflictos."
      Stop-Process -Id $id -Force -ErrorAction Stop
    } catch {
      Write-WarnLog "No se pudo cerrar PID $id en puerto $Port : $($_.Exception.Message)"
    }
  }
  Start-Sleep -Seconds 2
  $still = @(Get-ListeningPids $Port | ForEach-Object { [int]$_ } | Where-Object { $_ -gt 0 } | Select-Object -Unique)
  if ($still.Count -gt 0) {
    Fail-AndExit "El puerto $Port sigue ocupado (PID: $($still -join ', ')). Ciérrelo manualmente e intente de nuevo."
  }
  Write-Ok "Puerto $Port liberado"
}

function Test-TcpPort([string]$HostName, [int]$Port, [int]$TimeoutMs = 1500) {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect($HostName, $Port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne($TimeoutMs, $false)
    if (-not $ok) {
      $client.Close()
      return $false
    }
    $client.EndConnect($iar)
    $client.Close()
    return $true
  } catch {
    return $false
  }
}

function Wait-HttpReady {
  param(
    [scriptblock]$Probe,
    [int]$TimeoutSec,
    [string]$Label
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  Write-Log "Esperando $Label (hasta $TimeoutSec s)..."
  while ((Get-Date) -lt $deadline) {
    try {
      if (& $Probe) {
        Write-Ok "$Label listo"
        return $true
      }
    } catch { }
    Start-Sleep -Seconds 2
  }
  return $false
}

function Test-BackendReady {
  try {
    $body = '{}'
    $resp = Invoke-WebRequest -Uri "$ApiUrl/auth/login" -Method POST -ContentType 'application/json' -Body $body -UseBasicParsing -TimeoutSec 4
    return ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500)
  } catch {
    $status = $null
    try { $status = [int]$_.Exception.Response.StatusCode } catch { }
    return ($status -ge 400 -and $status -lt 500)
  }
}

function Test-FrontendReady {
  try {
    $resp = Invoke-WebRequest -Uri "http://localhost:$FrontendPort" -UseBasicParsing -TimeoutSec 5
    return ($resp.StatusCode -eq 200)
  } catch {
    return $false
  }
}

function Ensure-NpmModules([string]$Dir, [string]$Name) {
  $nm = Join-Path $Dir 'node_modules'
  if (Test-Path $nm) {
    Write-Ok "Dependencias de $Name presentes"
    return
  }
  Write-Log "Instalando dependencias de $Name (puede tardar)..."
  Push-Location $Dir
  try {
    $proc = Start-Process -FilePath 'npm.cmd' -ArgumentList 'install' -Wait -PassThru -NoNewWindow
    if ($proc.ExitCode -ne 0) {
      Fail-AndExit "npm install falló en $Name (código $($proc.ExitCode))."
    }
  } finally {
    Pop-Location
  }
  Write-Ok "Dependencias de $Name instaladas"
}

function Test-EnvFile {
  $envPath = Join-Path $BackendDir '.env'
  if (-not (Test-Path $envPath)) {
    Fail-AndExit "Falta backend\.env. Copie backend\.env.example a backend\.env y configure DB_* y JWT_SECRET."
  }
  $content = Get-Content $envPath -Raw -ErrorAction Stop
  $required = @('DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'JWT_SECRET')
  $missing = @()
  foreach ($key in $required) {
    if ($content -notmatch "(?m)^\s*$key\s*=") {
      $missing += $key
    }
  }
  if (@($missing).Count -gt 0) {
    Fail-AndExit "backend\.env incompleto. Faltan: $($missing -join ', ')."
  }
  Write-Ok 'backend\.env encontrado y con variables mínimas'
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
Write-Host ''
Write-Host ' ============================================'
Write-Host '  SIGEC-IGSS  |  Arranque controlado'
Write-Host ' ============================================'
Write-Host ''
Write-Log "Registro: $LogFile"
Write-Log "Raíz: $Root"

if (-not (Test-Path (Join-Path $BackendDir 'package.json'))) {
  Fail-AndExit 'No se encontró backend\package.json. Ejecute el lanzador desde el proyecto SIGEC-IGSS.'
}
if (-not (Test-Path (Join-Path $FrontendDir 'package.json'))) {
  Fail-AndExit 'No se encontró frontend\package.json.'
}

if (-not (Test-CommandExists 'node')) {
  Fail-AndExit 'Node.js no está en el PATH. Instale Node.js LTS desde https://nodejs.org'
}
if (-not (Test-CommandExists 'npm')) {
  Fail-AndExit 'npm no está en el PATH.'
}

$nodeVersion = (& node -v 2>$null)
Write-Ok "Node.js $nodeVersion"

Test-EnvFile

if (Test-TcpPort '127.0.0.1' $DbPort) {
  Write-Ok "PostgreSQL responde en localhost:$DbPort"
} else {
  Write-WarnLog "PostgreSQL no responde en localhost:$DbPort. El backend fallará hasta que inicie el servicio."
  $cont = Read-Host '¿Desea continuar de todos modos? (S/N)'
  if ($cont -notmatch '^[sS]$') {
    Fail-AndExit 'Arranque cancelado. Inicie PostgreSQL e intente de nuevo.' 2
  }
}

Ensure-NpmModules $BackendDir 'backend'
Ensure-NpmModules $FrontendDir 'frontend'

Write-Log 'Liberando puertos de trabajo...'
Stop-ListeningPort $BackendPort
Stop-ListeningPort $FrontendPort

Write-Log "Iniciando backend (npm start) en puerto $BackendPort..."
$backendCmd = "title SIGEC-Backend && cd /d `"$BackendDir`" && echo [SIGEC] Backend - no cierre esta ventana && npm start"
Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', $backendCmd -WindowStyle Minimized

if (-not (Wait-HttpReady -Probe { Test-BackendReady } -TimeoutSec $BackendTimeoutSec -Label 'API backend')) {
  Fail-AndExit "El backend no respondió en $BackendTimeoutSec s. Abra la ventana SIGEC-Backend y revise el error (BD, .env o puerto)."
}

Write-Log "Iniciando frontend (npm start) en puerto $FrontendPort..."
$frontendCmd = "title SIGEC-Frontend && cd /d `"$FrontendDir`" && echo [SIGEC] Frontend - no cierre esta ventana && npm start"
Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', $frontendCmd -WindowStyle Minimized

if (-not (Wait-HttpReady -Probe { Test-FrontendReady } -TimeoutSec $FrontendTimeoutSec -Label 'Frontend')) {
  Fail-AndExit "El frontend no respondió en $FrontendTimeoutSec s. Abra la ventana SIGEC-Frontend (la primera compilación puede tardar)."
}

try {
  Start-Process $LoginUrl | Out-Null
  Write-Ok "Navegador: $LoginUrl"
} catch {
  Write-WarnLog "No se pudo abrir el navegador automáticamente. Abra $LoginUrl"
}

Write-Host ''
Write-Host ' Servicios activos'
Write-Host "   Backend : $ApiUrl"
Write-Host "   Frontend: $LoginUrl"
Write-Host ''
Write-Host ' Para detener: ejecute DETENER-SIGEC.bat o cierre las ventanas SIGEC-Backend y SIGEC-Frontend.'
Write-Host ''
Read-Host 'Pulse Enter para cerrar este lanzador (los servicios siguen corriendo)'
exit 0
