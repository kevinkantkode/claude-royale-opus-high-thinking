"""
Pydantic schemas for API request/response validation and OpenAPI documentation.
Matches frontend types in frontend/src/types.ts.
"""
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict


class CardPlayGroup(BaseModel):
    """Cards grouped by play count for condensed overlay display."""

    count: int
    card_keys: list[str]


class AbilityStat(BaseModel):
    """Ability usage stat for game summary (only abilities that were used)."""

    ability_index: int
    card_key: str
    ability_cost: int
    count: int


class GameSummary(BaseModel):
    """Aggregated stats for end game overlay. Use extra='allow' for future fields."""

    model_config = ConfigDict(extra="allow")

    leaked: float
    card_play_groups: list[CardPlayGroup]
    ability_stats: list[AbilityStat]
    total_ability_elixir: float


class Card(BaseModel):
    """Card from the catalog. Matches frontend Card interface."""

    model_config = ConfigDict(extra="allow")

    key: str
    name: str
    elixir: int
    type: Literal["Troop", "Building", "Spell"]
    ability_cost: Optional[int] = None
    is_mirror: Optional[bool] = None


class PlayRequest(BaseModel):
    """Request body for POST /api/opponent/play."""

    card_key: str


class AbilityRequest(BaseModel):
    """Request body for POST /api/opponent/ability."""

    ability_index: int = 0


class StartRequest(BaseModel):
    """Request body for POST /api/opponent/start."""

    mode: str = "normal"


class PlayRecord(BaseModel):
    """Single play in the plays history."""

    card_key: str


class AbilityCardRecord(BaseModel):
    """Ability card (hero/champion) in the deck."""

    key: str
    ability_cost: int


class OpponentState(BaseModel):
    """Current opponent state. Returned by play, ability, start, reset, sync, state endpoints."""

    model_config = ConfigDict(extra="allow")

    started: bool
    started_at: float
    game_started_at: float
    sync_used: bool
    elixir: float
    elixir_last_updated: float
    leaked: float
    deck: list[str]
    queue: list[str]
    plays: list[PlayRecord]
    ability_cards: list[AbilityCardRecord]
    game_mode: str = "normal"


class EndGameResponse(OpponentState):
    """Opponent state plus game summary. Returned by POST /api/opponent/end."""

    game_summary: Optional[GameSummary] = None
