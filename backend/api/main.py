"""
FastAPI backend for clashsim helper.
"""
import json
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from api.schemas import AbilityRequest, Card, EndGameResponse, OpponentState, PlayRequest, StartRequest
from game.opponent import end_game, get_state, record_ability, record_play, reset, start_game, sync_game, undo_play

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
_cards_cache: list = []
_cards_by_key_cache: dict = {}
_voice_aliases_cache: dict = {}


def _load_cards_from_disk() -> list:
    """Load cards from data/cards.json. Used at startup only."""
    path = DATA_DIR / "cards.json"
    if not path.exists():
        return []
    with open(path) as f:
        return json.load(f)


def get_cards() -> list:
    """Return cached card data (loaded once at startup)."""
    return _cards_cache


def _load_voice_aliases_from_disk() -> dict:
    """Load voice aliases from data/voice-aliases.json."""
    path = DATA_DIR / "voice-aliases.json"
    if not path.exists():
        return {}
    with open(path) as f:
        return json.load(f)


def get_voice_aliases() -> dict:
    """Return cached voice aliases (loaded once at startup)."""
    return _voice_aliases_cache


def get_cards_by_key() -> dict:
    """Return cached cards_by_key (key -> card dict). Built once at startup."""
    return _cards_by_key_cache


@asynccontextmanager
async def lifespan(app: "FastAPI"):
    """Load cards and voice aliases once at startup. Cache persists until process exit."""
    global _cards_cache, _cards_by_key_cache, _voice_aliases_cache
    _cards_cache = _load_cards_from_disk()
    _cards_by_key_cache = {c["key"]: c for c in _cards_cache}
    _voice_aliases_cache = _load_voice_aliases_from_disk()
    yield
    # Don't clear cache - TestClient runs lifespan per-request; next request needs it


app = FastAPI(title="ClashSim Helper", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/cards", response_model=list[Card])
def cards_endpoint():
    """Return processed card data (from startup cache)."""
    return get_cards()


@app.get("/api/voice-aliases")
def voice_aliases_endpoint():
    """Return voice alias map (spoken form -> card_key)."""
    aliases = get_voice_aliases()
    if not aliases:
        aliases = _load_voice_aliases_from_disk()
    return aliases


@app.post("/api/opponent/start", response_model=OpponentState)
def opponent_start(body: StartRequest = StartRequest()):
    """Start the game. Body: { mode?: 'normal' | 'doubleElixir' }."""
    return start_game(mode=body.mode)


@app.post("/api/opponent/sync", response_model=OpponentState)
def opponent_sync():
    """One-time sync: set elixir=10, time=2:50. Only valid when remaining >= 160."""
    try:
        return sync_game()
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/api/opponent/play", response_model=OpponentState)
def opponent_play(body: PlayRequest):
    """Record opponent played a card."""
    try:
        return record_play(body.card_key, get_cards_by_key())
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/api/opponent/undo", response_model=OpponentState)
def opponent_undo():
    """Undo the last card play."""
    try:
        return undo_play(get_cards_by_key())
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/api/opponent/ability", response_model=OpponentState)
def opponent_ability(body: AbilityRequest):
    """Record opponent used hero/champion ability."""
    try:
        return record_ability(body.ability_index)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.get("/api/opponent/state", response_model=OpponentState)
def opponent_state():
    """Return current opponent state."""
    return get_state()


@app.post("/api/opponent/end", response_model=EndGameResponse)
def opponent_end():
    """End the game and return state plus game summary for overlay."""
    return end_game()


@app.post("/api/opponent/reset", response_model=OpponentState)
def opponent_reset():
    """Reset for new game."""
    return reset()
