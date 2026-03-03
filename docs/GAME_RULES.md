# ClashSim Game Rules

## Elixir

- **Start:** 5 elixir when the game begins.
- **Regen:** 1 elixir per 2.8 seconds (1v1 rate).
- **Cap:** 10 elixir. Excess is tracked as "leaked".
- **Display:** Backend stores `elixir` and `elixir_last_updated`; frontend advances to current time for display.

## Deck and Queue

- **Deck:** Up to 8 cards. Discovered as the opponent plays.
- **Queue:** 8 slots. Slots 1–4 = hand, slots 5–8 = next.
- **New card:** When the opponent plays a card not in the deck, it is added (if deck < 8 and rules allow).
- **Known card:** Must be in hand (slots 1–4). Playing it moves it to the back of the queue.

## Same-Card-Twice Rule

You cannot play the same card twice in a row. The last played card is in `queue[7]`.

**Exception:** Use **Mirror** to copy the last card. Mirror costs `last_card.elixir + 1`.

Example: Knight (3) → Mirror (4) = Knight played again, costing 4 elixir.

## Mirror

- **Cost:** Base cost of the copied card + 1.
- **Usage:** Click Mirror after any play to copy that card.
- **Example:** Last play was Knight (3 elixir) → Mirror costs 4.

## Ability Cards

- **Unlimited** ability cards (hero/champion) per deck. User tracks which card used which ability.
- **Ability cost:** Extra elixir to use the ability (e.g. Goblins +1).
- **Recording:** Use POST `/api/opponent/ability` with `ability_index` 0..N (index of ability card in deck order).
