// 時間とイージングはCSS変数（src/styles/index.scss）を正とし、JSはそれを読む
import { cssToken as raw } from './cssToken'

// '240ms' / '.24s' → 秒
export function seconds(name: string): number {
  const value = raw(name)
  const matched = value.match(/^(-?[\d.]+)(ms|s)$/)
  if (!matched) throw new Error('時間のCSS変数が読めません: ' + name + '=' + value)
  return matched[2] === 'ms' ? Number(matched[1]) / 1000 : Number(matched[1])
}

export function milliseconds(name: string): number {
  return seconds(name) * 1000
}

// 3次ベジェ。CSSの cubic-bezier と同じ曲線
export function bezier(x1: number, y1: number, x2: number, y2: number): (time: number) => number {
  return time => {
    let curveParameter = time
    for (let i = 0; i < 8; i++) {
      const x =
        3 * x1 * curveParameter * (1 - curveParameter) ** 2 +
        3 * x2 * curveParameter ** 2 * (1 - curveParameter) +
        curveParameter ** 3 -
        time
      const slope =
        3 * x1 * (1 - curveParameter) * (1 - 3 * curveParameter) +
        3 * x2 * curveParameter * (2 - 3 * curveParameter) +
        3 * curveParameter ** 2
      if (Math.abs(x) < 1e-5) break
      curveParameter = Math.max(0, Math.min(1, curveParameter - x / (slope || 1e-6)))
    }
    return (
      3 * y1 * curveParameter * (1 - curveParameter) ** 2 +
      3 * y2 * curveParameter ** 2 * (1 - curveParameter) +
      curveParameter ** 3
    )
  }
}

const easeCache = new Map<string, (time: number) => number>()

// 'cubic-bezier(.2,0,0,1)' → 関数
export function easing(name: string): (time: number) => number {
  let callback = easeCache.get(name)
  if (!callback) {
    const matched = raw(name).match(/cubic-bezier\(([^)]+)\)/)
    if (!matched) throw new Error('イージングのCSS変数が読めません: ' + name)
    const [x1, y1, x2, y2] = matched[1].split(',').map(Number)
    callback = bezier(x1, y1, x2, y2)
    easeCache.set(name, callback)
  }
  return callback
}

export const ease = (time: number): number => easing('--ease-standard')(time)
