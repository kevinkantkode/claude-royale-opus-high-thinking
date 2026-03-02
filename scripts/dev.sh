#!/bin/bash
# Run backend and frontend concurrently (replaces npm concurrently)
cd "$(dirname "$0")/.." || exit 1

(cd backend && python3 main.py) &
BACKEND_PID=$!
(cd frontend && npm run dev) &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
