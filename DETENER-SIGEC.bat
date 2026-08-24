@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title SIGEC-IGSS - Detener

if not exist "%~dp0scripts\detener-sigec.ps1" (
  echo [ERROR] No se encontro scripts\detener-sigec.ps1
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\detener-sigec.ps1"
endlocal
