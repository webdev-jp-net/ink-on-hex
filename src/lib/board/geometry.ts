// ヘックスの座標とカメラの計算。状態を持たない
import { buildField, ROOT3 } from '@/game/core'
import { viewHeight } from '@/utils/viewport'
import type { Camera } from './createBoard'

const HOME_TILT = (12 * Math.PI) / 180
const HOME_YAW = (8 * Math.PI) / 180
const HOME_FLOW = -6
export const HOME_TILE = 80
export const HOME_TILE_GAP = 8

export function worldPosition(q: number, r: number): [number, number] {
  return [1.5 * q, ROOT3 * (r + q / 2)]
}

export function axialRound(q: number, r: number): [number, number] {
  const x = q
  const z = r
  const y = -x - z
  let roundX = Math.round(x)
  const roundY = Math.round(y)
  let roundZ = Math.round(z)
  const diffX = Math.abs(roundX - x)
  const diffY = Math.abs(roundY - y)
  const diffZ = Math.abs(roundZ - z)
  if (diffX > diffY && diffX > diffZ) roundX = -roundY - roundZ
  else if (diffY <= diffZ) roundZ = -roundX - roundY
  return [roundX, roundZ]
}

export interface Box {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export function boxOf(keyList: [number, number][]): Box {
  const box = { minX: 1e9, maxX: -1e9, minY: 1e9, maxY: -1e9 }
  for (const [q, r] of keyList) {
    const [x, y] = worldPosition(q, r)
    box.minX = Math.min(box.minX, x)
    box.maxX = Math.max(box.maxX, x)
    box.minY = Math.min(box.minY, y)
    box.maxY = Math.max(box.maxY, y)
  }
  return box
}

// 盤面の外接矩形（px）
export function fieldBox(radius: number, cellHeight: number, gap: number) {
  const pitch = (cellHeight + gap) / ROOT3
  const hexRadius = cellHeight / ROOT3
  const box = boxOf(buildField(radius).cellList.map(cell => [cell.q, cell.r]))
  return {
    pitch,
    hexRadius,
    width: (box.maxX - box.minX) * pitch + 2 * hexRadius,
    height: (box.maxY - box.minY) * pitch + cellHeight,
  }
}

// 要素の左上に盤面の外接矩形を合わせるカメラ
export function cameraOn(slot: Element, box: Box, scale: number, tileRatio: number): Camera {
  const bounds = slot.getBoundingClientRect()
  const hexRadius = tileRatio * scale
  return {
    scale,
    tileRatio,
    offsetX: bounds.left + hexRadius - box.minX * scale,
    offsetY: bounds.top + (hexRadius * ROOT3) / 2 - box.minY * scale,
  }
}

export function homeCamera(offset = 0): Camera {
  return {
    scale: (HOME_TILE + HOME_TILE_GAP) / ROOT3,
    tileRatio: HOME_TILE / (HOME_TILE + HOME_TILE_GAP),
    offsetX: innerWidth / 2,
    offsetY: viewHeight() / 2 + offset,
    tilt: HOME_TILT,
    yaw: HOME_YAW,
  }
}

export const homeFlowOffset = (elapsedMs: number) => (elapsedMs / 1000) * HOME_FLOW

// ホームの傾きに対する、カメラの傾きの割合（0〜1）
export function angleRatio(camera: Camera): number {
  return Math.min(
    1,
    Math.hypot(Math.sin(camera.tilt || 0), Math.sin(camera.yaw || 0)) /
      Math.hypot(Math.sin(HOME_TILT), Math.sin(HOME_YAW))
  )
}

// 2つのカメラの途中。focus のセルが画面上をまっすぐ動くように寄り引きする
export function cameraBetween(
  fromCamera: Camera,
  toCamera: Camera,
  focus: [number, number],
  progress: number
): Camera {
  const scale = Math.exp(
    Math.log(fromCamera.scale) + (Math.log(toCamera.scale) - Math.log(fromCamera.scale)) * progress
  )
  const tileRatio = fromCamera.tileRatio + (toCamera.tileRatio - fromCamera.tileRatio) * progress
  const [focusX, focusY] = worldPosition(focus[0], focus[1])
  const fromX = focusX * fromCamera.scale + fromCamera.offsetX
  const fromY = focusY * fromCamera.scale + fromCamera.offsetY
  const planeX = fromX + (focusX * toCamera.scale + toCamera.offsetX - fromX) * progress
  const planeY = fromY + (focusY * toCamera.scale + toCamera.offsetY - fromY) * progress
  const interpolate = (from = 0, to = 0) => from + (to - from) * progress
  return {
    scale,
    tileRatio,
    offsetX: planeX - focusX * scale,
    offsetY: planeY - focusY * scale,
    tilt: interpolate(fromCamera.tilt, toCamera.tilt),
    yaw: interpolate(fromCamera.yaw, toCamera.yaw),
  }
}
