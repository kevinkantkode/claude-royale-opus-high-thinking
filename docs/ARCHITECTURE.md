# ClashSim Architecture

## Overview

ClashSim is an opponent elixir and card tracker for Clash Royale. The frontend (React/Vite) talks to the backend (FastAPI) via REST API.

## Data Flow

```
Frontend (React)          Backend (FastAPI)
     |                           |
     |-- GET /api/cards -------->|  Cards from startup cache
     |<-- Card[] ----------------|
     |                           |
     |-- POST /opponent/play --->|  record_play(card_key, cards)
     |<-- OpponentState ---------|  Updates _state, returns it
     |                           |
     |-- POST /opponent/ability->|  record_ability(index)
     |<-- OpponentState ---------|
```

## Backend

### Startup (Lifespan)

- Cards are loaded from `data/cards.json` once at startup.
- Stored in `_cards_cache`. No disk reads on subsequent requests.

### State

- **Single opponent:** `game/opponent.py` uses a global `_state` dict.
- **Future multi-session:** Would require session IDs and a `{session_id: state}` map. Not implemented.

### Key Modules

- `api/main.py` — FastAPI app, routes, lifespan, card cache.
- `api/schemas.py` — Pydantic request/response models.
- `game/opponent.py` — Elixir, deck, queue, play/ability logic.
- `game/models.py` — Elixir cost helpers (Mirror, etc.).

## Frontend

- **api.ts** — Fetch wrappers for all endpoints.
- **App.tsx** — Main UI: cards, opponent tracker, elixir, queue.
- **Vite proxy** — `/api` → `http://127.0.0.1:8000`.

## Running

```bash
# Backend + frontend
./scripts/dev.sh

# Tests
cd backend && python -m pytest tests/ -v
# Or from project root:
PYTHONPATH=backend python -m pytest backend/tests/ -v
```
