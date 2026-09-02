#!/usr/bin/env bash
# ============================================================
#  AI Placement Assistance Platform - one-time setup (Linux/Mac)
#  Sets up the Python backend AND builds the React frontend.
# ============================================================
set -e

echo
echo "=== AI Placement Assistance Platform : Setup ==="
echo

if ! command -v python3 >/dev/null 2>&1; then
    echo "[ERROR] python3 was not found. Install Python 3.10-3.12 first."
    exit 1
fi

if ! command -v node >/dev/null 2>&1; then
    echo "[ERROR] Node.js was not found. Install the free LTS version from https://nodejs.org"
    echo "        (needed once, to build the web interface), then re-run this script."
    exit 1
fi

echo "[1/5] Setting up Python backend..."
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi
source .venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt

echo
echo "[2/5] Setting up configuration..."
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "Created .env from .env.example"
fi

echo
echo "[3/5] Installing frontend dependencies (this can take a few minutes the first time)..."
cd frontend
npm install

echo
echo "[4/5] Building the web interface for production..."
npm run build
cd ..

echo
echo "[5/5] Checking for a local AI engine (Ollama)..."
if command -v ollama >/dev/null 2>&1; then
    echo "Ollama detected. Pulling the default model (this downloads a few GB once)..."
    ollama pull llama3.2
else
    echo "[NOTE] Ollama was not found. The app can still work using a free Groq API key"
    echo "       instead (see .env / the in-app Settings page), but for a fully free,"
    echo "       offline setup we recommend installing Ollama from https://ollama.com"
fi

echo
echo "=== Setup complete! ==="
echo "Run the app anytime with:  ./run.sh"
echo
