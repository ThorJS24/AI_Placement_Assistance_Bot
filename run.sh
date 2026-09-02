#!/usr/bin/env bash
# ============================================================
#  AI Placement Assistance Platform - launch (Linux/Mac)
#  Starts the single backend process, which also serves the
#  pre-built web interface. No Node.js needed for this step.
# ============================================================
set -e

if [ ! -d ".venv" ]; then
    echo "[ERROR] Setup hasn't been run yet. Run ./setup.sh first."
    exit 1
fi

if [ ! -f "frontend/dist/index.html" ]; then
    echo "[ERROR] The web interface hasn't been built yet. Run ./setup.sh first."
    exit 1
fi

source .venv/bin/activate
cd backend
python run_server.py
