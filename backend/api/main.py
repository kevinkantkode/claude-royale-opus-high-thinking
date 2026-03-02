"""
FastAPI backend for clashsim helper.
"""
import json
from pathlib import Path

from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from game.opponent import get_state, record_ability, record_play, reset, start_game

app = FastAPI(title="ClashSim Helper")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"


def _load_cards():
    path = DATA_DIR / "cards.json"
    if not path.exists():
        return []
    with open(path) as f:
        return json.load(f)


@app.get("/api/cards")
def get_cards():
    """Return processed card data."""
    return _load_cards()


@app.post("/api/opponent/start")
def opponent_start():
    """Start the game. Elixir begins at 5 and ticks up."""
    return start_game()


@app.post("/api/opponent/play")
def opponent_play(body: dict = Body(...)):
    """Record opponent played a card. Body: { "card_key": "knight" }."""
    card_key = body.get("card_key")
    if not card_key:
        raise HTTPException(400, "card_key required")
    cards = _load_cards()
    try:
        return record_play(card_key, cards)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/api/opponent/ability")
def opponent_ability(body: dict = Body(...)):
    """Record opponent used ability. Body: { "ability_index": 0 }."""
    ability_index = body.get("ability_index", 0)
    cards = _load_cards()
    try:
        return record_ability(ability_index, cards)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.get("/api/opponent/state")
def opponent_state():
    """Return current opponent state."""
    return get_state()


@app.post("/api/opponent/reset")
def opponent_reset():
    """Reset for new game."""
    return reset()
