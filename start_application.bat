@echo off
setlocal enabledelayedexpansion
title Makerove Launcher
cd /d "%~dp0"

if /i "%~1"=="backend" goto backend
if /i "%~1"=="frontend" goto frontend

echo ===================================================
echo           Starting Makerove Platform
echo ===================================================
echo.

:: 1. Check or auto-create backend virtual environment
if not exist "backend\.venv\Scripts\python.exe" (
    echo [INFO] Backend virtual environment not found. Attempting to create one...
    where python >nul 2>nul
    if not errorlevel 1 (
        echo [INFO] Found system Python. Initializing backend\.venv with site packages...
        python -m venv --system-site-packages backend\.venv
    ) else (
        echo [ERROR] Python not found in PATH or at backend\.venv\Scripts\python.exe.
        echo Please install Python 3.11+ and add it to your system PATH.
        echo.
        pause
        exit /b 1
    )
)

:: 2. Check or auto-create backend .env
if not exist "backend\.env" (
    echo [INFO] backend\.env not found. Creating from .env.example...
    if exist ".env.example" (
        copy /y ".env.example" "backend\.env" >nul
        copy /y ".env.example" ".env" >nul
    ) else (
        echo [ERROR] Missing .env.example file.
        pause
        exit /b 1
    )
)

:: 3. Check frontend dependencies
if not exist "frontend\node_modules" (
    echo [INFO] Frontend node_modules not found. Installing dependencies...
    cd /d "%~dp0frontend"
    call npm install
    cd /d "%~dp0"
    if errorlevel 1 (
        echo [ERROR] Failed to install frontend dependencies.
        pause
        exit /b 1
    )
)

echo [OK] Backend environment verified.
echo [OK] Frontend dependencies verified.
echo.
echo Launching Backend server on port 8000...
start "Makerove Backend :8000" cmd /k call "%~f0" backend

echo Launching Frontend server on port 5173...
start "Makerove Frontend :5173" cmd /k call "%~f0" frontend

echo.
echo ===================================================
echo   Makerove services are launching in separate windows!
echo   - Frontend: http://localhost:5173
echo   - Backend Docs: http://localhost:8000/docs
echo   To stop, close both console windows or press Ctrl+C.
echo ===================================================
echo.
ping 127.0.0.1 -n 3 >nul
exit /b 0

:backend
title Makerove Backend :8000
cd /d "%~dp0backend"
echo [BACKEND] Starting FastAPI server on http://127.0.0.1:8000 ...
if not exist ".env" (
    if exist "..\backend\.env" copy /y "..\backend\.env" ".env" >nul
)
if not exist "makerove.db" (
    echo [BACKEND] Seeding demo database...
    if exist ".venv\Scripts\python.exe" (
        ".venv\Scripts\python.exe" "..\scripts\seed_demo.py"
    ) else (
        python "..\scripts\seed_demo.py"
    )
)
if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
) else (
    python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
)
if errorlevel 1 (
    echo.
    echo [ERROR] Backend exited with an error.
    pause
)
exit /b %errorlevel%

:frontend
title Makerove Frontend :5173
for /d %%D in ("%~dp0.tools\node-*-win-x64") do if exist "%%~D\npm.cmd" set "PATH=%%~D;%PATH%"
where npm.cmd >nul 2>nul
if errorlevel 1 (
    where npm >nul 2>nul
    if errorlevel 1 (
        echo [ERROR] Missing npm. Install Node.js LTS or add it to PATH.
        pause
        exit /b 1
    )
)
cd /d "%~dp0frontend"
echo [FRONTEND] Starting Vite dev server on http://localhost:5173 ...
call npm run dev -- --host localhost --port 5173 --strictPort
if errorlevel 1 (
    echo.
    echo [ERROR] Frontend exited with an error.
    pause
)
exit /b %errorlevel%
