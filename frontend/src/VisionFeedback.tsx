import { useState } from 'react'
import type { VisionMonitorState } from './useVisionMonitor'
import './VisionFeedback.css'

interface VisionFeedbackProps {
  state: VisionMonitorState
  onStart: () => void
  onStop: () => void
  handCardsWithNames: { key: string; name: string }[]
  cardsToClassify: { key: string; name: string }[]
  deckFull: boolean
  gameStarted: boolean
}

export function VisionFeedback({
  state,
  onStart,
  onStop,
  handCardsWithNames,
  cardsToClassify,
  deckFull,
  gameStarted,
}: VisionFeedbackProps) {
  const [debugOpen, setDebugOpen] = useState(false)
  const { debug } = state

  return (
    <div className="vision-feedback">
      <div className="vision-controls">
        <button
          type="button"
          className={`btn btn-vision ${state.isActive ? 'active' : ''}`}
          onClick={state.isActive ? onStop : onStart}
          title={
            state.isActive
              ? 'Stop vision monitoring'
              : 'Start vision monitoring (share screen, select game window)'
          }
          aria-label={state.isActive ? 'Stop vision monitoring' : 'Start vision monitoring'}
        >
          <span className="vision-icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </span>
          {state.isActive ? 'Stop vision' : 'Start vision'}
        </button>
      </div>

      {state.error && (
        <p className="vision-error" role="alert">
          {state.error}
        </p>
      )}

      {state.isActive && !gameStarted && (
        <p className="vision-hint">
          Vision ready. Start game to begin recording plays.
        </p>
      )}

      {state.isActive && gameStarted && deckFull && handCardsWithNames.length > 0 && (
        <p className="vision-hint">
          Classifying among hand: {handCardsWithNames.map((c) => c.name).join(', ')}
        </p>
      )}

      {state.isActive && gameStarted && (!deckFull || handCardsWithNames.length === 0) && (
        <p className="vision-hint">
          Classifying among all {cardsToClassify.length} cards until deck is known.
        </p>
      )}

      {state.lastClassified && (
        <p className="vision-last">
          Last: {state.lastClassified.cardKey} ({state.lastClassified.confidence.toFixed(2)})
        </p>
      )}

      {state.isActive && (
        <div className="vision-debug">
          <button
            type="button"
            className="vision-debug-toggle"
            onClick={() => setDebugOpen((o) => !o)}
            aria-expanded={debugOpen}
          >
            {debugOpen ? 'Hide' : 'Show'} debug
          </button>
          {debugOpen && (
            <div className="vision-debug-panel">
              {debug.lastChange && (
                <div className="vision-debug-section">
                  <h4>Change detected</h4>
                  <p>
                    Cell ({debug.lastChange.row}, {debug.lastChange.col}) — diff: {(debug.lastChange.diff * 100).toFixed(2)}%
                  </p>
                  {debug.lastDiffCellImage && (
                    <div className="vision-debug-image-wrap">
                      <span>Diff cell (32×32):</span>
                      <img src={debug.lastDiffCellImage} alt="Cell that triggered" className="vision-debug-img vision-debug-img-diff" />
                    </div>
                  )}
                </div>
              )}
              {debug.cellDiffs.length > 0 && (
                <div className="vision-debug-section">
                  <h4>Cell diffs (heatmap)</h4>
                  <div
                    className="vision-debug-grid"
                    style={{
                      gridTemplateColumns: `repeat(${(Math.max(0, ...debug.cellDiffs.map((c) => c.col)) + 1) || 3}, 1.5rem)`,
                    }}
                  >
                    {debug.cellDiffs.map(({ row, col, diff }) => (
                      <div
                        key={`${row}-${col}`}
                        className="vision-debug-cell"
                        title={`(${row},${col}) ${(diff * 100).toFixed(1)}%`}
                        style={{
                          opacity: 0.3 + Math.min(diff * 5, 0.7),
                          backgroundColor: diff > 0.02 ? '#22c55e' : '#64748b',
                        }}
                      >
                        {(diff * 100).toFixed(0)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(debug.lastClassificationImage || debug.lastClassification) && (
                <div className="vision-debug-section">
                  <h4>Classification</h4>
                  {debug.lastClassificationImage && (
                    <div className="vision-debug-image-wrap">
                      <span>Sent to CLIP (224×224):</span>
                      <img src={debug.lastClassificationImage} alt="Crop sent to classifier" className="vision-debug-img vision-debug-img-classify" />
                    </div>
                  )}
                  {debug.lastClassification && (
                    <>
                      <p>
                        Top: {debug.lastClassification.cardKey} ({(debug.lastClassification.confidence * 100).toFixed(1)}%)
                        {debug.lastClassification.recorded ? (
                          <span className="vision-debug-recorded"> — recorded</span>
                        ) : (
                          <span className="vision-debug-skipped">
                            {' '}
                            — skipped (below {debug.lastClassification.threshold * 100}%)
                          </span>
                        )}
                      </p>
                      <ul className="vision-debug-top">
                        {debug.lastClassification.topPredictions.slice(0, 5).map((p, i) => (
                          <li key={i}>
                            {p.cardKey}: {(p.confidence * 100).toFixed(1)}%
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
