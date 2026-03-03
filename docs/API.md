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

Start a new game. Elixir begins at 5 and regenerates over time.

**Response:** `200 OK` — `OpponentState`

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
  "elixir": 5.0,
  "elixir_last_updated": 1700000000.0,
  "leaked": 0.0,
  "deck": ["knight", "skeletons"],
  "queue": ["?", "?", "?", "?", "?", "?", "knight", "skeletons"],
  "plays": [{"card_key": "knight"}, {"card_key": "skeletons"}],
  "ability_cards": []
}
```

- `elixir` — Current elixir (0–10). Regenerates 1 per 2.8 seconds.
- `leaked` — Elixir lost when pool was already at 10.
- `queue` — 8 slots: [0–3] = hand, [4–7] = next. `"?"` = unknown.
- `ability_cards` — Hero/champion cards with `ability_cost`.
