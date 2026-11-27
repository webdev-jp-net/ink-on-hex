// 盤面を描き直すかどうかの印。変化があった側が kick し、毎フレームの描画が読んで下ろす
let isDirty = true

export function kick(): void {
  isDirty = true
}

export function isRedrawNeeded(): boolean {
  return isDirty
}

export function markDrawn(): void {
  isDirty = false
}
