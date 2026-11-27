// ミッション一覧のサムネイル配置。ミッションを開くときもこの位置から寄る
import { buildField, ROOT3 } from '@/game/core'
import { MISSION_LIST } from '@/game/missionList'
import { boxOf, worldPosition } from '@/lib/board/geometry'
import { isWide } from '@/utils/viewport'

const THUMBNAIL_HEIGHT = 8
const THUMBNAIL_GAP = 2
const THUMBNAIL_OFFSET = 16
export const THUMBNAIL_LABEL = 56
const THUMBNAIL_ROW_GAP = 24
export const THUMBNAIL_TILE_RATIO = THUMBNAIL_HEIGHT / (THUMBNAIL_HEIGHT + THUMBNAIL_GAP)
export const LIST_WIDTH = 240
const LIST_RIGHT = 24

export const fullCellList = (radius: number): [number, number][] =>
  buildField(radius).cellList.map(cell => [cell.q, cell.r])

function thumbnailSpan() {
  const box = boxOf(fullCellList(MISSION_LIST[0].radius))
  return box.maxX - box.minX
}

export function thumbnailUnit() {
  const width = thumbnailSpan() + 2 * THUMBNAIL_TILE_RATIO
  return { width, gap: worldPosition(THUMBNAIL_OFFSET, -THUMBNAIL_OFFSET / 2)[0] - width }
}

export function thumbnailScale(columnCount: number): number {
  const unit = thumbnailUnit()
  return (
    (isWide() ? innerWidth - LIST_WIDTH - LIST_RIGHT : Math.min(innerWidth, 480)) /
    (columnCount * unit.width + (columnCount + 1) * unit.gap)
  )
}

export function missionColumnCount(): number {
  let columnCount = 1
  while (THUMBNAIL_TILE_RATIO * thumbnailScale(columnCount + 1) * ROOT3 >= THUMBNAIL_HEIGHT)
    columnCount++
  return columnCount
}

// i番目のミッションの盤面を置く位置（セル単位）
export function missionOffset(i: number, columnCount: number): [number, number] {
  const scale = thumbnailScale(columnCount)
  const box = boxOf(fullCellList(MISSION_LIST[0].radius))
  const thumbnailHeight = (box.maxY - box.minY) * scale + THUMBNAIL_TILE_RATIO * scale * ROOT3
  const rowStep = Math.ceil(
    (thumbnailHeight + 16 + THUMBNAIL_LABEL + THUMBNAIL_ROW_GAP) / (ROOT3 * scale)
  )
  const column = i % columnCount
  const row = Math.floor(i / columnCount)
  return [THUMBNAIL_OFFSET * column, (-THUMBNAIL_OFFSET / 2) * column + rowStep * row]
}
