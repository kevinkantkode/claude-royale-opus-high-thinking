/**
 * Regional change detection.
 * Compares current frame regions to previous; no disk I/O.
 */

import type { CaptureRegion } from './screenCapture'
import { captureRegionToImageData, getGridCellRegion } from './screenCapture'

/** Downsampled size per cell for fast diff (smaller = faster, less sensitive) */
const DIFF_CELL_SIZE = 32

export interface DiffConfig {
  /** Rows in grid */
  gridRows: number
  /** Columns in grid */
  gridCols: number
  /** Change threshold 0-1; above this = significant change */
  threshold: number
}

/** Arena is wider than tall. 6 cols × 3 rows = 18 cells for the opponent's half. */
export const DEFAULT_DIFF_CONFIG: DiffConfig = {
  gridRows: 3,
  gridCols: 6,
  threshold: 0.08,
}

/**
 * Compute normalized diff between two ImageData buffers (same dimensions).
 * Returns fraction of pixels that changed significantly (0-1).
 */
function imageDataDiff(a: ImageData, b: ImageData): number {
  if (a.width !== b.width || a.height !== b.height) return 1
  const len = a.data.length
  let changed = 0
  const pixelThreshold = 25 // per-channel difference to count as changed
  for (let i = 0; i < len; i += 4) {
    const dr = Math.abs(a.data[i]! - b.data[i]!)
    const dg = Math.abs(a.data[i + 1]! - b.data[i + 1]!)
    const db = Math.abs(a.data[i + 2]! - b.data[i + 2]!)
    if (dr > pixelThreshold || dg > pixelThreshold || db > pixelThreshold) {
      changed++
    }
  }
  return changed / (len / 4)
}

export interface RegionBuffer {
  cells: (ImageData | null)[]
  gridRows: number
  gridCols: number
}

/**
 * Create an empty region buffer for storing previous frame cells.
 */
export function createRegionBuffer(gridRows: number, gridCols: number): RegionBuffer {
  return {
    cells: new Array(gridRows * gridCols).fill(null),
    gridRows,
    gridCols,
  }
}

/**
 * Capture all grid cells for a region. Returns array of ImageData (one per cell).
 */
export function captureGridCells(
  video: HTMLVideoElement,
  region: CaptureRegion,
  gridRows: number,
  gridCols: number
): (ImageData | null)[] {
  const cells: (ImageData | null)[] = []
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const cellRegion = getGridCellRegion(region, gridRows, gridCols, r, c)
      const img = captureRegionToImageData(video, cellRegion, DIFF_CELL_SIZE, DIFF_CELL_SIZE)
      cells.push(img)
    }
  }
  return cells
}

/**
 * Find first cell whose change exceeds threshold.
 * Returns { row, col, diff } or null if no cell exceeded threshold.
 */
export function findChangedCell(
  prev: RegionBuffer,
  current: (ImageData | null)[],
  threshold: number
): { row: number; col: number; diff: number } | null {
  for (let i = 0; i < current.length; i++) {
    const curr = current[i]
    const p = prev.cells[i]
    if (!curr || !p) continue
    const diff = imageDataDiff(p, curr)
    if (diff > threshold) {
      const row = Math.floor(i / prev.gridCols)
      const col = i % prev.gridCols
      return { row, col, diff }
    }
  }
  return null
}

/**
 * Get diff value for every cell. Used for debug visibility.
 */
export function getAllCellDiffs(
  prev: RegionBuffer,
  current: (ImageData | null)[]
): { row: number; col: number; diff: number }[] {
  const result: { row: number; col: number; diff: number }[] = []
  for (let i = 0; i < current.length; i++) {
    const curr = current[i]
    const p = prev.cells[i]
    if (!curr || !p) continue
    const diff = imageDataDiff(p, curr)
    const row = Math.floor(i / prev.gridCols)
    const col = i % prev.gridCols
    result.push({ row, col, diff })
  }
  return result
}

/**
 * Update a region buffer with new cell data (for next iteration).
 */
export function updateRegionBuffer(
  buffer: RegionBuffer,
  cells: (ImageData | null)[]
): void {
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]
    if (c) {
      buffer.cells[i] = new ImageData(
        new Uint8ClampedArray(c.data),
        c.width,
        c.height
      )
    }
  }
}
