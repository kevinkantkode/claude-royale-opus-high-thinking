"""
Pydantic schemas for API request/response validation and OpenAPI documentation.
Matches frontend types in frontend/src/types.ts.
"""
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict


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


class PlayRecord(BaseModel):
    """Single play in the plays history."""

    card_key: str


class AbilityCardRecord(BaseModel):
    """Ability card (hero/champion) in the deck."""

    key: str
    ability_cost: int


class OpponentState(BaseModel):
    """Current opponent state. Returned by play, ability, start, reset, state endpoints."""

    started: bool
    started_at: float
    elixir: float
    elixir_last_updated: float
    leaked: float
    deck: list[str]
    queue: list[str]
    plays: list[PlayRecord]
    ability_cards: list[AbilityCardRecord]
