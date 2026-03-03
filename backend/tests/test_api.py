"""
Integration tests for API endpoints.
"""
import json
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from api.main import app
from game.opponent import reset

# Load real cards for API tests (lifespan may not persist across TestClient requests)
def _load_cards():
    data_dir = Path(__file__).resolve().parent.parent.parent / "data"
    path = data_dir / "cards.json"
    if not path.exists():
        return []
    with open(path) as f:
        return json.load(f)

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_before_test():
    """Reset opponent state before each API test."""
    reset()
    yield


def test_get_cards():
    """GET /api/cards returns card list from cache."""
    res = client.get("/api/cards")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    if data:
        assert "key" in data[0]
        assert "name" in data[0]
        assert "elixir" in data[0]


def test_get_voice_aliases():
    """GET /api/voice-aliases returns alias map."""
    res = client.get("/api/voice-aliases")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, dict)
    # Check a few expected aliases
    assert data.get("skarmy") == "skeleton-army"
    assert data.get("log") == "the-log"


def test_opponent_start():
    """POST /api/opponent/start starts game and returns state."""
    res = client.post("/api/opponent/start")
    assert res.status_code == 200
    data = res.json()
    assert data["started"] is True
    assert abs(data["elixir"] - 5.0) < 0.01
    assert data["deck"] == []


def test_opponent_play_success():
    """POST /api/opponent/play records a card play."""
    with patch("api.main.get_cards", side_effect=_load_cards):
        client.post("/api/opponent/start")
        res = client.post("/api/opponent/play", json={"card_key": "knight"})
    assert res.status_code == 200
    data = res.json()
    assert "knight" in data["deck"]
    assert len(data["plays"]) == 1
    assert data["plays"][0]["card_key"] == "knight"


def test_opponent_play_missing_card_key():
    """POST /api/opponent/play without card_key returns 400."""
    res = client.post("/api/opponent/play", json={})
    assert res.status_code == 422  # Pydantic validation error


def test_opponent_play_unknown_card():
    """POST /api/opponent/play with unknown card returns 400."""
    client.post("/api/opponent/start")
    res = client.post("/api/opponent/play", json={"card_key": "nonexistent-card-xyz"})
    assert res.status_code == 400


def test_opponent_ability_success():
    """POST /api/opponent/ability records ability use."""
    with patch("api.main.get_cards", side_effect=_load_cards):
        client.post("/api/opponent/start")
        client.post("/api/opponent/play", json={"card_key": "goblins"})  # Has ability_cost
        res = client.post("/api/opponent/ability", json={"ability_index": 0})
    assert res.status_code == 200
    data = res.json()
    assert abs(data["elixir"] - 2.0) < 0.01  # 5 - 2 (goblins) - 1 (ability) = 2


def test_opponent_ability_no_ability_cards():
    """POST /api/opponent/ability with no ability cards returns 400."""
    client.post("/api/opponent/start")
    res = client.post("/api/opponent/ability", json={"ability_index": 0})
    assert res.status_code == 400


def test_opponent_state():
    """GET /api/opponent/state returns current state."""
    res = client.get("/api/opponent/state")
    assert res.status_code == 200
    data = res.json()
    assert "started" in data
    assert "elixir" in data
    assert "deck" in data


def test_opponent_reset():
    """POST /api/opponent/reset clears state."""
    client.post("/api/opponent/start")
    client.post("/api/opponent/play", json={"card_key": "knight"})
    res = client.post("/api/opponent/reset")
    assert res.status_code == 200
    data = res.json()
    assert data["started"] is False
    assert data["deck"] == []
