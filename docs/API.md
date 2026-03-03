# ClashSim API Reference

Base URL: `http://127.0.0.1:8000` (development)

## Endpoints

### GET /api/cards

Returns the card catalog (loaded once at server startup).

**Response:** `200 OK`

```json
[
  {
    "key": "knight",
    "name": "Knight",
    "elixir": 3,
    "type": "Troop"
  },
  {
    "key": "goblins",
    "name": "Goblins",
    "elixir": 2,
    "type": "Troop",
    "ability_cost": 1
  }
]
```

---

### POST /api/opponent/start

Start a new game. Elixir 7.5, timer 2:57. Regenerates over time (1 per 2.8s; double at 1:00).

**Response:** `200 OK` — `OpponentState`

---

### POST /api/opponent/sync

One-time sync: set elixir=10, time=2:50. For load-in correction. Only valid when remaining >= 160 (~20s window).

**Response:** `200 OK` — `OpponentState`

**Errors:**
- `400` — Sync already used, or remaining < 160.

---

### POST /api/opponent/play

Record that the opponent played a card.

**Request body:**
```json
{
  "card_key": "knight"
}
```

**Response:** `200 OK` — `OpponentState`

**Errors:**
- `400` — Missing `card_key`, unknown card, not enough elixir, same card twice without Mirror, or card not in hand.

---

### POST /api/opponent/ability

Record that the opponent used a hero/champion ability.

**Request body:**
```json
{
  "ability_index": 0
}
```

`ability_index` is 0..N (index of ability card in deck order; one per ability card).

**Response:** `200 OK` — `OpponentState`

**Errors:**
- `400` — Invalid index or not enough elixir.

---

### GET /api/opponent/state

Return the current opponent state.

**Response:** `200 OK` — `OpponentState`

---

### POST /api/opponent/reset

Reset for a new game. Clears deck, queue, and elixir state.

**Response:** `200 OK` — `OpponentState`

---

## OpponentState

```json
{
  "started": true,
  "started_at": 1700000000.0,
  "game_started_at": 1700000000.0,
  "sync_used": false,
  "elixir": 7.5,
  "elixir_last_updated": 1700000000.0,
  "leaked": 0.0,
  "deck": ["knight", "skeletons"],
  "queue": ["?", "?", "?", "?", "?", "?", "knight", "skeletons"],
  "plays": [{"card_key": "knight"}, {"card_key": "skeletons"}],
  "ability_cards": []
}
```

- `game_started_at` — Unix timestamp for game clock. Remaining = 180 - (now - game_started_at).
- `sync_used` — True if sync was already used this game.
- `elixir` — Current elixir (0–10). Regenerates 1 per 2.8s normally; 1 per 1.4s when remaining < 60 or in overtime.
- `leaked` — Elixir lost when pool was already at 10.
- `queue` — 8 slots: [0–3] = hand, [4–7] = next. `"?"` = unknown.
- `ability_cards` — Hero/champion cards with `ability_cost`.
