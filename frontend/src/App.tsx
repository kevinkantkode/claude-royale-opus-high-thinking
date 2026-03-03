import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchCards,
  fetchVoiceAliases,
  getOpponentState,
  recordAbility,
  recordPlay,
  resetGame,
  startGame,
  syncGame,
} from './api'
import type { Card, OpponentState } from './types'
import { ELIXIR_CAP, getGameConstants, type GameMode, GAME_MODES } from './gameConstants'
import { CardDisplay } from './CardDisplay'
import { useVoiceInput } from './useVoiceInput'
import { VoiceFeedback } from './VoiceFeedback'
import './App.css'

/** O(1) advance: backend sends (elixir, last_updated); frontend advances to now for display. */
function advanceElixir(
  elixir: number,
  lastUpdated: number,
  leaked: number,
  nowSec: number,
  rate: number,
  cap: number = ELIXIR_CAP
): { elixir: number; leaked: number } {
  const regen = (nowSec - lastUpdated) / rate
  const wouldBe = elixir + regen
  if (wouldBe > cap) leaked += wouldBe - cap
  return { elixir: Math.min(cap, wouldBe), leaked }
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
  const [gameMode, setGameMode] = useState<GameMode>('normal')
  const [nowSec, setNowSec] = useState(() => Date.now() / 1000)

  // Elixir tick when game started
  useEffect(() => {
    if (!opponentState?.started) return
    const id = setInterval(() => setNowSec(Date.now() / 1000), 100)
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
    startGame(gameMode)
      .then(setOpponentState)
      .catch((e) => setError(e.message))
      .finally(() => setPending(false))
  }, [pending, gameMode])

  const handleReset = useCallback(() => {
    if (pending) return
    setError(null)
    setPending(true)
    resetGame()
      .then(setOpponentState)
      .catch((e) => setError(e.message))
      .finally(() => setPending(false))
  }, [pending])

  const handleSync = useCallback(() => {
    if (pending) return
    setError(null)
    setPending(true)
    syncGame()
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

  /** Base elixir cost from card catalog. Computed once when cards load; never changes. */
  const baseCostByKey = useMemo(
    () => Object.fromEntries(cards.map((c) => [c.key, c.elixir])),
    [cards]
  )
  /** Cost for card c. Mirror uses lastCard.elixir+1; others use base. */
  const getCost = (c: Card) =>
    c.key === 'mirror' && lastKey && cardsByKey[lastKey]
      ? cardsByKey[lastKey]!.elixir + 1
      : (baseCostByKey[c.key] ?? c.elixir)

  if (loading) return <div className="app">Loading...</div>
  if (!opponentState) return <div className="app">Loading state...</div>

  const gc = getGameConstants((opponentState.game_mode as GameMode) ?? gameMode)
  const gameStartedAt = opponentState.game_started_at ?? opponentState.started_at
  const remaining = opponentState.started
    ? Math.max(0, gc.GAME_DURATION - (nowSec - gameStartedAt))
    : 0
  const rate = remaining < gc.DOUBLE_ELIXIR_THRESHOLD ? gc.RATE_DOUBLE : gc.RATE_NORMAL
  const { elixir, leaked } = opponentState.started
    ? advanceElixir(
        opponentState.elixir,
        opponentState.elixir_last_updated,
        opponentState.leaked,
        nowSec,
        rate,
        gc.ELIXIR_CAP
      )
    : { elixir: 5, leaked: 0 }
  const timerDisplay = opponentState.started
    ? `${Math.floor(remaining / 60)}:${String(Math.floor(remaining % 60)).padStart(2, '0')}`
    : ''
  const canSync =
    opponentState.started &&
    !(opponentState.sync_used ?? false) &&
    remaining >= gc.SYNC_MIN_REMAINING
  const deck = opponentState.deck
  const deckFull = deck.length >= 8

  const canRecordPlay = (c: Card) => {
    if (!opponentState.started) return false
    const cost = getCost(c)
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
                  const cost = getCost(c)
                  return (
                    <button
                      key={c.key}
                      className="card-item"
                      disabled={pending || !canRecordPlay(c)}
                      onClick={() => handlePlay(c.key)}
                      title={
                        elixir < cost
                          ? `Not enough elixir (need ${cost})`
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
            <div className="card-search-wrap">
              <input
                type="text"
                className="card-search"
                placeholder="Search cards..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((cost) => {
              const group = cardsByElixir[cost]
              if (!group?.length) return null
              return (
                <div key={cost} className="card-group">
                  <h3 className="card-group-header">{cost} Elixir</h3>
                  <div className="card-grid">
                    {group.map((c) => {
                      const cost = getCost(c)
                      return (
                      <button
                        key={c.key}
                        className="card-item"
                        disabled={pending || !canRecordPlay(c)}
                        onClick={() => handlePlay(c.key)}
                        title={
                          elixir < cost
                            ? `Not enough elixir (need ${cost})`
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
                    )})}
                  </div>
                </div>
              )
            })}
          </>
        )}
        </section>

        <aside
          className={`opponent-tracker ${opponentState.started && remaining < gc.DOUBLE_ELIXIR_THRESHOLD ? 'double-elixir' : ''}`}
        >
        {!opponentState.started ? (
          <div className="start-section">
            <div className="start-mascot" aria-hidden>
              <img src="/claude_royale.jpg" alt="" />
            </div>
            <div className="mode-selector">
              <span className="mode-label">Mode</span>
              <div className="mode-buttons" role="group" aria-label="Game mode">
                {GAME_MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`mode-btn ${gameMode === m ? 'mode-btn-active' : ''}`}
                    onClick={() => setGameMode(m)}
                  >
                    {m === 'normal' ? 'Normal' : 'Double Elixir'}
                  </button>
                ))}
              </div>
            </div>
            <button
              className="btn btn-primary"
              disabled={pending}
              onClick={handleStart}
            >
              Start game
            </button>
          </div>
        ) : (
          <>
            <div className="opponent-top-row">
              <div className="opponent-buttons">
                <button
                  className="btn btn-reset"
                  disabled={pending}
                  onClick={handleReset}
                >
                  Reset
                </button>
                <button
                  className="btn btn-sync"
                  disabled={pending || !canSync}
                  onClick={handleSync}
                  title={canSync ? 'Sync to elixir 10, time 2:50 (load-in correction)' : 'Sync not available'}
                >
                  Sync
                </button>
              </div>
              <div className="timer-display">
                <span className="timer-label">Time</span>
                <span className="timer-value">{timerDisplay}</span>
              </div>
            </div>
            <div className="elixir-section">
              <div className="elixir-row">
                <div className="elixir-bar">
                  <div
                    className={`elixir-fill ${remaining < gc.DOUBLE_ELIXIR_THRESHOLD ? 'double-elixir-fill' : ''}`}
                    style={{ width: `${(elixir / gc.ELIXIR_CAP) * 100}%` }}
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
              <div className="queue-separator" aria-hidden />
              <div className="queue-next">
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
