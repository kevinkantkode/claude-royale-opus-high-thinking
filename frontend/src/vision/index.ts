export { requestScreenCapture, captureRegionToImageData, getGridCellRegion } from './screenCapture'
export type { CaptureRegion } from './screenCapture'
export { DEFAULT_REGION } from './screenCapture'

export {
  createRegionBuffer,
  captureGridCells,
  findChangedCell,
  updateRegionBuffer,
  getAllCellDiffs,
  DEFAULT_DIFF_CONFIG,
} from './regionDiff'
export type { DiffConfig, RegionBuffer } from './regionDiff'

export { classifyAmongCards, imageDataToDataUrl } from './classifier'
export type { ClassifyResult } from './classifier'
