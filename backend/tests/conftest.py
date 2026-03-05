"""
Pytest fixtures for ClashSim backend tests.
"""
import json
from pathlib import Path

import pytest

from game.opponent import reset

# Minimal card set for unit tests (avoids loading full cards.json)
SAMPLE_CARDS = [
    {"key": "knight", "name": "Knight", "elixir": 3, "type": "Troop"},
    {"key": "mirror", "name": "Mirror", "elixir": 1, "type": "Spell", "is_mirror": True},
    {"key": "skeletons", "name": "Skeletons", "elixir": 1, "type": "Troop"},
    {"key": "goblins", "name": "Goblins", "elixir": 2, "type": "Troop", "ability_cost": 1},
    {"key": "archers", "name": "Archers", "elixir": 3, "type": "Troop"},
    {"key": "giant", "name": "Giant", "elixir": 5, "type": "Troop"},
    {"key": "bomber", "name": "Bomber", "elixir": 2, "type": "Troop"},
    {"key": "cannon", "name": "Cannon", "elixir": 3, "type": "Building"},
    {"key": "mega-knight", "name": "Mega Knight", "elixir": 7, "type": "Troop"},
]


@pytest.fixture(autouse=True)
def reset_opponent_state():
    """Reset opponent state before each test to avoid cross-test pollution."""
    reset()
    yield
    reset()


@pytest.fixture
def cards():
    """Sample cards for record_play tests."""
    return SAMPLE_CARDS.copy()


@pytest.fixture
def cards_by_key(cards):
    """cards_by_key dict for record_play (avoids rebuilding per call)."""
    return {c["key"]: c for c in cards}


def load_real_cards():
    """Load cards from data/cards.json for integration tests."""
    data_dir = Path(__file__).resolve().parent.parent.parent / "data"
    path = data_dir / "cards.json"
    if not path.exists():
        return []
    with open(path) as f:
        return json.load(f)
