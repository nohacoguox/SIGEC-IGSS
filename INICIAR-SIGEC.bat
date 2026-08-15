@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title SIGEC-IGSS

echo.
echo  ============================================
echo   SIGEC-IGSS - Sistema de Gestion IGSS
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

echo [OK] Node.js y npm encontrados

:: PostgreSQL (opcional)
where pg_isready >nul 2>&1
if not errorlevel 1 (
  pg_isready -h localhost -p 5432 >nul 2>&1
  if errorlevel 1 (
    echo [AVISO] PostgreSQL no responde en localhost:5432.
    echo         Inicie el servicio PostgreSQL antes de continuar.
    echo.
  ) else (
    echo [OK] PostgreSQL activo en localhost:5432
  )
) else (
  echo [AVISO] pg_isready no encontrado; no se verifico PostgreSQL.
)

if not exist "backend\.env" (
  echo.
  echo [ERROR] Falta backend\.env
  echo         Copie backend\.env.example a backend\.env y ajuste DB_PASSWORD.
  pause
  exit /b 1
)
echo [OK] backend\.env encontrado

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
echo Liberando puertos 3001 y 3003 si estan ocupados...
for %%P in (3001 3003) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":%%P " ^| findstr "LISTENING"') do (
    if not "%%A"=="" if not "%%A"=="0" (
      echo   Puerto %%P ocupado por PID %%A - cerrando...
      taskkill /F /PID %%A >nul 2>&1
    )
  )
)
timeout /t 2 /nobreak >nul

echo.
echo Iniciando servicios en segundo plano...
echo   Backend  -^> http://localhost:3001
echo   Frontend -^> http://localhost:3003
echo.
echo Backend y frontend se abren minimizados.
echo Puede restaurarlos desde la barra de tareas si necesita ver logs.
echo.

:: /D fija el directorio sin comillas anidadas (evita romper paths con guiones)
start "SIGEC-Backend" /min /D "%~dp0backend" cmd /k "npm run dev"
timeout /t 4 /nobreak >nul
start "SIGEC-Frontend" /min /D "%~dp0frontend" cmd /k "npm start"
timeout /t 8 /nobreak >nul
start "" "http://localhost:3003/login"

echo.
echo Listo. Si el navegador no abre, vaya a:
echo   http://localhost:3003/login
echo.
echo Para detener: cierre las ventanas minimizadas SIGEC-Backend y SIGEC-Frontend.
echo.
pause
endlocal
