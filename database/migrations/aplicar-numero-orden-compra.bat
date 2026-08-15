@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0\..\.."

echo.
echo  Agregar columna numero_orden_compra a sigec_igss.expedientes
echo  (requiere contraseña del usuario postgres)
echo.

set /p PGPASSWORD=Contraseña de postgres: 
if "%PGPASSWORD%"=="" (
  echo Cancelado.
  pause
  exit /b 1
)

set PSQL=
for /d %%D in ("C:\Program Files\PostgreSQL\*") do if exist "%%D\bin\psql.exe" set "PSQL=%%D\bin\psql.exe"
if "%PSQL%"=="" (
  echo No se encontro psql.exe
  pause
  exit /b 1
)

"%PSQL%" -h localhost -p 5432 -U postgres -d igss -f "database\migrations\add_numero_orden_compra.sql"
if errorlevel 1 (
  echo.
  echo Fallo al aplicar la migracion.
  set PGPASSWORD=
  pause
  exit /b 1
)

echo.
echo Listo. Columna agregada y dueño de la tabla = portal_app.
set PGPASSWORD=
pause
