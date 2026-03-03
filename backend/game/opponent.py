"""
Opponent state for elixir and queue tracking.

Elixir: backend manages a pool (elixir, last_updated). Time flows; on each
action we advance to now, subtract cost, done. No event replay.
Plays: for queue/deck only, not used for elixir.
"""
import json
import time
from pathlib import Path

from .models import get_card_elixir, mirror_elixir

# Load game constants from shared JSON (supports game modes)
_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
_GAME_MODES: dict = {}
_path = _DATA_DIR / "game-constants.json"
if _path.exists():
    with open(_path) as f:
        data = json.load(f)
        for k, v in data.items():
            if not k.startswith("_"):
                _GAME_MODES[k] = v

# In-memory state (single opponent)
_state = {
    "started": False,
    "started_at": 0.0,
    "game_started_at": 0.0,
    "sync_used": False,
    "elixir": 5.0,
    "elixir_last_updated": 0.0,
    "leaked": 0.0,
    "deck": [],
    "queue": [],
    "plays": [],
    "ability_cards": [],
    "game_mode": "normal",
}


def _game_constants() -> dict:
    """Current game mode constants."""
    return _GAME_MODES.get(_state.get("game_mode", "normal"), _GAME_MODES.get("normal", {}))


def _cards_by_key(cards: list) -> dict:
    return {c["key"]: c for c in cards}


def _game_remaining(now: float) -> float:
    """Seconds remaining on game clock. 0 or negative = overtime."""
    gc = _game_constants()
    duration = gc.get("GAME_DURATION", 180)
    return duration - (now - _state["game_started_at"])


def _advance_elixir(now: float) -> None:
    """Advance elixir pool to now (regen, cap 10, track leaked)."""
    if not _state["started"]:
        return
    gc = _game_constants()
    rate_normal = gc.get("RATE_NORMAL", 2.8)
    rate_double = gc.get("RATE_DOUBLE", 1.4)
    duration = gc.get("GAME_DURATION", 180)
    threshold = gc.get("DOUBLE_ELIXIR_THRESHOLD", 60)
    cap = gc.get("ELIXIR_CAP", 10)

    t_old = _state["elixir_last_updated"]
    game_started = _state["game_started_at"]
    t_cross = game_started + (duration - threshold)

    interval1_end = min(now, t_cross)
    interval1_dur = max(0.0, interval1_end - t_old)
    interval2_start = max(t_old, t_cross)
    interval2_dur = max(0.0, now - interval2_start)

    regen = (interval1_dur / rate_normal) + (interval2_dur / rate_double)
    would_be = _state["elixir"] + regen
    if would_be > cap:
        _state["leaked"] += would_be - cap
    _state["elixir"] = min(float(cap), would_be)
    _state["elixir_last_updated"] = now


def start_game(mode: str = "normal") -> dict:
    """Start the game. mode: normal | doubleElixir."""
    if mode not in _GAME_MODES:
        mode = "normal"
    gc = _GAME_MODES.get(mode, _GAME_MODES.get("normal", {}))
    start_offset = gc.get("START_OFFSET_SEC", 3)
    now = time.time()
    _state["started"] = True
    _state["started_at"] = now
    _state["game_started_at"] = now - start_offset
    _state["game_mode"] = mode
    _state["sync_used"] = False
    _state["elixir"] = gc.get("START_ELIXIR", 7.5)
    _state["elixir_last_updated"] = now
    _state["leaked"] = 0.0
    _state["deck"] = []
    _state["queue"] = []
    _state["plays"] = []
    _state["ability_cards"] = []
    return get_state(advance=False)


def sync_game() -> dict:
    """One-time sync: set elixir=10, time=2:50. Only valid when remaining >= 160 (~20s window)."""
    if _state["sync_used"]:
        raise ValueError("Sync already used")
    now = time.time()
    _advance_elixir(now)
    remaining = _game_remaining(now)
    gc = _game_constants()
    sync_min = gc.get("SYNC_MIN_REMAINING", 160)
    if remaining < sync_min:
        raise ValueError(f"Sync only valid in first ~20s; remaining={remaining:.0f}s")
    sync_offset = gc.get("SYNC_OFFSET_SEC", 10)
    _state["game_started_at"] = now - sync_offset  # timer shows 2:50
    _state["elixir"] = 10.0
    _state["elixir_last_updated"] = now
    _state["sync_used"] = True
    return get_state(advance=False)


def _play_cost(card_key: str, card: dict, queue: list, cards_by_key: dict) -> int:
    """
    Elixir cost for playing a card.
    Mirror: copies last played card, costs last_card.elixir + 1.
    Same-card-twice rule: cannot play the same card twice in a row; use Mirror to copy it.
    """
    last_key = queue[7] if queue and len(queue) >= 8 and queue[7] not in (None, "?") else None
    last_card = cards_by_key.get(last_key) if last_key else None
    if card_key == "mirror" and last_card:
        return mirror_elixir(last_card)
    return get_card_elixir(card)


def record_play(card_key: str, cards: list) -> dict:
    """
    Record opponent played a card.
    - New card: add to deck (max 8), update queue.
    - Known card: must be in hand (slots 0-3), rotate queue (move to back).
    - Same-card-twice: blocked unless using Mirror (Mirror copies last card, +1 elixir).
    """
    cards_by_key = _cards_by_key(cards)
    card = cards_by_key.get(card_key)
    if not card:
        raise ValueError(f"Unknown card: {card_key}")

    deck = _state["deck"]
    queue = _state["queue"]
    plays = _state["plays"]

    # Mirror only when clicking mirror; cannot play same card twice without it
    last_key = queue[7] if queue and len(queue) >= 8 and queue[7] not in (None, "?") else None
    if card_key != "mirror" and last_key == card_key:
        raise ValueError("Cannot play same card twice; use Mirror")

    cost = _play_cost(card_key, card, queue, cards_by_key)
    now = time.time()
    _advance_elixir(now)
    if _state["elixir"] < cost:
        raise ValueError(
            f"Not enough elixir: have {_state['elixir']:.1f}, need {cost} for {card_key}"
        )

    if card_key in deck:
        # Known card: must be in hand (slots 0-3), then rotate queue
        hand = queue[:4]
        if card_key not in hand:
            raise ValueError(f"{card_key} not in hand; only cards in slots 1-4 are playable")
        idx = queue.index(card_key)
        queue = queue[:idx] + queue[idx + 1 :] + [card_key]
        _state["queue"] = queue
    else:
        # New card: add to deck (max 8)
        if len(deck) >= 8:
            raise ValueError(f"Deck is full; {card_key} not in opponent deck")
        deck = deck + [card_key]
        queue = [None] * (8 - len(deck)) + deck
        _state["deck"] = deck
        _state["queue"] = queue
        _state["ability_cards"] = [
            {"key": k, "ability_cost": cards_by_key[k]["ability_cost"]}
            for k in deck
            if cards_by_key.get(k, {}).get("ability_cost")
        ]

    _state["elixir"] = max(0.0, _state["elixir"] - cost)
    _state["elixir_last_updated"] = now

    plays = plays + [{"card_key": card_key}]
    _state["plays"] = plays
    return get_state(advance=False)


def record_ability(ability_index: int) -> dict:
    """Record opponent used hero/champion ability. ability_index 0..N for each ability card in deck."""
    ability_cards = _state["ability_cards"]
    if ability_index < 0 or ability_index >= len(ability_cards):
        raise ValueError(f"Invalid ability_index: {ability_index}")
    cost = ability_cards[ability_index]["ability_cost"]
    now = time.time()
    _advance_elixir(now)
    if _state["elixir"] < cost:
        raise ValueError(
            f"Not enough elixir: have {_state['elixir']:.1f}, need {cost} for ability"
        )
    _state["elixir"] = max(0.0, _state["elixir"] - cost)
    _state["elixir_last_updated"] = now
    return get_state(advance=False)


def reset() -> dict:
    """Reset for new game."""
    _state["started"] = False
    _state["started_at"] = 0.0
    _state["game_started_at"] = 0.0
    _state["game_mode"] = "normal"
    _state["sync_used"] = False
    _state["elixir"] = 5.0
    _state["elixir_last_updated"] = 0.0
    _state["leaked"] = 0.0
    _state["deck"] = []
    _state["queue"] = []
    _state["plays"] = []
    _state["ability_cards"] = []
    return get_state(advance=False)


def get_state(advance: bool = True) -> dict:
    """Return JSON-serializable state for frontend. advance=False skips elixir advance (caller just advanced)."""
    if advance:
        _advance_elixir(time.time())
    q = _state["queue"]
    while len(q) < 8:
        q = ["?"] + q
    queue_display = [(k if k else "?") for k in q]
    return {
        "started": _state["started"],
        "started_at": _state["started_at"],
        "game_started_at": _state["game_started_at"],
        "sync_used": _state["sync_used"],
        "elixir": _state["elixir"],
        "elixir_last_updated": _state["elixir_last_updated"],
        "leaked": _state["leaked"],
        "deck": _state["deck"],
        "queue": queue_display,
        "plays": _state["plays"],
        "ability_cards": _state["ability_cards"],
        "game_mode": _state.get("game_mode", "normal"),
    }
