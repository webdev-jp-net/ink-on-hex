// 課題色ができたときに盤面を走る光（sweep）の進み具合
import { kick } from './redraw'

const SWEEP_PERIOD = 4000
const SWEEP_MS = 2400
const SWEEP_HOLD = 300

// 光の帯の形（盤面のシェーダーと色名のヘックスで共有する）
export const SWEEP_WIDTH = 0.05
export const SWEEP_TAIL_OFFSET = SWEEP_WIDTH * 2.6
export const SWEEP_TAIL_WIDTH = SWEEP_WIDTH / 2
export const SWEEP_TAIL_WEIGHT = 0.45
// 光の帯をかける強さ（上面・縁）と上限
export const SWEEP_FACE = 0.34
export const SWEEP_RIM = 0.9
export const SWEEP_MAX = 0.85

// 光の帯の明るさ。x は帯の中心からの位置（画面の幅と高さの和を1とする）
export function sweepBand(x: number): number {
  return (
    Math.exp(-(x * x) / (2 * SWEEP_WIDTH ** 2)) +
    SWEEP_TAIL_WEIGHT * Math.exp(-((x + SWEEP_TAIL_OFFSET) ** 2) / (2 * SWEEP_TAIL_WIDTH ** 2))
  )
}

let sweepStart: number | null = null

// 走っていないときは終わった後（1以上）を返す
export function sweepPhase(): number {
  return sweepStart == null
    ? Infinity
    : ((performance.now() - sweepStart) % SWEEP_PERIOD) / SWEEP_MS
}

export function startSweep(): void {
  const now = performance.now()
  if (sweepStart != null && now - sweepStart < SWEEP_HOLD) return
  sweepStart = now
  kick()
}

// 光の帯の位置。走っていないときは null
export function sweepNow(): number | null {
  const phase = sweepPhase()
  if (phase >= 1) return null
  const eased = 0.5 - 0.5 * Math.cos(Math.PI * phase)
  return -0.25 + 1.5 * eased
}

export function resetSweep(): void {
  sweepStart = null
}
