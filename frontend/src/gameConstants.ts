/**
 * Shared game constants from data/game-constants.json. Parity with backend.
 */
import gameConstantsJson from '../../data/game-constants.json'

export type GameMode = 'normal' | 'doubleElixir'

const raw = gameConstantsJson as Record<string, unknown>
export const GAME_MODES = Object.keys(raw).filter(
  (k) => !k.startsWith('_') && typeof raw[k] === 'object'
) as GameMode[]

export function getGameConstants(mode: GameMode = 'normal') {
  const m = (raw[mode] ?? raw.normal ?? {}) as Record<string, number>
  return {
    GAME_DURATION: m.GAME_DURATION ?? 180,
    OVERTIME_DURATION: m.OVERTIME_DURATION ?? 60,
    RATE_NORMAL: m.RATE_NORMAL ?? 2.8,
    RATE_DOUBLE: m.RATE_DOUBLE ?? 1.4,
    DOUBLE_ELIXIR_THRESHOLD: m.DOUBLE_ELIXIR_THRESHOLD ?? 60,
    SYNC_MIN_REMAINING: m.SYNC_MIN_REMAINING ?? 160,
    ELIXIR_CAP: m.ELIXIR_CAP ?? 10,
  }
}

// Default mode constants (for components that don't have mode context)
const defaultConstants = getGameConstants('normal')
export const GAME_DURATION = defaultConstants.GAME_DURATION
export const OVERTIME_DURATION = defaultConstants.OVERTIME_DURATION
export const RATE_NORMAL = defaultConstants.RATE_NORMAL
export const RATE_DOUBLE = defaultConstants.RATE_DOUBLE
export const DOUBLE_ELIXIR_THRESHOLD = defaultConstants.DOUBLE_ELIXIR_THRESHOLD
export const SYNC_MIN_REMAINING = defaultConstants.SYNC_MIN_REMAINING
export const ELIXIR_CAP = defaultConstants.ELIXIR_CAP
