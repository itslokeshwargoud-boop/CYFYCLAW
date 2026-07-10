#!/usr/bin/env bash
# Start CyfyClaw backend + frontend locally for development (no Docker).
# Requires: Python 3.11+, Node 20+. Run from the repo root.
set -euo pipefail

if [ ! -f .env ]; then
  echo "No .env found. Copy .env.example to .env and set HF_TOKEN first." >&2
  exit 1
fi

# --- Backend ---
echo "==> Starting backend on :8000"
cd backend
python3 -m venv .venv 2>/dev/null || true
# shellcheck disable=SC1091
. .venv/bin/activate
pip install -q -r requirements.txt
# Load env vars for the backend process.
set -a; . ../.env; set +a
uvicorn app.main:app --host 0.0.0.0 --port "${API_PORT:-8000}" --reload &
BACKEND_PID=$!
cd ..

# --- Frontend ---
echo "==> Starting frontend on :3000"
cd frontend
npm install --no-audit --no-fund
npm run dev &
FRONTEND_PID=$!
cd ..

trap 'echo; echo "Shutting down..."; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true' INT TERM
echo "CyfyClaw is starting. Frontend: http://localhost:3000  Backend: http://localhost:8000/docs"
wait
