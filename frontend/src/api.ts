import type { Card, GameSummary, OpponentState } from './types'

export async function fetchCards(): Promise<Card[]> {
  const res = await fetch('/api/cards')
  if (!res.ok) throw new Error('Failed to fetch cards')
  return res.json()
}

export async function fetchVoiceAliases(): Promise<Record<string, string>> {
  const res = await fetch('/api/voice-aliases')
  if (!res.ok) return {}
  return res.json()
}

export async function startGame(mode: string = 'normal'): Promise<OpponentState> {
  const res = await fetch('/api/opponent/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  })
  if (!res.ok) throw new Error('Failed to start game')
  return res.json()
}

export async function recordPlay(cardKey: string): Promise<OpponentState> {
  const res = await fetch('/api/opponent/play', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ card_key: cardKey }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = typeof err.detail === 'string' ? err.detail : err.detail?.[0]?.msg ?? 'Failed to record play'
    throw new Error(msg)
  }
  return res.json()
}

export async function recordAbility(abilityIndex: number): Promise<OpponentState> {
  const res = await fetch('/api/opponent/ability', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ability_index: abilityIndex }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = typeof err.detail === 'string' ? err.detail : err.detail?.[0]?.msg ?? 'Failed to record ability'
    throw new Error(msg)
  }
  return res.json()
}

export async function getOpponentState(): Promise<OpponentState> {
  const res = await fetch('/api/opponent/state')
  if (!res.ok) throw new Error('Failed to get state')
  return res.json()
}

export async function resetGame(): Promise<OpponentState> {
  const res = await fetch('/api/opponent/reset', { method: 'POST' })
  if (!res.ok) throw new Error('Failed to reset')
  return res.json()
}

export async function syncGame(): Promise<OpponentState> {
  const res = await fetch('/api/opponent/sync', { method: 'POST' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = typeof err.detail === 'string' ? err.detail : err.detail?.[0]?.msg ?? 'Failed to sync'
    throw new Error(msg)
  }
  return res.json()
}

export interface EndGameResponse extends OpponentState {
  game_summary: GameSummary | null
}

export async function endGame(): Promise<EndGameResponse> {
  const res = await fetch('/api/opponent/end', { method: 'POST' })
  if (!res.ok) throw new Error('Failed to end game')
  return res.json()
}
