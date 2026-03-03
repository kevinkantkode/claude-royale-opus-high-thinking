"""
Tests for game/models.py - elixir cost and Mirror logic.
"""
import pytest

from game.models import get_card_elixir, mirror_elixir


def test_get_card_elixir_basic():
    """Base elixir cost from card."""
    card = {"key": "knight", "elixir": 3, "type": "Troop"}
    assert get_card_elixir(card) == 3


def test_get_card_elixir_with_ability():
    """Elixir + ability_cost when used_ability=True."""
    card = {"key": "goblins", "elixir": 2, "ability_cost": 1, "type": "Troop"}
    assert get_card_elixir(card, used_ability=False) == 2
    assert get_card_elixir(card, used_ability=True) == 3


def test_get_card_elixir_missing_elixir():
    """Defaults to 0 when elixir key missing."""
    card = {"key": "unknown", "type": "Troop"}
    assert get_card_elixir(card) == 0


def test_mirror_elixir():
    """Mirror cost = base card elixir + 1."""
    knight = {"key": "knight", "elixir": 3}
    assert mirror_elixir(knight) == 4

    skeletons = {"key": "skeletons", "elixir": 1}
    assert mirror_elixir(skeletons) == 2


def test_mirror_elixir_missing_elixir():
    """Mirror of card with no elixir defaults to 1."""
    card = {"key": "unknown"}
    assert mirror_elixir(card) == 1
