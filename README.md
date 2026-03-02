# ClashSim Helper

Opponent elixir & card cycle tracker for Clash Royale. Manual input for now; voice input planned.

## Setup

```bash
# 1. Fetch card data (uses embedded list)
python3 scripts/fetch_cards_deckshop.py

# 2. Backend
cd backend && pip install -r requirements.txt

# 3. Frontend
cd frontend && npm install
```

## Run

```bash
# Single command (backend + frontend)
npm run dev

# Or run separately:
# Terminal 1: npm run dev:backend
# Terminal 2: npm run dev:frontend
```

Open http://localhost:5173

## Project structure

```
clashsim/
├── scripts/fetch_cards_deckshop.py  # Generates cards.json from embedded list
├── data/cards.json                  # Card data (key, name, elixir, type, ability_cost)
├── backend/                 # FastAPI
│   ├── game/models.py       # Card, elixir, mirror logic
│   └── api/main.py          # /api/cards
└── frontend/                # React + TypeScript
```
