/**
 * Card - matches output of fetch_cards.py
 */
export interface Card {
  key: string
  name: string
  elixir: number
  type: 'Troop' | 'Building' | 'Spell'
  ability_cost?: number  // hero or champion ability (extra elixir)
  is_mirror?: boolean   // Mirror: actual cost = last_played.elixir + 1
}

export interface OpponentState {
  started: boolean
  started_at: number
  game_started_at: number
  sync_used: boolean
  elixir: number
  elixir_last_updated: number
  leaked: number
  deck: string[]
  queue: string[]
  plays: { card_key: string }[]
  ability_cards: { key: string; ability_cost: number }[]
  game_mode?: string
}

/** Stats for end-game overlay. Cards grouped by usage count for condensed display. */
export interface GameSummary {
  leaked: number
  card_play_groups: { count: number; card_keys: string[] }[]
  ability_stats: { ability_index: number; card_key: string; ability_cost: number; count: number }[]
  total_ability_elixir: number
}
