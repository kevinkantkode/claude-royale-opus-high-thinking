import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchCards,
  fetchVoiceAliases,
  getOpponentState,
  recordAbility,
  recordPlay,
  resetGame,
  startGame,
} from './api'
import type { Card, OpponentState } from './types'
import { CardDisplay } from './CardDisplay'
import { useVoiceInput } from './useVoiceInput'
import { VoiceFeedback } from './VoiceFeedback'
import './App.css'

/** O(1) advance: backend sends (elixir, last_updated); frontend advances to now for display. */
function advanceElixir(
  elixir: number,
  lastUpdated: number,
  leaked: number,
  nowSec: number
): { elixir: number; leaked: number } {
  const regen = (nowSec - lastUpdated) / 2.8
  const wouldBe = elixir + regen
  if (wouldBe > 10) leaked += wouldBe - 10
  return { elixir: Math.min(10, wouldBe), leaked }
}

function getPlayCost(
  card: Card,
  queue: string[],
  cardsByKey: Record<string, Card>
): number {
  const lastKey = queue[7] && queue[7] !== '?' ? queue[7] : null
  const lastCard = lastKey ? cardsByKey[lastKey] : null
  if (card.key === 'mirror' && lastCard) return lastCard.elixir + 1
  return card.elixir
}

function App() {
  const [cards, setCards] = useState<Card[]>([])
  const [opponentState, setOpponentState] = useState<OpponentState | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [voiceAliases, setVoiceAliases] = useState<Record<string, string>>({})
  const [voiceMuted, setVoiceMuted] = useState(false)
  const [, setTick] = useState(0)

  // Elixir tick when game started
  useEffect(() => {
    if (!opponentState?.started) return
    const id = setInterval(() => setTick((t) => t + 1), 100)
    return () => clearInterval(id)
  }, [opponentState?.started])

  // Load cards, voice aliases, and initial state
  useEffect(() => {
    Promise.all([fetchCards(), fetchVoiceAliases(), getOpponentState()])
      .then(([c, a, s]) => {
        setCards(c)
        setVoiceAliases(a)
        setOpponentState(s)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const handleStart = useCallback(() => {
    if (pending) return
    setError(null)
    setPending(true)
    startGame()
      .then(setOpponentState)
      .catch((e) => setError(e.message))
      .finally(() => setPending(false))
  }, [pending])

  const handleReset = useCallback(() => {
    if (pending) return
    setError(null)
    setPending(true)
    resetGame()
      .then(setOpponentState)
      .catch((e) => setError(e.message))
      .finally(() => setPending(false))
  }, [pending])

  const handlePlay = useCallback(
    (cardKey: string) => {
      if (pending) return Promise.resolve({ success: false, error: 'Request in progress' })
      setError(null)
      setPending(true)
      return recordPlay(cardKey)
        .then((s) => {
          setOpponentState(s)
          return { success: true }
        })
        .catch((e) => {
          setError(e.message)
          return { success: false, error: e.message }
        })
        .finally(() => setPending(false))
    },
    [pending]
  )

  const handleAbility = useCallback(
    (index: number) => {
      if (pending) return Promise.resolve({ success: false, error: 'Request in progress' })
      setError(null)
      setPending(true)
      return recordAbility(index)
        .then((s) => {
          setOpponentState(s)
          return { success: true }
        })
        .catch((e) => {
          setError(e.message)
          return { success: false, error: e.message }
        })
        .finally(() => setPending(false))
    },
    [pending]
  )

  const cardsByKey = useMemo(
    () => Object.fromEntries(cards.map((c) => [c.key, c])),
    [cards]
  )

  const speechSupported =
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition)

  const voiceInput = useVoiceInput({
    aliases: voiceAliases,
    cardsByKey,
    abilityCards: opponentState?.ability_cards ?? [],
    callbacks: { onPlay: handlePlay, onAbility: handleAbility },
    gameStarted: opponentState?.started ?? false,
    muted: voiceMuted,
  })

  const filteredCards = useMemo(
    () =>
      cards.filter(
        (c) =>
          !search ||
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.key.toLowerCase().includes(search.toLowerCase())
      ),
    [cards, search]
  )

  const cardsByElixir = useMemo(
    () =>
      filteredCards.reduce<Record<number, Card[]>>((acc, c) => {
        const cost = c.elixir
        if (!acc[cost]) acc[cost] = []
        acc[cost].push(c)
        return acc
      }, {}),
    [filteredCards]
  )

  const hand = useMemo(
    () => (opponentState?.queue ?? []).slice(0, 4).filter((k) => k && k !== '?'),
    [opponentState?.queue]
  )

  const lastKey = useMemo(() => {
    const q7 = opponentState?.queue?.[7]
    return q7 && q7 !== '?' ? q7 : null
  }, [opponentState?.queue])

  if (loading) return <div className="app">Loading...</div>
  if (!opponentState) return <div className="app">Loading state...</div>

  const nowSec = Date.now() / 1000
  const { elixir, leaked } = opponentState.started
    ? advanceElixir(
        opponentState.elixir,
        opponentState.elixir_last_updated,
        opponentState.leaked,
        nowSec
      )
    : { elixir: 5, leaked: 0 }
  const deck = opponentState.deck
  const deckFull = deck.length >= 8

  const canRecordPlay = (c: Card) => {
    if (!opponentState.started) return false
    const cost = getPlayCost(c, opponentState.queue, cardsByKey)
    if (elixir < cost) return false
    // Same card twice: cannot play without Mirror
    if (lastKey === c.key && c.key !== 'mirror') return false
    if (deck.includes(c.key)) {
      if (!deckFull) return true
      // Deck full: only cards in hand (slots 1-4) are playable
      return hand.includes(c.key)
    }
    if (deckFull) return false
    return true
  }

  return (
    <div className="app">
      {error && (
        <div className="error-toast" role="alert">
          <span className="error-toast-message">{error}</span>
          <button
            type="button"
            className="error-toast-dismiss"
            onClick={() => setError(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
      <header>
        <h1>ClashSim Helper</h1>
        <p>Opponent elixir & card tracker</p>
      </header>

      <div className="app-main">
        <section className={`cards-preview ${deckFull ? 'deck-full' : ''}`}>
        {deckFull ? (
          <>
            <h2>Deck — Record play</h2>
            <div className="card-grid deck-grid">
              {deck
                .filter((key) => key && key !== '?' && cardsByKey[key])
                .map((key) => {
                  const c = cardsByKey[key]!
                  return (
                    <button
                      key={c.key}
                      className="card-item"
                      disabled={pending || !canRecordPlay(c)}
                      onClick={() => handlePlay(c.key)}
                      title={
                        elixir < getPlayCost(c, opponentState.queue, cardsByKey)
                          ? `Not enough elixir (need ${getPlayCost(c, opponentState.queue, cardsByKey)})`
                          : lastKey === c.key && c.key !== 'mirror'
                          ? 'Cannot play same card twice; use Mirror'
                          : deck.includes(c.key) && deckFull && !hand.includes(c.key)
                          ? 'Not in hand (only slots 1-4 are playable)'
                          : 'Record play'
                      }
                    >
                      <CardDisplay card={c} variant="base" />
                    </button>
                  )
                })}
            </div>
          </>
        ) : (
          <>
            <h2>Cards — Record play</h2>
            <input
              type="text"
              className="card-search"
              placeholder="Search cards..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((cost) => {
              const group = cardsByElixir[cost]
              if (!group?.length) return null
              return (
                <div key={cost} className="card-group">
                  <h3 className="card-group-header">{cost} Elixir</h3>
                  <div className="card-grid">
                    {group.map((c) => (
                      <button
                        key={c.key}
                        className="card-item"
                        disabled={pending || !canRecordPlay(c)}
                        onClick={() => handlePlay(c.key)}
                        title={
                          elixir < getPlayCost(c, opponentState.queue, cardsByKey)
                            ? `Not enough elixir (need ${getPlayCost(c, opponentState.queue, cardsByKey)})`
                            : lastKey === c.key && c.key !== 'mirror'
                            ? 'Cannot play same card twice; use Mirror'
                            : deck.includes(c.key) && deckFull && !hand.includes(c.key)
                            ? 'Not in hand (only slots 1-4 are playable)'
                            : deck.includes(c.key)
                            ? 'Record play'
                            : deckFull
                            ? 'Not in opponent deck'
                            : 'Record play'
                        }
                      >
                        <CardDisplay card={c} variant="base" />
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </>
        )}
        </section>

        <aside className="opponent-tracker">
        <h2>Opponent</h2>
        {!opponentState.started ? (
          <button
            className="btn btn-primary"
            disabled={pending}
            onClick={handleStart}
          >
            Start game
          </button>
        ) : (
          <>
            <div className="elixir-section">
              <div className="elixir-row">
                <div className="elixir-bar">
                  <div
                    className="elixir-fill"
                    style={{ width: `${(elixir / 10) * 100}%` }}
                  />
                  <div className="elixir-ticks" aria-hidden="true" />
                </div>
                <span className="elixir-value">{elixir.toFixed(1)}</span>
              </div>
              {leaked > 0 && (
                <span className="elixir-leaked">Leaked: {leaked.toFixed(1)}</span>
              )}
            </div>

            <div className="queue-section">
              <h3>Queue</h3>
              <div className="queue-hand">
                <span className="queue-label">In hand</span>
                <div className="queue-slots">
                  {opponentState.queue.slice(0, 4).map((q, i) => (
                    <div key={i} className="queue-slot">
                      {q === '?' ? '?' : cardsByKey[q] ? (
                        <CardDisplay card={cardsByKey[q]} variant="base" />
                      ) : (
                        q
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="queue-next">
                <span className="queue-label">Next</span>
                <div className="queue-slots">
                  {opponentState.queue.slice(4, 8).map((q, i) => (
                    <div key={i + 4} className="queue-slot">
                      {q === '?' ? '?' : cardsByKey[q] ? (
                        <CardDisplay card={cardsByKey[q]} variant="base" />
                      ) : (
                        q
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {opponentState.ability_cards.length > 0 && (
              <div className="ability-section">
                <h3>Ability</h3>
                {opponentState.ability_cards.map((ac, i) => (
                  <button
                    key={i}
                    className="btn btn-ability"
                    disabled={pending || elixir < ac.ability_cost}
                    onClick={() => handleAbility(i)}
                    title={
                      elixir < ac.ability_cost
                        ? `Not enough elixir (need ${ac.ability_cost})`
                        : undefined
                    }
                  >
                    <CardDisplay card={cardsByKey[ac.key]} variant="ability" />
                    <span className="ability-cost">+{ac.ability_cost}</span>
                  </button>
                ))}
              </div>
            )}

            <button
              className="btn btn-reset"
              disabled={pending}
              onClick={handleReset}
            >
              Reset
            </button>

            <VoiceFeedback
              isListening={voiceInput.isListening}
              muted={voiceMuted}
              onMuteToggle={() => setVoiceMuted((m) => !m)}
              logEntries={voiceInput.logEntries}
              onClearLog={voiceInput.clearLog}
              speechSupported={speechSupported}
            />
          </>
        )}
        </aside>
      </div>
    </div>
  )
}

export default App
