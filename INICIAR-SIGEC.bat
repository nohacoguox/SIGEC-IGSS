@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

:: SIGEC-IGSS — levantar backend + frontend (doble clic en Windows)
cd /d "%~dp0"
title SIGEC-IGSS — Inicio

echo.
echo  ============================================
echo   SIGEC-IGSS — Sistema de Gestion IGSS
echo  ============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js no esta instalado o no esta en el PATH.
  echo         Instale Node.js LTS desde https://nodejs.org
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm no encontrado.
  pause
  exit /b 1
)

:: PostgreSQL
where pg_isready >nul 2>&1
if not errorlevel 1 (
  pg_isready -h localhost -p 5432 >nul 2>&1
  if errorlevel 1 (
    echo [AVISO] PostgreSQL no responde en localhost:5432.
    echo         Inicie el servicio PostgreSQL antes de continuar.
    echo.
    pause
  ) else (
    echo [OK] PostgreSQL activo en localhost:5432
  )
) else (
  echo [AVISO] pg_isready no encontrado; no se pudo verificar PostgreSQL.
)

:: backend/.env
if not exist "backend\.env" (
  echo.
  echo [ERROR] Falta backend\.env
  echo         Copie backend\.env.example a backend\.env y ajuste DB_PASSWORD.
  pause
  exit /b 1
)
echo [OK] backend\.env encontrado

:: Dependencias
if not exist "backend\node_modules" (
  echo.
  echo Instalando dependencias del backend...
  pushd backend
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install fallo en backend.
    popd
    pause
    exit /b 1
  )
  popd
)

if not exist "frontend\node_modules" (
  echo.
  echo Instalando dependencias del frontend...
  pushd frontend
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install fallo en frontend.
    popd
    pause
    exit /b 1
  )
  popd
)

echo.
echo Iniciando servicios...
echo   Backend  -^> http://localhost:3001
echo   Frontend -^> http://localhost:3003
echo.
echo Se abriran dos ventanas (backend y frontend).
echo Cierre esas ventanas para detener los servicios.
echo.

start "SIGEC-IGSS Backend" cmd /k "cd /d "%~dp0backend" & npm run dev"
timeout /t 4 /nobreak >nul
start "SIGEC-IGSS Frontend" cmd /k "cd /d "%~dp0frontend" & npm start"
timeout /t 8 /nobreak >nul
start "" "http://localhost:3003"

echo.
echo Listo. Si el navegador no abre, vaya a http://localhost:3003
echo Login de prueba: codigo admin / contrasena segun su BD.
echo.
pause
