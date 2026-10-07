@echo off
setlocal
cd /d "%~dp0"
if /i "%~1"=="backend" goto backend
if /i "%~1"=="frontend" goto frontend
if not exist "backend\.venv\Scripts\python.exe" (
    echo Missing backend virtual environment. See docs\LOCAL_SETUP_GUIDE.md.
    exit /b 1
)
if not exist "frontend\node_modules\vite\bin\vite.js" (
    echo Missing frontend dependencies. See docs\LOCAL_SETUP_GUIDE.md.
    exit /b 1
)
start "Makerove Backend :8000" cmd /k call "%~f0" backend
start "Makerove Frontend :5173" cmd /k call "%~f0" frontend
echo Servers are starting. Check both terminal windows for readiness.
echo Open http://localhost:5173 after Vite reports ready.
echo API documentation: http://localhost:8000/docs
echo Stop with Ctrl+C in each server window.
exit /b 0

:backend
cd /d "%~dp0backend"
if not exist ".env" (
    echo Missing backend\.env. See docs\LOCAL_SETUP_GUIDE.md.
    exit /b 1
)
if not exist "makerove.db" (
    ".venv\Scripts\python.exe" "..\scripts\seed_demo.py"
    if errorlevel 1 exit /b 1
)
".venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
exit /b %errorlevel%

:frontend
for /d %%D in ("%~dp0.tools\node-*-win-x64") do if exist "%%~D\npm.cmd" set "PATH=%%~D;%PATH%"
where npm.cmd >nul 2>nul
if errorlevel 1 (
    echo Missing npm. Install Node.js LTS or restore the project-local .tools runtime.
    exit /b 1
)
cd /d "%~dp0frontend"
call npm.cmd run dev -- --host localhost --port 5173 --strictPort
exit /b %errorlevel%
