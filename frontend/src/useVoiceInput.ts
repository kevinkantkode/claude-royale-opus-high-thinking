/**
 * Voice input hook using Web Speech API.
 * Wake words: "play" (place card), "ability" (use ability).
 * Parses transcript and dispatches to onPlay / onAbility.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Card } from './types'

export interface VoiceLogEntry {
  id: number
  heard: string
  items: { label: string; success: boolean }[]
}

export interface VoiceInputCallbacks {
  onPlay: (cardKey: string) => Promise<{ success: boolean; error?: string }>
  onAbility: (index: number) => Promise<{ success: boolean; error?: string }>
}

function resolveToCardKey(
  text: string,
  aliases: Record<string, string>,
  cardsByKey: Record<string, Card>
): string | null {
  const normalized = text.toLowerCase().trim()
  if (!normalized) return null
  if (aliases[normalized]) return aliases[normalized]
  if (cardsByKey[normalized]) return normalized
  // Multi-word: "ice spirit" -> "ice-spirit" (card keys use hyphens)
  const hyphenated = normalized.replace(/\s+/g, '-')
  if (cardsByKey[hyphenated]) return hyphenated
  for (const card of Object.values(cardsByKey)) {
    if (card.name.toLowerCase() === normalized) return card.key
  }
  return null
}

/**
 * Parse transcript with wake words "play" and "ability".
 * Returns list of { type, cardKey?, index? }.
 */
function parseTranscript(
  transcript: string,
  aliases: Record<string, string>,
  cardsByKey: Record<string, Card>,
  abilityCards: { key: string }[]
): { type: 'play' | 'ability'; cardKey?: string; index?: number }[] {
  const tokens = transcript.toLowerCase().trim().split(/\s+/).filter(Boolean)
  const actions: { type: 'play' | 'ability'; cardKey?: string; index?: number }[] = []
  const aliasKeys = Object.keys(aliases).sort((a, b) => b.length - a.length)

  let i = 0
  while (i < tokens.length) {
    const token = tokens[i]
    if (token === 'play') {
      i++
      while (i < tokens.length && tokens[i] !== 'ability' && tokens[i] !== 'play') {
        let matched = false
        for (const aliasKey of aliasKeys) {
          const aliasWords = aliasKey.split(' ')
          const slice = tokens.slice(i, i + aliasWords.length).join(' ')
          if (slice === aliasKey) {
            const cardKey = aliases[aliasKey]
            if (cardsByKey[cardKey]) {
              actions.push({ type: 'play', cardKey })
              i += aliasWords.length
              matched = true
              break
            }
          }
        }
        if (!matched) {
          // Try longest token span first: "ice spirit" before "ice"
          let cardKey: string | null = null
          let consumed = 0
          for (let len = Math.min(4, tokens.length - i); len >= 1; len--) {
            const phrase = tokens.slice(i, i + len).join(' ')
            cardKey = resolveToCardKey(phrase, aliases, cardsByKey)
            if (cardKey) {
              consumed = len
              break
            }
          }
          if (cardKey) {
            actions.push({ type: 'play', cardKey })
            i += consumed
          } else {
            i++
          }
        }
      }
    } else if (token === 'ability') {
      i++
      if (i >= tokens.length) break
      let cardKey: string | null = null
      for (const aliasKey of aliasKeys) {
        const aliasWords = aliasKey.split(' ')
        const slice = tokens.slice(i, i + aliasWords.length).join(' ')
        if (slice === aliasKey) {
          cardKey = aliases[aliasKey]
          i += aliasWords.length
          break
        }
      }
      if (!cardKey) {
        for (let len = Math.min(4, tokens.length - i); len >= 1; len--) {
          const phrase = tokens.slice(i, i + len).join(' ')
          cardKey = resolveToCardKey(phrase, aliases, cardsByKey)
          if (cardKey) {
            i += len
            break
          }
        }
        if (!cardKey) i++
      }
      if (cardKey) {
        const idx = abilityCards.findIndex((ac) => ac.key === cardKey)
        if (idx >= 0) {
          actions.push({ type: 'ability', index: idx })
        }
      }
    } else {
      i++
    }
  }
  return actions
}

export function useVoiceInput(
  options: {
    aliases: Record<string, string>
    cardsByKey: Record<string, Card>
    abilityCards: { key: string; ability_cost: number }[]
    callbacks: VoiceInputCallbacks
    gameStarted: boolean
    muted: boolean
  }
) {
  const {
    aliases,
    cardsByKey,
    abilityCards,
    callbacks,
    gameStarted,
    muted,
  } = options

  const [isListening, setIsListening] = useState(false)
  const [logEntries, setLogEntries] = useState<VoiceLogEntry[]>([])
  const logIdRef = useRef(0)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const processTranscriptRef = useRef<(t: string) => Promise<void>>(async () => {})
  const processTranscript = useCallback(
    async (transcript: string) => {
      if (!gameStarted || !transcript.trim()) return
      const actions = parseTranscript(transcript, aliases, cardsByKey, abilityCards)

      const items: { label: string; success: boolean }[] = []
      if (actions.length === 0) {
        items.push({ label: 'No matching commands (say "play knight" or "ability knight")', success: false })
      }
      for (const a of actions) {
        if (a.type === 'play' && a.cardKey) {
          const cardName = cardsByKey[a.cardKey]?.name ?? a.cardKey
          try {
            const { success, error } = await callbacks.onPlay(a.cardKey)
            items.push({
              label: success ? `${cardName} ✓` : `${cardName}: ${error ?? 'failed'}`,
              success,
            })
          } catch {
            items.push({ label: `${cardName}: failed`, success: false })
          }
        } else if (a.type === 'ability' && a.index !== undefined) {
          const ac = abilityCards[a.index]
          const cardName = cardsByKey[ac?.key]?.name ?? ac?.key ?? 'ability'
          try {
            const { success, error } = await callbacks.onAbility(a.index)
            items.push({
              label: success ? `${cardName} ability ✓` : `${cardName} ability: ${error ?? 'failed'}`,
              success,
            })
          } catch {
            items.push({ label: `${cardName} ability: failed`, success: false })
          }
        }
      }
      setLogEntries((prev) => [
        ...prev,
        { id: ++logIdRef.current, heard: transcript.trim(), items },
      ])
    },
    [
      gameStarted,
      aliases,
      cardsByKey,
      abilityCards,
      callbacks,
    ]
  )
  processTranscriptRef.current = processTranscript

  useEffect(() => {
    const SpeechRecognitionClass =
      typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition)
    if (!SpeechRecognitionClass) return

    const recognition = new SpeechRecognitionClass()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const last = event.results.length - 1
      const result = event.results[last]
      const transcript = Array.from(result)
        .map((r: SpeechRecognitionAlternative) => r.transcript)
        .join(' ')
        .trim()
      if (transcript && result.isFinal) {
        processTranscriptRef.current(transcript)
      }
    }

    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => {
      setIsListening(false)
      if (!muted && gameStarted) {
        try {
          recognition.start()
        } catch {
          // Ignore restart errors
        }
      }
    }
    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setIsListening(false)
      }
    }

    recognitionRef.current = recognition
    return () => {
      try {
        recognition.stop()
      } catch {
        // ignore
      }
      recognitionRef.current = null
    }
  }, [gameStarted, muted])

  useEffect(() => {
    const rec = recognitionRef.current
    if (!rec) return
    if (muted || !gameStarted) {
      try {
        rec.stop()
      } catch {
        // ignore
      }
      setIsListening(false)
    } else {
      try {
        rec.start()
      } catch {
        // ignore
      }
    }
  }, [muted, gameStarted])

  const clearLog = useCallback(() => setLogEntries([]), [])

  return { isListening, logEntries, clearLog }
}
