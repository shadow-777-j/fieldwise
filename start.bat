@echo off
setlocal EnableExtensions
title FIELDWISE AI - Launcher

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

echo ============================================================
echo   FIELDWISE AI - Satellite Intelligence for Resilient Farming
echo ============================================================
echo.

:: 1. Ensure backend .env exists
if not exist "%ROOT%\backend\.env" (
    if exist "%ROOT%\backend\.env.example" (
        echo [Setup] Creating backend\.env from .env.example...
        copy /Y "%ROOT%\backend\.env.example" "%ROOT%\backend\.env" >nul
    )
)

:: 2. Ensure Python virtualenv & packages exist
if not exist "%ROOT%\backend\.venv\Scripts\python.exe" (
    echo [Setup] Creating Python virtual environment in backend\.venv...
    python -m venv "%ROOT%\backend\.venv"
    if errorlevel 1 (
        echo [ERROR] Failed to create Python virtual environment. Ensure Python is installed.
        pause
        exit /b 1
    )
    echo [Setup] Installing backend dependencies...
    "%ROOT%\backend\.venv\Scripts\pip.exe" install -r "%ROOT%\backend\requirements.txt"
    if errorlevel 1 (
        echo [ERROR] Failed to install backend dependencies.
        pause
        exit /b 1
    )
)

:: 3. Ensure frontend node_modules exist
if not exist "%ROOT%\frontend\node_modules" (
    echo [Setup] Installing frontend dependencies...
    pushd "%ROOT%\frontend"
    call npm install
    if errorlevel 1 (
        popd
        echo [ERROR] Failed to install frontend dependencies. Ensure Node.js and npm are installed.
        pause
        exit /b 1
    )
    popd
)

echo [1/3] Starting FastAPI Backend on http://127.0.0.1:8000 ...
start "FIELDWISE_BACKEND" /D "%ROOT%\backend" cmd /k ".venv\Scripts\uvicorn.exe app.main:app --host 127.0.0.1 --port 8000"

echo [2/3] Starting Vite Frontend on http://127.0.0.1:5173 ...
start "FIELDWISE_FRONTEND" /D "%ROOT%\frontend" cmd /k "npm run dev -- --host 127.0.0.1 --port 5173"

echo [3/3] Waiting for backend health check...
powershell -NoProfile -Command "for ($i=0; $i -lt 30; $i++) { try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8000/api/health' -TimeoutSec 2; if ($r.StatusCode -eq 200) { Write-Host '[OK] Backend is healthy.'; break } } catch {}; Start-Sleep -Seconds 1 }"

echo.
echo ------------------------------------------------------------
echo   Frontend App : http://127.0.0.1:5173
echo   Backend API  : http://127.0.0.1:8000
echo   Swagger Docs : http://127.0.0.1:8000/docs
echo ------------------------------------------------------------
echo.

start "" "http://127.0.0.1:5173"
start "" "http://127.0.0.1:8000/docs"

echo Press any key to stop both FIELDWISE AI servers and exit...
pause >nul

echo.
echo [Shutdown] Stopping backend and frontend processes on ports 8000 and 5173...
powershell -NoProfile -Command "foreach ($port in @(8000, 5173)) { Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { taskkill /PID $_ /T /F 2>$null | Out-Null } }"
taskkill /FI "WINDOWTITLE eq FIELDWISE_BACKEND*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq FIELDWISE_FRONTEND*" /T /F >nul 2>&1
echo [Done] Servers stopped.
endlocal
