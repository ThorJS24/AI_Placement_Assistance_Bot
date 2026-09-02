@echo off
REM ============================================================
REM  AI Placement Assistance Platform - launch (Windows)
REM  Starts the single backend process, which also serves the
REM  pre-built web interface. No Node.js needed for this step.
REM ============================================================
setlocal

if not exist ".venv" (
    echo [ERROR] Setup hasn't been run yet. Double-click setup.bat first.
    pause
    exit /b 1
)

if not exist "frontend\dist\index.html" (
    echo [ERROR] The web interface hasn't been built yet. Double-click setup.bat first.
    pause
    exit /b 1
)

call .venv\Scripts\activate.bat
cd backend
python run_server.py

pause
