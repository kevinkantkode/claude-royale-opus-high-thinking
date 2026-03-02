"""
Data models for Clash Royale helper.
"""
from typing import Optional

# Card - matches output of fetch_cards.py
Card = dict  # { key, name, elixir, type, ability_cost?, is_mirror? }


def get_card_elixir(card: Card, used_ability: bool = False) -> int:
    """Elixir cost for playing a card. +ability_cost if hero/champion used ability."""
    cost = card.get("elixir", 0)
    if used_ability and card.get("ability_cost"):
        cost += card["ability_cost"]
    return cost


def is_mirror(card: Card, last_played: Optional[Card]) -> bool:
    """True if this play was Mirror (copies last card, +1 elixir)."""
    return card.get("key") == "mirror" and last_played is not None


def mirror_elixir(base_card: Card) -> int:
    """Elixir cost when Mirror copies a card: base + 1."""
    return base_card.get("elixir", 0) + 1


# Opponent state - built up from input
# deck: cards we've seen (partial or full)
# queue: [slot1..slot8] - known order once we've observed a full cycle
# play_history: [last, 2nd_last, ...] for mirror detection
# elixir: current estimate (5 start, +regen, -plays)
# last_play_time: for elixir regen (1 per 2.8s in 1v1)
