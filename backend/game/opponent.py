"""
Opponent state for elixir and queue tracking.

Elixir: backend manages a pool (elixir, last_updated). Time flows; on each
action we advance to now, subtract cost, done. No event replay.
Plays: for queue/deck only, not used for elixir.
"""
import time
from .models import get_card_elixir, mirror_elixir

# In-memory state (single opponent)
_state = {
    "started": False,
    "started_at": 0.0,
    "elixir": 5.0,
    "elixir_last_updated": 0.0,
    "leaked": 0.0,
    "deck": [],
    "queue": [],
    "plays": [],
    "ability_cards": [],
}


def _cards_by_key(cards: list) -> dict:
    return {c["key"]: c for c in cards}


def _advance_elixir(now: float) -> None:
    """Advance elixir pool to now (regen, cap 10, track leaked)."""
    if not _state["started"]:
        return
    t = _state["elixir_last_updated"]
    regen = (now - t) / 2.8
    would_be = _state["elixir"] + regen
    if would_be > 10:
        _state["leaked"] += would_be - 10
    _state["elixir"] = min(10.0, would_be)
    _state["elixir_last_updated"] = now


def _current_elixir() -> float:
    """Current elixir after advancing to now."""
    _advance_elixir(time.time())
    return _state["elixir"]


def start_game() -> dict:
    """Start the game. Elixir begins at 5 and ticks up."""
    now = time.time()
    _state["started"] = True
    _state["started_at"] = now
    _state["elixir"] = 5.0
    _state["elixir_last_updated"] = now
    _state["leaked"] = 0.0
    _state["deck"] = []
    _state["queue"] = []
    _state["plays"] = []
    _state["ability_cards"] = []
    return get_state()


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
    - New card: add to deck (max 8, max 2 ability cards), update queue.
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
    current = _current_elixir()
    if current < cost:
        raise ValueError(
            f"Not enough elixir: have {current:.1f}, need {cost} for {card_key}"
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
        # New card: add to deck (max 8, max 2 ability cards)
        if len(deck) >= 8:
            raise ValueError(f"Deck is full; {card_key} not in opponent deck")
        ability_cards = [c for c in deck if cards_by_key.get(c, {}).get("ability_cost")]
        if card.get("ability_cost") and len(ability_cards) >= 2:
            raise ValueError("Deck already has 2 ability cards")
        deck = deck + [card_key]
        queue = [None] * (8 - len(deck)) + deck
        _state["deck"] = deck
        _state["queue"] = queue
        _state["ability_cards"] = [
            {"key": k, "ability_cost": cards_by_key[k]["ability_cost"]}
            for k in deck
            if cards_by_key.get(k, {}).get("ability_cost")
        ]

    now = time.time()
    _advance_elixir(now)
    _state["elixir"] = max(0.0, _state["elixir"] - cost)
    _state["elixir_last_updated"] = now

    plays = plays + [{"card_key": card_key}]
    _state["plays"] = plays
    return get_state()


def record_ability(ability_index: int) -> dict:
    """Record opponent used hero/champion ability. ability_index 0 or 1."""
    ability_cards = _state["ability_cards"]
    if ability_index < 0 or ability_index >= len(ability_cards):
        raise ValueError(f"Invalid ability_index: {ability_index}")
    cost = ability_cards[ability_index]["ability_cost"]
    current = _current_elixir()
    if current < cost:
        raise ValueError(
            f"Not enough elixir: have {current:.1f}, need {cost} for ability"
        )
    now = time.time()
    _advance_elixir(now)
    _state["elixir"] = max(0.0, _state["elixir"] - cost)
    _state["elixir_last_updated"] = now
    return get_state()


def reset() -> dict:
    """Reset for new game."""
    _state["started"] = False
    _state["started_at"] = 0.0
    _state["elixir"] = 5.0
    _state["elixir_last_updated"] = 0.0
    _state["leaked"] = 0.0
    _state["deck"] = []
    _state["queue"] = []
    _state["plays"] = []
    _state["ability_cards"] = []
    return get_state()


def get_state() -> dict:
    """Return JSON-serializable state for frontend."""
    _advance_elixir(time.time())
    q = _state["queue"]
    while len(q) < 8:
        q = ["?"] + q
    queue_display = [(k if k else "?") for k in q]
    return {
        "started": _state["started"],
        "started_at": _state["started_at"],
        "elixir": _state["elixir"],
        "elixir_last_updated": _state["elixir_last_updated"],
        "leaked": _state["leaked"],
        "deck": _state["deck"],
        "queue": queue_display,
        "plays": _state["plays"],
        "ability_cards": _state["ability_cards"],
    }
