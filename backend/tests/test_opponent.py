"""
Tests for game/opponent.py - record_play, record_ability, start_game, reset.
"""
import time
from unittest.mock import patch

import pytest

from game.opponent import record_ability, record_play, reset, start_game


def test_start_game(cards):
    """start_game initializes state and returns it."""
    state = start_game()
    assert state["started"] is True
    assert abs(state["elixir"] - 5.0) < 0.01
    assert state["deck"] == []
    # get_state() pads queue to 8 slots with "?" for display
    assert len(state["queue"]) == 8
    assert state["plays"] == []


def test_reset():
    """reset clears state."""
    start_game()
    state = reset()
    assert state["started"] is False
    assert state["deck"] == []
    assert len(state["queue"]) == 8  # Padded with "?"
    assert state["plays"] == []


def test_record_play_new_card_adds_to_deck(cards):
    """Playing a new card adds it to deck and queue."""
    start_game()
    state = record_play("knight", cards)
    assert "knight" in state["deck"]
    assert state["deck"] == ["knight"]
    assert state["queue"] == ["?", "?", "?", "?", "?", "?", "?", "knight"]
    assert len(state["plays"]) == 1
    assert state["plays"][0]["card_key"] == "knight"


def test_record_play_unknown_card_raises(cards):
    """Playing unknown card raises ValueError."""
    start_game()
    with pytest.raises(ValueError, match="Unknown card"):
        record_play("nonexistent", cards)


def test_record_play_same_card_twice_without_mirror_raises(cards):
    """Cannot play same card twice without Mirror."""
    # Mock time: 10s between calls gives ~3.6 elixir regen each, enough for 8 cards
    with patch("game.opponent.time.time", side_effect=[1000 + t * 10 for t in range(50)]):
        start_game()
        # Build full deck with 1-2 elixir cards (total 12 elixir for 8 cards)
        for key in ["skeletons", "mirror", "goblins", "bomber", "knight", "archers", "cannon", "giant"]:
            record_play(key, cards)
        # Cycle: play 4 cards so knight is last
        for key in ["skeletons", "goblins", "bomber", "archers"]:
            record_play(key, cards)
        record_play("knight", cards)  # Knight now last (queue[7]), knight in hand
        with pytest.raises(ValueError, match="Cannot play same card twice"):
            record_play("knight", cards)


def test_record_play_mirror_copies_last_card(cards):
    """Mirror copies last card and costs last_elixir + 1."""
    # Knight 3, Mirror 4. Need ~6s regen for 2 more elixir. Use many values for time.time() calls.
    times = [1000.0] * 5 + [1006.0] * 10  # First at 1000, second at 1006 (+2 elixir)
    with patch("game.opponent.time.time", side_effect=times):
        start_game()
        record_play("knight", cards)  # Knight costs 3
        state = record_play("mirror", cards)  # Mirror copies knight, costs 4
    assert state["plays"][-1]["card_key"] == "mirror"
    # Elixir: 5 - 3 (knight) = 2, +regen, - 4 (mirror). Should be ~0.
    assert state["elixir"] < 1.0


def test_record_play_not_enough_elixir_raises(cards):
    """Playing card without enough elixir raises."""
    start_game()
    with pytest.raises(ValueError, match="Not enough elixir"):
        record_play("mega-knight", cards)  # Mega Knight costs 7, we have 5


def test_record_play_known_card_rotates_queue(cards):
    """Playing a known card (when deck full) rotates it from hand to back of queue."""
    with patch("game.opponent.time.time", side_effect=[1000 + t * 10 for t in range(100)]):
        start_game()
        # Build full deck - order matters: knight must be in first 4 for hand
        for key in ["knight", "skeletons", "mirror", "goblins", "bomber", "archers", "cannon", "giant"]:
            record_play(key, cards)
        # Deck full. Hand = [knight, skeletons, mirror, goblins]. Play knight -> rotates to back.
        state = record_play("knight", cards)
    assert len(state["deck"]) == 8
    assert state["queue"][-1] == "knight"


def test_record_ability_invalid_index_raises(cards):
    """record_ability with invalid index raises."""
    start_game()
    with pytest.raises(ValueError, match="Invalid ability_index"):
        record_ability(0)  # No ability cards in deck yet

    # Add a deck with ability card
    record_play("goblins", cards)  # goblins has ability_cost
    with pytest.raises(ValueError, match="Invalid ability_index"):
        record_ability(5)  # Index out of range


def test_record_ability_success(cards):
    """record_ability deducts elixir and returns state."""
    with patch("game.opponent.time.time", return_value=1000.0):
        start_game()
        record_play("goblins", cards)  # goblins has ability_cost: 1
        # We have 5 - 2 = 3 elixir. Ability costs 1. So we can use it.
        state = record_ability(0)
    assert abs(state["elixir"] - 2.0) < 0.01  # 3 - 1 = 2 (float tolerance)
