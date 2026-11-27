// 画面の大きさとレイアウトの判定

export function viewHeight(): number {
  return window.visualViewport ? window.visualViewport.height : innerHeight
}

export function isWide(): boolean {
  return matchMedia('(width >= 900px) and (orientation: landscape)').matches
}
