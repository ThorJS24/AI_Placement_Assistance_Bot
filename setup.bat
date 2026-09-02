@echo off
REM ============================================================
REM  AI Placement Assistance Platform - one-time setup (Windows)
REM  Sets up the Python backend AND builds the React frontend.
REM ============================================================
setlocal

echo.
echo === AI Placement Assistance Platform : Setup ===
echo.

where python >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python was not found on PATH. Install Python 3.10-3.12 from https://python.org
    echo         and make sure to check "Add python.exe to PATH" during install.
    pause
    exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js was not found on PATH. Install the free LTS version from https://nodejs.org
    echo         ^(needed once, to build the web interface^). Then re-run this script.
    pause
    exit /b 1
)

echo [1/5] Setting up Python backend...
if not exist ".venv" (
    python -m venv .venv
)
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip >nul
pip install -r backend\requirements.txt
if errorlevel 1 (
    echo [ERROR] Failed to install backend dependencies. See the error above.
    pause
    exit /b 1
)

echo.
echo [2/5] Setting up configuration...
if not exist ".env" (
    copy .env.example .env >nul
    echo Created .env from .env.example
)

echo.
echo [3/5] Installing frontend dependencies (this can take a few minutes the first time)...
cd frontend
call npm install
if errorlevel 1 (
    echo [ERROR] npm install failed. See the error above.
    cd ..
    pause
    exit /b 1
)

echo.
echo [4/5] Building the web interface for production...
call npm run build
if errorlevel 1 (
    echo [ERROR] Frontend build failed. See the error above.
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo [5/5] Checking for a local AI engine (Ollama)...
where ollama >nul 2>nul
if errorlevel 1 goto no_ollama

echo Ollama detected. Pulling the default model (this downloads a few GB once)...
ollama pull llama3.2
goto ollama_done

:no_ollama
echo [NOTE] Ollama was not found. The app can still work using a free Groq API key
echo        instead (see .env / the in-app Settings page), but for a fully free,
echo        offline setup we recommend installing Ollama from https://ollama.com

:ollama_done
echo.
echo === Setup complete! ===
echo Run the app anytime with:  run.bat
echo.
pause
