// プレイ画面の盤面の大きさ。画面に収まる最大のセルの高さを8px刻みで選ぶ
import { fieldBox } from '@/lib/board/geometry'
import { isWide, viewHeight } from '@/utils/viewport'

export const CELL_GAP = 4
const CELL_STEP = 8
const CELL_MIN = 16
const CELL_MAX = 64
const BAR_HEIGHT = 56
const SCORE_PANEL_HEIGHT = 96
const TRAY_HEIGHT = 120

function fieldAreaSize() {
  if (isWide()) return { width: innerWidth - 8, height: viewHeight() - BAR_HEIGHT }
  return {
    width: Math.min(innerWidth, 520) - 8,
    height: viewHeight() - BAR_HEIGHT - SCORE_PANEL_HEIGHT - TRAY_HEIGHT - 16,
  }
}

export function fitCell(radius: number): number {
  const size = fieldAreaSize()
  for (let cellHeight = CELL_MAX; cellHeight > CELL_MIN; cellHeight -= CELL_STEP)
    if (fieldBox(radius, cellHeight, CELL_GAP).height <= size.height) return cellHeight
  return CELL_MIN
}
