// CSS変数（src/styles/index.scss）の値を読む。デザインの値はCSS変数を正とする
const cache = new Map<string, string>()

export function cssToken(name: string): string {
  let value = cache.get(name)
  if (value === undefined) {
    value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    // CSSが当たる前の空の値は覚えない
    if (value) cache.set(name, value)
  }
  return value
}
