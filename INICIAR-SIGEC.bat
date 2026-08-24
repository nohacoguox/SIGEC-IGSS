@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title SIGEC-IGSS - Lanzador

where powershell >nul 2>&1
if errorlevel 1 (
  echo [ERROR] PowerShell no esta disponible en este equipo.
  pause
  exit /b 1
)

if not exist "%~dp0scripts\iniciar-sigec.ps1" (
  echo [ERROR] No se encontro scripts\iniciar-sigec.ps1
  echo         Ejecute este archivo desde la carpeta del proyecto SIGEC-IGSS.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\iniciar-sigec.ps1"
set "ERR=%ERRORLEVEL%"
if not "%ERR%"=="0" (
  echo.
  echo [ERROR] El arranque termino con codigo %ERR%.
  pause
)
endlocal
exit /b %ERR%
