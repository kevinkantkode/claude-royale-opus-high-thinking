#!/bin/bash
# Run backend and frontend concurrently (replaces npm concurrently)
cd "$(dirname "$0")/.." || exit 1

echo "Starting backend (port 8000) and frontend..."
echo "Open http://localhost:5173 in your browser (or 5174 if 5173 is in use)"
echo ""

(cd backend && python3 main.py) &
BACKEND_PID=$!
sleep 1
(cd frontend && npm run dev) &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
