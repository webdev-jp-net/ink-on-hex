// 盤面に映す場面の型。画面ごとに作り、engine の enter で切り替える
import type { Camera } from './createBoard'

export interface CellLook {
  alpha: number
  color: readonly number[]
  stroke: number
  zoom?: number
  glint?: number
}

// 盤面に映す場面。画面ごとに作る
export interface Scene {
  camera: Camera
  focus: [number, number]
  cell(q: number, r: number): CellLook
  colored(): boolean
  isHome?: boolean
  clipTop?: number
  clipBottom?: number
  tick?(now: number): boolean
  layout?(): void
  // タイルを置きうる座標（"q,r"）。この外の座標で cell はタイルを返さない。
  // 盤面の限られた範囲にだけタイルを置く場面が知らせると、切り替えの終わりにその範囲だけを調べる
  tileKeyList?(): Iterable<string>
}

// 何も描かないセル。透明なので色は使われない
export const EMPTY: CellLook = { alpha: 0, color: [255, 255, 255], stroke: 0 }
