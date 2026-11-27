// スクロールの動き。引っぱり・はじき・端での戻りを扱う。DOM には触れない
// 減速は GSAP の InertiaPlugin に任せる
import { gsap } from 'gsap'
import { InertiaPlugin } from 'gsap/InertiaPlugin'

gsap.registerPlugin(InertiaPlugin)

// 端を越えて引っぱったときの効き
const RUBBER = 0.35
// 端に戻るまでの時間
const SETTLE = 0.5
// InertiaPlugin が端を越えてから戻す動きを止める
// （gsap の型では InertiaVars の duration に InertiaDuration を書けないため、型を付けて渡す）
const NO_OVERSHOOT: gsap.InertiaDuration = { overshoot: 0 }
// はじきの速さを測る範囲と、慣性をつける最低の速さ（px/秒）
const VELOCITY_WINDOW = 100
const VELOCITY_MIN = 20

export interface ScrollMotion {
  readonly y: number
  set(y: number): void
  moving(): boolean
  press(now: number): void
  drag(delta: number, now: number): void
  release(now: number): void
  wheel(delta: number): void
  // 入力が止まったとき。端を越えていれば戻す
  idle(): void
  stop(): void
}

// maxOf はスクロールできる最大量、onChange は位置が変わるたびに呼ぶ
export function createScrollMotion(maxOf: () => number, onChange: () => void): ScrollMotion {
  const state = { y: 0 }
  let tween: gsap.core.Animation | null = null
  const historyList: [number, number][] = []
  const overOf = (y: number) => {
    const max = maxOf()
    return y < 0 ? y : y > max ? y - max : 0
  }
  const stop = () => {
    tween?.kill()
    tween = null
  }
  // 終わった動きを外す。外さないと、止まったときの戻しが効かない
  function finish(this: gsap.core.Animation) {
    if (tween === this) tween = null
  }
  const springBack = () => {
    stop()
    const over = overOf(state.y)
    if (over)
      tween = gsap.to(state, {
        y: state.y - over,
        duration: SETTLE,
        ease: 'power3.out',
        onUpdate: onChange,
        onComplete: finish,
      })
  }
  const fling = (velocity: number) => {
    stop()
    if (overOf(state.y)) {
      springBack()
      return
    }
    if (Math.abs(velocity) < VELOCITY_MIN) return
    // 端を越えずに、端で止まる
    tween = gsap.to(state, {
      inertia: {
        y: { velocity, min: 0, max: maxOf() },
        duration: NO_OVERSHOOT,
      } as gsap.InertiaVars,
      onUpdate: onChange,
      onComplete: finish,
    })
  }
  const moveBy = (delta: number) => {
    const over = overOf(state.y)
    state.y += over !== 0 && Math.sign(delta) === Math.sign(over) ? delta * RUBBER : delta
    onChange()
  }
  return {
    get y() {
      return state.y
    },
    set(y) {
      state.y = y
    },
    moving: () => !!tween?.isActive(),
    press(now) {
      stop()
      historyList.length = 0
      historyList.push([now, state.y])
    },
    drag(delta, now) {
      moveBy(delta)
      historyList.push([now, state.y])
      while (historyList.length > 2 && now - historyList[0][0] > VELOCITY_WINDOW)
        historyList.shift()
    },
    release(now) {
      const first = historyList[0]
      const last = historyList[historyList.length - 1]
      fling(
        first && last && now - last[0] < VELOCITY_WINDOW && last[0] > first[0]
          ? ((last[1] - first[1]) / (last[0] - first[0])) * 1000
          : 0
      )
    },
    wheel(delta) {
      stop()
      moveBy(delta)
    },
    idle() {
      if (!tween) springBack()
    },
    stop,
  }
}
