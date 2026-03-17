import type { Card, GameSummary, OpponentState } from './types'

async function parseJsonOrThrow<T>(res: Response, context: string): Promise<T> {
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    const preview = text.slice(0, 80).replace(/\s+/g, ' ')
    throw new Error(`${context}: got non-JSON response (backend down?). Preview: ${preview}`)
  }
}

export async function fetchCards(): Promise<Card[]> {
  const res = await fetch('/api/cards')
  if (!res.ok) throw new Error('Failed to fetch cards')
  return parseJsonOrThrow<Card[]>(res, 'fetchCards')
}

export async function fetchVoiceAliases(): Promise<Record<string, string>> {
  const res = await fetch('/api/voice-aliases')
  if (!res.ok) return {}
  return parseJsonOrThrow<Record<string, string>>(res, 'fetchVoiceAliases')
}

export async function startGame(mode: string = 'normal'): Promise<OpponentState> {
  const res = await fetch('/api/opponent/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  })
  if (!res.ok) throw new Error('Failed to start game')
  return parseJsonOrThrow<OpponentState>(res, 'startGame')
}

export async function recordUndo(): Promise<OpponentState> {
  const res = await fetch('/api/opponent/undo', { method: 'POST' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = typeof err.detail === 'string' ? err.detail : err.detail?.[0]?.msg ?? 'Failed to undo'
    throw new Error(msg)
  }
  return parseJsonOrThrow<OpponentState>(res, 'recordUndo')
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
  return parseJsonOrThrow<OpponentState>(res, 'recordPlay')
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
  return parseJsonOrThrow<OpponentState>(res, 'recordAbility')
}

export async function getOpponentState(): Promise<OpponentState> {
  const res = await fetch('/api/opponent/state')
  if (!res.ok) throw new Error('Failed to get state')
  return parseJsonOrThrow<OpponentState>(res, 'getOpponentState')
}

export async function resetGame(): Promise<OpponentState> {
  const res = await fetch('/api/opponent/reset', { method: 'POST' })
  if (!res.ok) throw new Error('Failed to reset')
  return parseJsonOrThrow<OpponentState>(res, 'resetGame')
}

export async function syncGame(): Promise<OpponentState> {
  const res = await fetch('/api/opponent/sync', { method: 'POST' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = typeof err.detail === 'string' ? err.detail : err.detail?.[0]?.msg ?? 'Failed to sync'
    throw new Error(msg)
  }
  return parseJsonOrThrow<OpponentState>(res, 'syncGame')
}

export interface EndGameResponse extends OpponentState {
  game_summary: GameSummary | null
}

export async function endGame(): Promise<EndGameResponse> {
  const res = await fetch('/api/opponent/end', { method: 'POST' })
  if (!res.ok) throw new Error('Failed to end game')
  return parseJsonOrThrow<EndGameResponse>(res, 'endGame')
}

export interface VisionClassifyResponse {
  results: { label: string; score: number }[]
}

export async function visionClassify(imageBase64: string, labels: string[]): Promise<VisionClassifyResponse> {
  const res = await fetch('/api/vision/classify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageBase64, labels }),
  })
  if (!res.ok) {
    const text = await res.text()
    let msg: string
    try {
      const err = JSON.parse(text)
      msg = typeof err.detail === 'string' ? err.detail : err.detail?.[0]?.msg ?? text
    } catch {
      msg = text.slice(0, 100)
    }
    throw new Error(`Vision classify failed: ${msg}`)
  }
  return parseJsonOrThrow<VisionClassifyResponse>(res, 'visionClassify')
}
