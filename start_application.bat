@echo off
title MAKEROVE // LAUNCHER
color 0B

echo ======================================================================
echo    MAKEROVE // CLASSROOM INTELLIGENCE PLATFORM
echo    "A teacher's sixth sense - support before sanction."
echo ======================================================================
echo.

cd /d "%~dp0"

:: 1. Check if database exists, if not seed it automatically
if not exist "makerove.db" (
    echo [*] Initializing database and seeding demo data...
    python scripts\seed_demo.py
    echo.
)

:: 2. Launch Backend (FastAPI on Port 8000)
echo [*] Starting Backend API on http://localhost:8000...
start "[Makerove] Backend API (:8000)" cmd /k "cd /d "%~dp0backend" && python -m uvicorn app.main:app --port 8000 --reload"

:: 3. Launch Frontend (Vite Dev Server on Port 5173)
echo [*] Starting Frontend Dev Server on http://localhost:5173...
start "[Makerove] Frontend UI (:5173)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

:: 4. Wait for servers to spin up
echo [*] Waiting for services to initialize...
timeout /t 3 /nobreak >nul

:: 5. Open browser
echo [*] Launching Makerove Command Center in your default browser...
start http://localhost:5173

echo.
echo ======================================================================
echo    [OK] Makerove is now running!
echo    - Frontend UI:  http://localhost:5173
echo    - Backend API:  http://localhost:8000
echo    - API Docs:     http://localhost:8000/docs
echo.
echo    To stop the application, close the two spawned terminal windows.
echo ======================================================================
echo.
pause
