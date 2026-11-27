// コレクションの行の配置
import { isWide } from '@/utils/viewport'
import { ROOT3 } from '@/game/core'
import { LIST_WIDTH } from '@/lib/missionLayout'

export const CHIP_HEIGHT = 64
export const CHIP_GAP = 8
export const COLUMN_Q = 6
const TEXT_WIDTH = 152

export const PITCH = CHIP_HEIGHT + CHIP_GAP
export const SCALE = PITCH / ROOT3
export const TILE_RATIO = CHIP_HEIGHT / PITCH
export const HEX_RADIUS = TILE_RATIO * SCALE
export const COLUMN_WIDTH = COLUMN_Q * 1.5 * SCALE

// PCレイアウトでは、文字の幅を残して入るだけ列を並べる
export function collectionColumnCount(): number {
  if (!isWide()) return 1
  const rowWidth = 1.5 * SCALE + 2 * HEX_RADIUS + 16 + TEXT_WIDTH
  return Math.max(1, Math.floor((innerWidth - LIST_WIDTH - 24 - 48 - rowWidth) / COLUMN_WIDTH) + 1)
}
