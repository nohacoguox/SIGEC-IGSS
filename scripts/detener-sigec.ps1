#Requires -Version 5.1
[CmdletBinding()]
param(
  [int]$BackendPort = 3001,
  [int]$FrontendPort = 3003
)

$ErrorActionPreference = 'Continue'
Write-Host ''
Write-Host ' SIGEC-IGSS  |  Detener servicios locales'
Write-Host ''

function Stop-Port([int]$Port) {
  $stopped = $false
  try {
    $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($c in @($conns)) {
      if ($c.OwningProcess -gt 0) {
        Write-Host "  Cerrando PID $($c.OwningProcess) en puerto $Port"
        Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
        $stopped = $true
      }
    }
  } catch { }
  if (-not $stopped) {
    Write-Host "  Puerto $Port ya estaba libre"
  }
}

Get-Process cmd, node -ErrorAction SilentlyContinue | Where-Object {
  $_.MainWindowTitle -match 'SIGEC-Backend|SIGEC-Frontend'
} | ForEach-Object {
  Write-Host "  Cerrando ventana $($_.MainWindowTitle) (PID $($_.Id))"
  Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

Stop-Port $BackendPort
Stop-Port $FrontendPort
Start-Sleep -Seconds 1
Write-Host ''
Write-Host ' Listo.'
Write-Host ''
Read-Host 'Pulse Enter para salir'
