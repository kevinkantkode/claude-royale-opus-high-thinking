import { useEffect, useRef, type ReactNode } from 'react'
import type { VoiceLogEntry } from './useVoiceInput'
import './VoiceFeedback.css'

function getVoiceUnsupportedMessage(): ReactNode {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent
  if (/Firefox/i.test(ua)) {
    return (
      <>
        <p>Voice input is disabled by default in Firefox.</p>
        <p>
          To enable: open <code>about:config</code>, set these to <code>true</code>:
        </p>
        <ul>
          <li><code>media.webspeech.recognition.enable</code> — set to <code>true</code></li>
          <li>
            <code>media.webspeech.recognition.force_enable</code> — it won&apos;t appear in search; add it
            manually: right‑click in the list → New → Boolean → name{' '}
            <code>media.webspeech.recognition.force_enable</code> → value <code>true</code>
          </li>
        </ul>
        <p>Restart Firefox, then reload this page. Grant microphone access when prompted.</p>
        <p>
          Note: Firefox uses Mozilla&apos;s speech service (not Google&apos;s). If Chrome works but Firefox
          doesn&apos;t, try a different network or VPN routing.
        </p>
      </>
    )
  }
  if (/Edg/i.test(ua)) {
    return (
      <p>
        Voice should work in Edge. Ensure you&apos;re on HTTPS (or localhost) and have allowed
        microphone access when prompted.
      </p>
    )
  }
  if (/Chrome/i.test(ua) && !/Edg|OPR|Brave/i.test(ua)) {
    return (
      <p>
        Voice should work in Chrome. Ensure you&apos;re on HTTPS (or localhost) and have allowed
        microphone access when prompted.
      </p>
    )
  }
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) {
    return (
      <p>Voice input has limited support in Safari. Use Chrome or Edge for best results.</p>
    )
  }
  return (
    <p>Voice input not supported in this browser. Use Chrome or Edge for best support.</p>
  )
}

interface VoiceFeedbackProps {
  isListening: boolean
  muted: boolean
  onMuteToggle: () => void
  logEntries: VoiceLogEntry[]
  onClearLog: () => void
  speechSupported: boolean
}

export function VoiceFeedback({
  isListening,
  muted,
  onMuteToggle,
  logEntries,
  onClearLog,
  speechSupported,
}: VoiceFeedbackProps) {
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logRef.current && logEntries.length > 0) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logEntries])

  if (!speechSupported) {
    return (
      <div className="voice-feedback voice-unsupported">
        {getVoiceUnsupportedMessage()}
      </div>
    )
  }

  return (
    <div className="voice-feedback">
      <div className="voice-controls">
        <button
          type="button"
          className={`btn btn-voice-mute ${muted ? 'muted' : ''} ${isListening && !muted ? 'listening' : ''}`}
          onClick={onMuteToggle}
          title={muted ? 'Unmute voice' : isListening ? 'Listening...' : 'Mute voice'}
          aria-label={muted ? 'Unmute voice' : 'Mute voice'}
        >
          <span className="voice-mute-icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 1a3 3 0 0 1 3 3v8a3 3 0 0 1-6 0V4a3 3 0 0 1 3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
              {muted && (
                <line className="voice-mute-line" x1="2" y1="2" x2="22" y2="22" stroke="#e74c3c" strokeWidth="2.5" />
              )}
            </svg>
          </span>
        </button>
        {logEntries.length > 0 && (
          <button type="button" className="btn btn-voice-clear" onClick={onClearLog}>
            Clear
          </button>
        )}
      </div>

      <div className="voice-log-container">
        <h3 className="voice-log-title">Voice log</h3>
        <div className="voice-log" role="log" ref={logRef}>
          {logEntries.length === 0 ? (
            <p className="voice-log-empty">Say &quot;play knight&quot; or &quot;ability knight&quot;</p>
          ) : (
            logEntries.map((entry) => (
              <div key={entry.id} className="voice-log-entry">
                <div className="voice-log-heard">Heard: &quot;{entry.heard}&quot;</div>
                <ul className="voice-log-items">
                  {entry.items.map((item, i) => (
                    <li
                      key={i}
                      className={item.success ? 'voice-log-success' : 'voice-log-error'}
                    >
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
