/**
 * Screen capture for vision monitoring.
 * Uses getDisplayMedia to capture screen/window; all processing in memory, no disk writes.
 */

/**
 * Region to crop from the captured video. All values are fractions 0–1 of the video size.
 *
 * Think of it as a rectangle drawn on the screen:
 *   x      = left edge   (0 = far left, 0.5 = center)
 *   y      = top edge    (0 = top, 0.1 = 10% down)
 *   width  = how wide    (0.5 = half the screen width)
 *   height = how tall    (0.4 = 40% of screen height)
 *
 * Example: x: 0.17, width: 0.66 → starts 17% from left, spans 66% of width
 */
export interface CaptureRegion {
  /** Left edge: 0 = leftmost, 1 = rightmost */
  x: number
  /** Top edge: 0 = top, 1 = bottom */
  y: number
  /** Width of the rectangle (0–1) */
  width: number
  /** Height of the rectangle (0–1) */
  height: number
}

/**
 * Default: opponent's half (green field, 3 towers, down to the river).
 * Tuned for Clash Royale mobile/emulator: arena below banner, above river.
 * Adjust if your capture differs (e.g. different device or window size).
 */
export const DEFAULT_REGION: CaptureRegion = {
  x: 0.17,
  y: 0.06,
  width: 0.66,
  height: 0.37,
}

/**
 * Request screen capture. User must select screen/window.
 * Returns MediaStream - caller must stop tracks when done.
 */
export async function requestScreenCapture(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: 'monitor' },
    audio: false,
  })
  return stream
}

/**
 * Capture a region of the video to ImageData (in-memory only).
 * @param video - Video element with stream attached
 * @param region - Region to crop (fractions 0-1)
 * @param destWidth - Optional downscale width for diff (smaller = faster)
 * @param destHeight - Optional downscale height for diff
 */
export function captureRegionToImageData(
  video: HTMLVideoElement,
  region: CaptureRegion,
  destWidth?: number,
  destHeight?: number
): ImageData | null {
  if (video.readyState < 2) return null
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (vw === 0 || vh === 0) return null

  const sx = Math.floor(region.x * vw)
  const sy = Math.floor(region.y * vh)
  const sw = Math.floor(region.width * vw)
  const sh = Math.floor(region.height * vh)

  const outW = destWidth ?? sw
  const outH = destHeight ?? sh

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, outW, outH)
  return ctx.getImageData(0, 0, outW, outH)
}

/**
 * Get grid cell bounds within a region.
 * @param region - Full capture region
 * @param gridRows - Number of rows
 * @param gridCols - Number of columns
 * @param row - Row index (0-based)
 * @param col - Column index (0-based)
 */
export function getGridCellRegion(
  region: CaptureRegion,
  gridRows: number,
  gridCols: number,
  row: number,
  col: number
): CaptureRegion {
  const cellW = region.width / gridCols
  const cellH = region.height / gridRows
  return {
    x: region.x + col * cellW,
    y: region.y + row * cellH,
    width: cellW,
    height: cellH,
  }
}
