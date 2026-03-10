"""
Opponent state for elixir and queue tracking.

Elixir: backend manages a pool (elixir, last_updated). Time flows; on each
action we advance to now, subtract cost, done. No event replay.
Plays: for queue/deck only, not used for elixir.
"""
import json
import time
from collections import defaultdict
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
    "ability_uses": [],
    "game_mode": "normal",
}


def _game_constants() -> dict:
    """Current game mode constants."""
    return _GAME_MODES.get(_state.get("game_mode", "normal"), _GAME_MODES.get("normal", {}))


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
    _state["ability_uses"] = []
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
    last_key = queue[7] if queue and len(queue) >= 8 and queue[7] != "?" else None
    last_card = cards_by_key.get(last_key) if last_key else None
    if card_key == "mirror" and last_card:
        return mirror_elixir(last_card)
    return get_card_elixir(card)


def record_play(card_key: str, cards_by_key: dict) -> dict:
    """
    Record opponent played a card.
    - New card: add to deck (max 8), update queue.
    - Known card: must be in hand (slots 0-3), rotate queue (move to back).
    - Same-card-twice: blocked unless using Mirror (Mirror copies last card, +1 elixir).
    """
    card = cards_by_key.get(card_key)
    if not card:
        raise ValueError(f"Unknown card: {card_key}")

    deck = _state["deck"]
    queue = _state["queue"]
    plays = _state["plays"]

    # Mirror only when clicking mirror; cannot play same card twice without it
    last_key = queue[7] if queue and len(queue) >= 8 and queue[7] != "?" else None
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
        queue = ["?"] * (8 - len(deck)) + deck
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


def undo_play(cards_by_key: dict) -> dict:
    """
    Undo the last card play.
    Refunds elixir (capped at 10), restores deck/queue/plays. Timer unchanged.
    """
    if not _state["started"]:
        raise ValueError("Game not started")
    plays = _state["plays"]
    if not plays:
        raise ValueError("No plays to undo")

    card_key = plays[-1]["card_key"]
    card = cards_by_key.get(card_key)
    if not card:
        raise ValueError(f"Unknown card: {card_key}")

    deck = _state["deck"]
    queue = _state["queue"]
    gc = _game_constants()
    cap = gc.get("ELIXIR_CAP", 10)

    # Compute cost: Mirror uses plays[-2] as base card
    if card_key == "mirror" and len(plays) >= 2:
        base_card = cards_by_key.get(plays[-2]["card_key"])
        cost = mirror_elixir(base_card) if base_card else get_card_elixir(card)
    else:
        cost = get_card_elixir(card)

    # Refund elixir (cap at 10, no _advance_elixir)
    _state["elixir"] = min(float(cap), _state["elixir"] + cost)

    # Remove last play
    _state["plays"] = plays[:-1]

    # New card: we appended to deck, so deck[-1] == card_key. Known: we only rotated queue.
    if deck[-1] == card_key:
        # New card (was appended to deck): remove from deck, rebuild queue and ability_cards
        deck = deck[:-1]
        _state["deck"] = deck
        _state["queue"] = ["?"] * (8 - len(deck)) + deck
        _state["ability_cards"] = [
            {"key": k, "ability_cost": cards_by_key[k]["ability_cost"]}
            for k in deck
            if cards_by_key.get(k, {}).get("ability_cost")
        ]
    else:
        # Known card: reverse queue rotation. Insert card_key before first card that follows it in deck.
        rest = queue[:-1]
        card_key_idx = deck.index(card_key)
        insert_idx = next(
            (i for i, c in enumerate(rest) if c != "?" and c in deck and deck.index(c) > card_key_idx),
            len(rest),
        )
        _state["queue"] = rest[:insert_idx] + [card_key] + rest[insert_idx:]
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
    _state["ability_uses"] = _state["ability_uses"] + [
        {"ability_index": ability_index, "cost": cost}
    ]
    return get_state(advance=False)


def _build_game_summary() -> dict:
    """
    Derive stats from plays and ability_uses for end screen.
    Only includes cards that were played and abilities that were used.
    Card plays grouped by usage count (descending) so cards with same count
    display in one row. Expansion: add keys to returned dict; schema has extra='allow'.
    """
    plays = _state["plays"]
    ability_uses = _state["ability_uses"]
    ability_cards = _state["ability_cards"]

    # One pass: count plays per card, then group by count (descending)
    count_by_card: dict[str, int] = defaultdict(int)
    for p in plays:
        count_by_card[p["card_key"]] += 1
    count_to_cards: dict[int, list[str]] = defaultdict(list)
    for card_key, count in count_by_card.items():
        count_to_cards[count].append(card_key)
    card_play_groups = [
        {"count": count, "card_keys": cards}
        for count, cards in sorted(count_to_cards.items(), key=lambda x: -x[0])
    ]

    # Ability usage per ability - only abilities that were used
    ability_usage_counts: dict[int, int] = {}
    total_ability_elixir = 0
    for u in ability_uses:
        idx = u["ability_index"]
        cost = u["cost"]
        ability_usage_counts[idx] = ability_usage_counts.get(idx, 0) + 1
        total_ability_elixir += cost
    ability_stats = [
        {
            "ability_index": idx,
            "card_key": ability_cards[idx]["key"],
            "ability_cost": ability_cards[idx]["ability_cost"],
            "count": ability_usage_counts[idx],
        }
        for idx in sorted(ability_usage_counts.keys())
    ]

    return {
        "leaked": _state["leaked"],
        "card_play_groups": card_play_groups,
        "ability_stats": ability_stats,
        "total_ability_elixir": total_ability_elixir,
    }


def end_game() -> dict:
    """
    End the game and return state plus game_summary for the overlay.
    Sets started=False but preserves deck, queue, plays, leaked, game_started_at
    so the overlay can display the frozen game state.
    """
    if not _state["started"]:
        return dict(get_state(advance=False), game_summary=None)
    _advance_elixir(time.time())
    game_summary = _build_game_summary()
    _state["started"] = False
    _state["started_at"] = 0.0
    return dict(get_state(advance=False), game_summary=game_summary)


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
    _state["ability_uses"] = []
    return get_state(advance=False)


def get_state(advance: bool = True) -> dict:
    """Return JSON-serializable state for frontend. advance=False skips elixir advance (caller just advanced)."""
    if advance:
        _advance_elixir(time.time())
    q = _state["queue"]
    while len(q) < 8:
        q = ["?"] + q
    return dict(_state, queue=q)
