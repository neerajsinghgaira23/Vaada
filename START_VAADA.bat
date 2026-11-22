@echo off
title Vaada Unified Launcher
color 0A
echo ===================================================
echo           VAADA PROMISE TRACKER & AI AGENT
echo ===================================================
echo.
echo [1/3] Ensuring PostgreSQL in WSL is running...
start /b wsl --exec sleep infinity >nul 2>&1
wsl -d Ubuntu -u root service postgresql start

echo.
echo [2/3] Launching FastAPI Backend on http://localhost:8000 ...
start "Vaada Backend (Port 8000)" cmd /k "cd /d %~dp0 && python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload"

echo.
echo [3/3] Launching Vite Frontend on http://localhost:5173 ...
start "Vaada Frontend (Port 5173)" cmd /k "cd /d %~dp0frontend && npm run dev -- --host 127.0.0.1 --port 5173"

echo.
echo Waiting 4 seconds for services to initialize...
timeout /t 4 /nobreak >nul

echo Opening Vaada in browser...
start http://localhost:5173

echo.
echo ===================================================
echo  Vaada is running successfully!
echo  Frontend : http://localhost:5173
echo  Backend  : http://localhost:8000/docs
echo ===================================================
echo.
pause
