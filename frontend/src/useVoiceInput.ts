/**
 * Voice input hook using Web Speech API.
 * Wake words: "play" (place card), "ability" (use ability).
 * Parses transcript and dispatches to onPlay / onAbility.
 */

/** Max words in a card phrase. All cards/aliases are 1–2 words (e.g. "archer queen", "three musk"). */
const MAX_CARD_PHRASE_WORDS = 2
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  cardsByKey: Record<string, Card>,
  cardsByName: Record<string, string>
): string | null {
  const normalized = text.toLowerCase().trim()
  if (!normalized) return null
  if (aliases[normalized]) return aliases[normalized]
  if (cardsByKey[normalized]) return normalized
  // Multi-word: "ice spirit" -> "ice-spirit" (card keys use hyphens)
  const hyphenated = normalized.replace(/\s+/g, '-')
  if (cardsByKey[hyphenated]) return hyphenated
  if (cardsByName[normalized]) return cardsByName[normalized]
  return null
}

/**
 * Parse transcript with wake words "play" and "ability".
 * Returns list of { type, cardKey?, index? }.
 * Uses O(1) lookups: try phrase lengths 2→1 (longest first), resolveToCardKey does
 * hashmap lookups (aliases, cardsByKey, hyphenated, cardsByName).
 */
function parseTranscript(
  transcript: string,
  aliases: Record<string, string>,
  cardsByKey: Record<string, Card>,
  cardsByName: Record<string, string>,
  abilityCards: { key: string }[]
): { type: 'play' | 'ability'; cardKey?: string; index?: number }[] {
  const tokens = transcript.toLowerCase().trim().split(/\s+/).filter(Boolean)
  const actions: { type: 'play' | 'ability'; cardKey?: string; index?: number }[] = []

  const tryMatch = (start: number): { cardKey: string; consumed: number } | null => {
    for (let len = Math.min(MAX_CARD_PHRASE_WORDS, tokens.length - start); len >= 1; len--) {
      const phrase = tokens.slice(start, start + len).join(' ')
      const cardKey = resolveToCardKey(phrase, aliases, cardsByKey, cardsByName)
      if (cardKey && cardsByKey[cardKey]) return { cardKey, consumed: len }
    }
    return null
  }

  let i = 0
  while (i < tokens.length) {
    const token = tokens[i]
    if (token === 'play') {
      i++
      while (i < tokens.length && tokens[i] !== 'ability' && tokens[i] !== 'play') {
        const match = tryMatch(i)
        if (match) {
          actions.push({ type: 'play', cardKey: match.cardKey })
          i += match.consumed
        } else {
          i++
        }
      }
    } else if (token === 'ability') {
      i++
      if (i >= tokens.length) break
      const match = tryMatch(i)
      if (match) {
        i += match.consumed
        const idx = abilityCards.findIndex((ac) => ac.key === match.cardKey)
        if (idx >= 0) actions.push({ type: 'ability', index: idx })
      } else {
        i++
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

  const cardsByName = useMemo(
    () =>
      Object.fromEntries(
        Object.values(cardsByKey).map((c) => [c.name.toLowerCase(), c.key])
      ),
    [cardsByKey]
  )

  const [isListening, setIsListening] = useState(false)
  const [logEntries, setLogEntries] = useState<VoiceLogEntry[]>([])
  const logIdRef = useRef(0)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const mutedRef = useRef(muted)
  const gameStartedRef = useRef(gameStarted)
  const callbacksRef = useRef(callbacks)
  const abilityCardsRef = useRef(abilityCards)
  const aliasesRef = useRef(aliases)
  const cardsByKeyRef = useRef(cardsByKey)
  const cardsByNameRef = useRef(cardsByName)
  mutedRef.current = muted
  gameStartedRef.current = gameStarted
  callbacksRef.current = callbacks
  abilityCardsRef.current = abilityCards
  aliasesRef.current = aliases
  cardsByKeyRef.current = cardsByKey
  cardsByNameRef.current = cardsByName

  const processTranscriptRef = useRef<(t: string) => Promise<void>>(async () => {})
  const processTranscript = useCallback(
    async (transcript: string) => {
      if (mutedRef.current || !gameStartedRef.current || !transcript.trim()) return
      const actions = parseTranscript(
        transcript,
        aliasesRef.current,
        cardsByKeyRef.current,
        cardsByNameRef.current,
        abilityCardsRef.current
      )

      const items: { label: string; success: boolean }[] = []
      if (actions.length === 0) {
        items.push({ label: 'No matching commands (say "play knight" or "ability knight")', success: false })
      }
      const { onPlay, onAbility } = callbacksRef.current
      for (const a of actions) {
        if (a.type === 'play' && a.cardKey) {
          const cardName = cardsByKeyRef.current[a.cardKey]?.name ?? a.cardKey
          try {
            const { success, error } = await onPlay(a.cardKey)
            items.push({
              label: success ? `${cardName} ✓` : `${cardName}: ${error ?? 'failed'}`,
              success,
            })
          } catch {
            items.push({ label: `${cardName}: failed`, success: false })
          }
        } else if (a.type === 'ability' && a.index !== undefined) {
          const ac = abilityCardsRef.current[a.index]
          const cardName = cardsByKeyRef.current[ac?.key]?.name ?? ac?.key ?? 'ability'
          try {
            const { success, error } = await onAbility(a.index)
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
    []
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
      if (gameStartedRef.current) {
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
  }, [])

  useEffect(() => {
    const rec = recognitionRef.current
    if (!rec) return
    if (gameStarted) {
      try {
        rec.start()
      } catch {
        // ignore
      }
    }
  }, [gameStarted])

  const clearLog = useCallback(() => setLogEntries([]), [])

  return { isListening, logEntries, clearLog }
}
