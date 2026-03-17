/**
 * N-way classifier for hand cards.
 * Uses backend CLIP (runs locally in Python); no browser fetch to Hugging Face.
 */

import { visionClassify } from '../api'
import type { Card } from '../types'

/** Convert ImageData to base64 data URL. Exported for debug display. */
export function imageDataToDataUrl(img: ImageData): string {
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL('image/png')
}

export interface ClassifyResult {
  cardKey: string
  confidence: number
  topPredictions: { cardKey: string; confidence: number }[]
}

/**
 * Classify a crop among the given cards (hand when known, or all cards).
 * Sends image to backend; model runs locally in Python.
 */
export async function classifyAmongCards(
  crop: ImageData,
  cards: { key: string; name: string }[],
  _cardsByKey: Record<string, Card>
): Promise<ClassifyResult | null> {
  if (cards.length === 0) return null

  if (cards.length === 1) {
    return { cardKey: cards[0].key, confidence: 1, topPredictions: [{ cardKey: cards[0].key, confidence: 1 }] }
  }

  const dataUrl = imageDataToDataUrl(crop)
  if (!dataUrl) return null

  const labels = cards.map((c) => c.name)
  const { results } = await visionClassify(dataUrl, labels)

  const topK = Math.min(5, results.length)
  const topPredictions: { cardKey: string; confidence: number }[] = []
  for (let i = 0; i < topK; i++) {
    const item = results[i]
    if (!item) break
    const match = cards.find((c) => c.name === item.label)
    if (match) topPredictions.push({ cardKey: match.key, confidence: item.score })
  }
  const top = topPredictions[0]
  if (!top) return null

  return { cardKey: top.cardKey, confidence: top.confidence, topPredictions }
}
