import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchCards,
  fetchVoiceAliases,
  getOpponentState,
  recordAbility,
  recordPlay,
  recordPlays,
  resetGame,
  startGame,
  syncGame,
} from './api'
import type { Card, OpponentState } from './types'
import { ELIXIR_CAP, getGameConstants, type GameMode, GAME_MODES } from './gameConstants'
import { CardDisplay } from './CardDisplay'
import { UNKNOWN_CARD_IMAGE_URL } from './cardImages'
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

/** Hook: elixir tick when game started. Only this subtree re-renders on tick. */
function useElixirTick(opponentState: OpponentState | null) {
  const [nowSec, setNowSec] = useState(() => Date.now() / 1000)
  useEffect(() => {
    if (!opponentState?.started) return
    const id = setInterval(() => setNowSec(Date.now() / 1000), 100)
    return () => clearInterval(id)
  }, [opponentState?.started])
  return nowSec
}

interface GameMainProps {
  opponentState: OpponentState
  cards: Card[]
  search: string
  setSearch: (s: string) => void
  pending: boolean
  voiceMuted: boolean
  handleCardClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  handleStart: () => void
  handleReset: () => void
  handleSync: () => void
  handleAbility: (index: number) => void
  voiceInput: ReturnType<typeof useVoiceInput>
  voiceMuteToggle: () => void
  speechSupported: boolean
  gameMode: GameMode
  setGameMode: (m: GameMode) => void
}

function GameMain({
  opponentState,
  cards,
  search,
  setSearch,
  pending,
  voiceMuted,
  handleCardClick,
  handleStart,
  handleReset,
  handleSync,
  handleAbility,
  voiceInput,
  voiceMuteToggle,
  speechSupported,
  gameMode,
  setGameMode,
}: GameMainProps) {
  const nowSec = useElixirTick(opponentState)
  const deckFull = opponentState.deck.length >= 8

  const cardsByKey = useMemo(
    () => Object.fromEntries(cards.map((c) => [c.key, c])),
    [cards]
  )
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
  const { hand, lastKey } = useMemo(() => {
    const q = opponentState.queue ?? []
    return {
      hand: q.slice(0, 4).filter((k) => k && k !== '?'),
      lastKey: (q[7] && q[7] !== '?') ? q[7] : null,
    }
  }, [opponentState.queue])
  const baseCostByKey = useMemo(
    () => Object.fromEntries(Object.entries(cardsByKey).map(([k, c]) => [k, c.elixir])),
    [cardsByKey]
  )
  const getCost = (c: Card) =>
    c.key === 'mirror' && lastKey && cardsByKey[lastKey]
      ? cardsByKey[lastKey]!.elixir + 1
      : (baseCostByKey[c.key] ?? c.elixir)

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

  const canRecordPlay = (c: Card) => {
    if (!opponentState.started) return false
    const cost = getCost(c)
    if (elixir < cost) return false
    if (lastKey === c.key && c.key !== 'mirror') return false
    const deck = opponentState.deck
    if (deck.includes(c.key)) {
      if (!deckFull) return true
      return hand.includes(c.key)
    }
    if (deckFull) return false
    return true
  }

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value), [setSearch])

  return (
    <>
      {!deckFull && (
        <section className="cards-preview">
          <h2>Cards — Record play</h2>
          <div className="card-search-wrap">
            <input
              type="text"
              className="card-search"
              placeholder="Search cards..."
              value={search}
              onChange={handleSearchChange}
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
                    const costVal = getCost(c)
                    return (
                      <button
                        key={c.key}
                        className="card-item"
                        data-card-key={c.key}
                        disabled={pending || !canRecordPlay(c)}
                        onClick={handleCardClick}
                        title={
                          elixir < costVal
                            ? `Not enough elixir (need ${costVal})`
                            : lastKey === c.key && c.key !== 'mirror'
                            ? 'Cannot play same card twice; use Mirror'
                            : opponentState.deck.includes(c.key)
                            ? 'Record play'
                            : deckFull
                            ? 'Not in opponent deck'
                            : 'Record play'
                        }
                      >
                        <CardDisplay card={c} variant="base" />
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </section>
      )}

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
                <span className="queue-label">In hand (click or press 1–4)</span>
                <div className="queue-slots">
                  {opponentState.queue.slice(0, 4).map((q, i) => {
                    const card = q && q !== '?' ? cardsByKey[q] : null
                    const canPlay = card && canRecordPlay(card)
                    const slotNum = i + 1
                    return q === '?' || !card ? (
                      <div key={i} className="queue-slot">
                        <span className="queue-slot-num">{slotNum}</span>
                        <img
                          src={UNKNOWN_CARD_IMAGE_URL}
                          alt="Unknown card"
                          className="card-image"
                          title="Unknown card"
                        />
                      </div>
                    ) : (
                      <button
                        key={i}
                        type="button"
                        className="queue-slot"
                        data-card-key={q}
                        disabled={pending || !canPlay}
                        onClick={handleCardClick}
                        title={
                          elixir < getCost(card)
                            ? `Not enough elixir (need ${getCost(card)})`
                            : lastKey === card.key && card.key !== 'mirror'
                            ? 'Cannot play same card twice; use Mirror'
                            : `Record play (${slotNum})`
                        }
                      >
                        <span className="queue-slot-num">{slotNum}</span>
                        <CardDisplay card={card} variant="base" />
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="queue-separator" aria-hidden />
              <div className="queue-next">
                <div className="queue-slots">
                  {opponentState.queue.slice(4, 8).map((q, i) => (
                    <div key={i + 4} className="queue-slot">
                      {q === '?' ? (
                        <img
                          src={UNKNOWN_CARD_IMAGE_URL}
                          alt="Unknown card"
                          className="card-image"
                          title="Unknown card"
                        />
                      ) : cardsByKey[q] ? (
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
              onMuteToggle={voiceMuteToggle}
              logEntries={voiceInput.logEntries}
              onClearLog={voiceInput.clearLog}
              speechSupported={speechSupported}
            />
          </>
        )}
      </aside>
    </>
  )
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
  const pendingRef = useRef(pending)
  pendingRef.current = pending

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
    if (pendingRef.current) return
    setError(null)
    setPending(true)
    startGame(gameMode)
      .then(setOpponentState)
      .catch((e) => setError(e.message))
      .finally(() => setPending(false))
  }, [gameMode])

  const handleReset = useCallback(() => {
    if (pendingRef.current) return
    setError(null)
    setPending(true)
    resetGame()
      .then(setOpponentState)
      .catch((e) => setError(e.message))
      .finally(() => setPending(false))
  }, [])

  const handleSync = useCallback(() => {
    if (pendingRef.current) return
    setError(null)
    setPending(true)
    syncGame()
      .then(setOpponentState)
      .catch((e) => setError(e.message))
      .finally(() => setPending(false))
  }, [])

  const handlePlay = useCallback((cardKey: string) => {
    if (pendingRef.current) return Promise.resolve({ success: false, error: 'Request in progress' })
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
  }, [])

  const handlePlayMultiple = useCallback((cardKeys: string[]) => {
    if (pendingRef.current) return Promise.resolve({ success: false, error: 'Request in progress' })
    if (cardKeys.length === 0) return Promise.resolve({ success: true })
    setError(null)
    setPending(true)
    return recordPlays(cardKeys)
      .then((s) => {
        setOpponentState(s)
        return { success: true }
      })
      .catch((e) => {
        setError(e.message)
        return { success: false, error: e.message }
      })
      .finally(() => setPending(false))
  }, [])

  const handleCardClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const key = e.currentTarget.dataset.cardKey
    if (key) handlePlayRef.current(key)
  }, [])

  const handleAbility = useCallback((index: number) => {
    if (pendingRef.current) return Promise.resolve({ success: false, error: 'Request in progress' })
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
  }, [])

  // Keyboard 1–4: play card at hand slot 0–3. Refs avoid effect re-runs on every play.
  const handlePlayRef = useRef(handlePlay)
  const queueRef = useRef<string[]>([])
  const gameStartedRef = useRef(false)
  handlePlayRef.current = handlePlay
  queueRef.current = opponentState?.queue ?? []
  gameStartedRef.current = opponentState?.started ?? false
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '1' && e.key !== '2' && e.key !== '3' && e.key !== '4') return
      const el = document.activeElement
      if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || (el as HTMLElement)?.isContentEditable)
        return
      if (!gameStartedRef.current) return
      const idx = Number(e.key) - 1
      const cardKey = queueRef.current[idx]
      if (!cardKey || cardKey === '?') return
      e.preventDefault()
      handlePlayRef.current(cardKey)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const cardsByKey = useMemo(
    () => Object.fromEntries(cards.map((c) => [c.key, c])),
    [cards]
  )

  const speechSupported = useMemo(
    () =>
      typeof window !== 'undefined' &&
      !!(window.SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition),
    []
  )

  const voiceMuteToggle = useCallback(() => setVoiceMuted((m) => !m), [])
  const dismissError = useCallback(() => setError(null), [])

  const voiceCallbacks = useMemo(
    () => ({ onPlayMultiple: handlePlayMultiple, onAbility: handleAbility }),
    [handlePlayMultiple, handleAbility]
  )

  const voiceInput = useVoiceInput({
    aliases: voiceAliases,
    cardsByKey,
    abilityCards: opponentState?.ability_cards ?? [],
    callbacks: voiceCallbacks,
    gameStarted: opponentState?.started ?? false,
    muted: voiceMuted,
  })

  if (loading) return <div className="app">Loading...</div>
  if (!opponentState) return <div className="app">Loading state...</div>

  const deckFull = opponentState.deck.length >= 8

  return (
    <div className="app">
      {error && (
        <div className="error-toast" role="alert">
          <span className="error-toast-message">{error}</span>
          <button
            type="button"
            className="error-toast-dismiss"
            onClick={dismissError}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
      <div className={`app-main ${deckFull ? 'deck-full' : ''}`}>
        <GameMain
          opponentState={opponentState}
          cards={cards}
          search={search}
          setSearch={setSearch}
          pending={pending}
          voiceMuted={voiceMuted}
          handleCardClick={handleCardClick}
          handleStart={handleStart}
          handleReset={handleReset}
          handleSync={handleSync}
          handleAbility={handleAbility}
          voiceInput={voiceInput}
          voiceMuteToggle={voiceMuteToggle}
          speechSupported={speechSupported}
          gameMode={gameMode}
          setGameMode={setGameMode}
        />
      </div>
    </div>
  )
}

export default App
