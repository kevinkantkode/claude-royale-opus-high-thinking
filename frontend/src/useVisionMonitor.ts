/**
 * Vision monitoring hook: in-memory regional change detection + N-way classification.
 * Classifies among hand when known (4-way), or all cards when deck not yet discovered.
 * No screenshots saved; only captures to memory for diff and classify.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Card, OpponentState } from './types'
import {
  requestScreenCapture,
  captureRegionToImageData,
  getGridCellRegion,
  createRegionBuffer,
  captureGridCells,
  findChangedCell,
  updateRegionBuffer,
  getAllCellDiffs,
  classifyAmongCards,
  imageDataToDataUrl,
  DEFAULT_REGION,
  DEFAULT_DIFF_CONFIG,
} from './vision'
import type { CaptureRegion, DiffConfig } from './vision'

/** Classification crop size for CLIP (model expects ~224) */
const CLASSIFY_SIZE = 224

export interface VisionMonitorConfig {
  region?: CaptureRegion
  diff?: Partial<DiffConfig>
  /** Sample interval in ms */
  intervalMs?: number
  /** Debounce after trigger in ms */
  debounceMs?: number
  /** Min confidence to auto-record; below this, skip or could prompt */
  minConfidence?: number
}

const DEFAULT_CONFIG: Required<VisionMonitorConfig> = {
  region: DEFAULT_REGION,
  diff: DEFAULT_DIFF_CONFIG,
  intervalMs: 250,
  debounceMs: 500,
  minConfidence: 0.3,
}

export interface VisionDebugInfo {
  /** Cell that triggered (row, col, diff above threshold) */
  lastChange: { row: number; col: number; diff: number } | null
  /** Diff value for every cell at last trigger (for grid heatmap) */
  cellDiffs: { row: number; col: number; diff: number }[]
  /** Data URL of the 32×32 diff cell that triggered (for debug) */
  lastDiffCellImage: string | null
  /** Data URL of the 224×224 crop sent to CLIP (for debug) */
  lastClassificationImage: string | null
  /** Classification result with top predictions */
  lastClassification: {
    cardKey: string
    confidence: number
    topPredictions: { cardKey: string; confidence: number }[]
    recorded: boolean
    threshold: number
  } | null
}

export interface VisionMonitorState {
  isActive: boolean
  isCapturing: boolean
  error: string | null
  lastClassified: { cardKey: string; confidence: number } | null
  debug: VisionDebugInfo
}

export interface UseVisionMonitorOptions {
  opponentState: OpponentState | null
  cardsByKey: Record<string, Card>
  allCards: Card[]
  gameStarted: boolean
  onRecordPlay: (cardKey: string) => Promise<{ success: boolean; error?: string }>
  config?: VisionMonitorConfig
}

export function useVisionMonitor({
  opponentState,
  cardsByKey,
  allCards,
  gameStarted,
  onRecordPlay,
  config: userConfig = {},
}: UseVisionMonitorOptions) {
  const config = { ...DEFAULT_CONFIG, ...userConfig }
  const diffConfig = { ...DEFAULT_DIFF_CONFIG, ...config.diff }

  const [state, setState] = useState<VisionMonitorState>({
    isActive: false,
    isCapturing: false,
    error: null,
    lastClassified: null,
    debug: {
      lastChange: null,
      cellDiffs: [],
      lastDiffCellImage: null,
      lastClassificationImage: null,
      lastClassification: null,
    },
  })

  const streamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const bufferRef = useRef<ReturnType<typeof createRegionBuffer> | null>(null)
  const debounceUntilRef = useRef<number>(0)
  const rafRef = useRef<number>(0)
  const mountedRef = useRef(true)
  const visionStartedAtRef = useRef<number>(0)

  const handCards = opponentState?.queue?.slice(0, 4).filter((k) => k && k !== '?') ?? []
  const handCardsWithNames = handCards
    .map((k) => {
      const c = cardsByKey[k]
      return c ? { key: k, name: c.name } : null
    })
    .filter((c): c is { key: string; name: string } => c != null)

  const allCardsWithNames = allCards.map((c) => ({ key: c.key, name: c.name }))
  const deckFull = (opponentState?.deck?.length ?? 0) >= 8
  const cardsToClassify = deckFull && handCardsWithNames.length > 0 ? handCardsWithNames : allCardsWithNames

  const stopMonitoring = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    bufferRef.current = null
    setState((s) => ({ ...s, isActive: false, isCapturing: false }))
  }, [])

  const startMonitoring = useCallback(async () => {
    if (state.isActive) return
    setState((s) => ({ ...s, error: null }))
    try {
      const stream = await requestScreenCapture()
      streamRef.current = stream

      const video = document.createElement('video')
      video.srcObject = stream
      video.autoplay = true
      video.muted = true
      video.playsInline = true
      await video.play()
      videoRef.current = video

      bufferRef.current = createRegionBuffer(diffConfig.gridRows, diffConfig.gridCols)
      visionStartedAtRef.current = Date.now()
      setState((s) => ({ ...s, isActive: true, isCapturing: true }))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to start capture'
      setState((s) => ({ ...s, error: msg }))
    }
  }, [state.isActive, diffConfig.gridRows, diffConfig.gridCols])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      stopMonitoring()
    }
  }, [stopMonitoring])

  useEffect(() => {
    if (!state.isActive || !videoRef.current || !bufferRef.current) return

    const video = videoRef.current
    const buffer = bufferRef.current
    const region = config.region
    const { gridRows, gridCols, threshold } = diffConfig

    let lastTime = 0
    const interval = config.intervalMs

    const tick = (now: number) => {
      if (!mountedRef.current) return
      rafRef.current = requestAnimationFrame(tick)

      if (now - lastTime < interval) return
      lastTime = now

      if (Date.now() < debounceUntilRef.current) return

      const cells = captureGridCells(video, region, gridRows, gridCols)
      const warmupMs = 1500
      if (Date.now() - visionStartedAtRef.current < warmupMs) {
        updateRegionBuffer(buffer, cells)
        return
      }
      const changed = findChangedCell(buffer, cells, threshold)

      if (changed) {
        debounceUntilRef.current = Date.now() + config.debounceMs

        const cellDiffs = getAllCellDiffs(buffer, cells)
        const diffCellIndex = changed.row * gridCols + changed.col
        const diffCell = cells[diffCellIndex]
        const lastDiffCellImage = diffCell ? imageDataToDataUrl(diffCell) : null

        setState((s) => ({
          ...s,
          debug: {
            ...s.debug,
            lastChange: { row: changed.row, col: changed.col, diff: changed.diff },
            cellDiffs,
            lastDiffCellImage,
            lastClassificationImage: null,
            lastClassification: null,
          },
        }))

        const cellRegion = getGridCellRegion(region, gridRows, gridCols, changed.row, changed.col)
        const crop = captureRegionToImageData(video, cellRegion, CLASSIFY_SIZE, CLASSIFY_SIZE)
        if (!crop) {
          updateRegionBuffer(buffer, cells)
          return
        }

        const minConf = config.minConfidence ?? 0.3
        const classificationImage = imageDataToDataUrl(crop)
        classifyAmongCards(crop, cardsToClassify, cardsByKey)
          .then(async (result) => {
            if (!mountedRef.current || !result) return
            const recorded = gameStarted && result.confidence >= minConf
            setState((s) => ({
              ...s,
              lastClassified: { cardKey: result.cardKey, confidence: result.confidence },
              debug: {
                ...s.debug,
                lastClassificationImage: classificationImage,
                lastClassification: {
                  cardKey: result.cardKey,
                  confidence: result.confidence,
                  topPredictions: result.topPredictions,
                  recorded,
                  threshold: minConf,
                },
              },
            }))

            if (recorded) {
              const res = await onRecordPlay(result.cardKey)
              if (!res.success) {
                setState((s) => ({ ...s, error: res.error ?? 'Record failed' }))
              }
            }
          })
          .catch((e) => {
            if (mountedRef.current) {
              setState((s) => ({ ...s, error: e instanceof Error ? e.message : 'Classification failed' }))
            }
          })
      }

      updateRegionBuffer(buffer, cells)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [
    state.isActive,
    gameStarted,
    config.region,
    config.debounceMs,
    config.minConfidence,
    config.intervalMs,
    diffConfig,
    cardsToClassify,
    cardsByKey,
    onRecordPlay,
  ])

  return {
    state,
    startMonitoring,
    stopMonitoring,
    handCardsWithNames,
    cardsToClassify,
    deckFull,
  }
}
