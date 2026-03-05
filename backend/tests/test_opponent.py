"""
Tests for game/opponent.py - record_play, record_ability, start_game, reset.
"""
import time
from unittest.mock import patch

import pytest

from game.opponent import record_ability, record_play, reset, start_game, sync_game


def test_start_game(cards_by_key):
    """start_game initializes state and returns it."""
    state = start_game()
    assert state["started"] is True
    assert abs(state["elixir"] - 7.5) < 0.01
    assert state["game_started_at"] > 0
    assert state["sync_used"] is False
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


def test_record_play_new_card_adds_to_deck(cards_by_key):
    """Playing a new card adds it to deck and queue."""
    start_game()
    state = record_play("knight", cards_by_key)
    assert "knight" in state["deck"]
    assert state["deck"] == ["knight"]
    assert state["queue"] == ["?", "?", "?", "?", "?", "?", "?", "knight"]
    assert len(state["plays"]) == 1
    assert state["plays"][0]["card_key"] == "knight"


def test_record_play_unknown_card_raises(cards_by_key):
    """Playing unknown card raises ValueError."""
    start_game()
    with pytest.raises(ValueError, match="Unknown card"):
        record_play("nonexistent", cards_by_key)


def test_record_play_same_card_twice_without_mirror_raises(cards_by_key):
    """Cannot play same card twice without Mirror."""
    # Mock time: 10s between calls gives ~3.6 elixir regen each, enough for 8 cards
    with patch("game.opponent.time.time", side_effect=[1000 + t * 10 for t in range(50)]):
        start_game()
        # Build full deck with 1-2 elixir cards (total 12 elixir for 8 cards)
        for key in ["skeletons", "mirror", "goblins", "bomber", "knight", "archers", "cannon", "giant"]:
            record_play(key, cards_by_key)
        # Cycle: play 4 cards so knight is last
        for key in ["skeletons", "goblins", "bomber", "archers"]:
            record_play(key, cards_by_key)
        record_play("knight", cards_by_key)  # Knight now last (queue[7]), knight in hand
        with pytest.raises(ValueError, match="Cannot play same card twice"):
            record_play("knight", cards_by_key)


def test_record_play_mirror_copies_last_card(cards_by_key):
    """Mirror copies last card and costs last_elixir + 1."""
    # Knight 3, Mirror 4. Start 7.5. Need ~6s regen for 2 more elixir.
    times = [1000.0] * 5 + [1006.0] * 10  # First at 1000, second at 1006 (+2 elixir)
    with patch("game.opponent.time.time", side_effect=times):
        start_game()
        record_play("knight", cards_by_key)  # Knight costs 3 -> 7.5 - 3 = 4.5
        state = record_play("mirror", cards_by_key)  # Mirror copies knight, costs 4. 4.5 + 2.14 - 4 ~ 2.6
    assert state["plays"][-1]["card_key"] == "mirror"
    # Elixir: 7.5 - 3 (knight) = 4.5, +regen ~2.14, - 4 (mirror) ~ 2.6
    assert state["elixir"] < 4.0


def test_record_play_not_enough_elixir_raises(cards_by_key):
    """Playing card without enough elixir raises."""
    start_game()
    record_play("skeletons", cards_by_key)  # Drain to 6.5 (7.5 - 1)
    with pytest.raises(ValueError, match="Not enough elixir"):
        record_play("mega-knight", cards_by_key)  # Mega Knight costs 7, we have 6.5


def test_record_play_known_card_rotates_queue(cards_by_key):
    """Playing a known card (when deck full) rotates it from hand to back of queue."""
    with patch("game.opponent.time.time", side_effect=[1000 + t * 10 for t in range(100)]):
        start_game()
        # Build full deck - order matters: knight must be in first 4 for hand
        for key in ["knight", "skeletons", "mirror", "goblins", "bomber", "archers", "cannon", "giant"]:
            record_play(key, cards_by_key)
        # Deck full. Hand = [knight, skeletons, mirror, goblins]. Play knight -> rotates to back.
        state = record_play("knight", cards_by_key)
    assert len(state["deck"]) == 8
    assert state["queue"][-1] == "knight"


def test_record_ability_invalid_index_raises(cards_by_key):
    """record_ability with invalid index raises."""
    start_game()
    with pytest.raises(ValueError, match="Invalid ability_index"):
        record_ability(0)  # No ability cards in deck yet

    # Add a deck with ability card
    record_play("goblins", cards_by_key)  # goblins has ability_cost
    with pytest.raises(ValueError, match="Invalid ability_index"):
        record_ability(5)  # Index out of range


def test_record_ability_success(cards_by_key):
    """record_ability deducts elixir and returns state."""
    with patch("game.opponent.time.time", return_value=1000.0):
        start_game()
        record_play("goblins", cards_by_key)  # goblins has ability_cost: 1
        # We have 7.5 - 2 = 5.5 elixir. Ability costs 1. So we can use it.
        state = record_ability(0)
    assert abs(state["elixir"] - 4.5) < 0.01  # 5.5 - 1 = 4.5 (float tolerance)


def test_sync_game_success(cards_by_key):
    """sync_game sets elixir=10, time=2:50 when remaining >= 160."""
    with patch("game.opponent.time.time", return_value=1000.0):
        start_game()
        # At t=1000, game_started_at=997, remaining=180-3=177 >= 160
        state = sync_game()
    assert state["elixir"] == 10.0
    assert state["sync_used"] is True
    # game_started_at = 1000 - 10 = 990, so remaining = 180 - 10 = 170 (2:50)
    assert state["game_started_at"] == 990.0


def test_sync_game_already_used_raises(cards_by_key):
    """sync_game raises when sync already used."""
    with patch("game.opponent.time.time", return_value=1000.0):
        start_game()
        sync_game()
        with pytest.raises(ValueError, match="Sync already used"):
            sync_game()


def test_sync_game_too_late_raises(cards_by_key):
    """sync_game raises when remaining < 160."""
    with patch("game.opponent.time.time", return_value=1000.0):
        start_game()
        # Advance time so remaining < 160. game_started_at=996, need now such that 180-(now-996) < 160
        # So now > 996 + 20 = 1016
    with patch("game.opponent.time.time", return_value=1020.0):
        with pytest.raises(ValueError, match="Sync only valid"):
            sync_game()
