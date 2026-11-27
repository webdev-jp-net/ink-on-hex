// 画面のスクロール。ドラッグ・ホイールを GSAP Observer で受け、動きは scrollMotion に任せる
// 盤面と同じフレームで動かすため、位置は engine の描画前処理で反映する
import { useEffectEvent, useLayoutEffect, type RefObject } from 'react'
import { gsap } from 'gsap'
import { Observer } from 'gsap/Observer'
import { addBeforeFrame } from '@/lib/board/engine'
import { isWide } from '@/utils/viewport'
import { kick } from '@/lib/board/redraw'
import { createScrollMotion } from '@/lib/scrollMotion'

gsap.registerPlugin(Observer)

// 端の影が出きるまでの距離
const EDGE_RAMP = 8
// フォーカスした項目を送るとき、見える範囲の端から空ける距離
const FOCUS_MARGIN = 24

interface ScrollerOption {
  viewRef: RefObject<HTMLElement | null>
  innerRef: RefObject<HTMLElement | null>
  headRef: RefObject<HTMLElement | null>
  footRef: RefObject<HTMLElement | null>
  initialY?: number
  // 位置が変わったとき（盤面の配置を合わせる）。y はスクロール量
  onMove?: (y: number) => void
}

export function useScroller({
  viewRef,
  innerRef,
  headRef,
  footRef,
  initialY = 0,
  onMove,
}: ScrollerOption): void {
  const moved = useEffectEvent((y: number) => onMove?.(y))

  useLayoutEffect(() => {
    const view = viewRef.current
    const inner = innerRef.current
    const head = headRef.current
    const foot = footRef.current
    if (!view || !inner || !head || !foot) return
    let applied = Number.NaN
    const maxOf = () => Math.max(0, inner.offsetHeight - (inner.parentElement?.clientHeight ?? 0))
    const scroller = createScrollMotion(maxOf, kick)
    const pad = () => {
      const wide = isWide()
      inner.style.paddingBlockStart = (wide ? 32 : head.offsetHeight + 24) + 'px'
      inner.style.paddingBlockEnd = (wide ? 24 : foot.offsetHeight + 24) + 'px'
    }
    const edge = () => {
      const bounds = inner.getBoundingClientRect()
      const style = getComputedStyle(inner)
      const overTop =
        head.getBoundingClientRect().bottom - (bounds.top + parseFloat(style.paddingTop))
      const overBottom =
        bounds.bottom - parseFloat(style.paddingBottom) - foot.getBoundingClientRect().top
      head.style.setProperty('--edge', Math.max(0, Math.min(1, overTop / EDGE_RAMP)).toFixed(3))
      foot.style.setProperty('--edge', Math.max(0, Math.min(1, overBottom / EDGE_RAMP)).toFixed(3))
    }
    pad()
    scroller.set(Math.min(initialY, maxOf()))
    const apply = () => {
      if (scroller.y === applied) return scroller.moving()
      inner.style.transform = 'translate3d(0,' + (-scroller.y).toFixed(2) + 'px,0)'
      applied = scroller.y
      moved(scroller.y)
      edge()
      return true
    }
    apply()
    const removeFrame = addBeforeFrame(apply)
    const observer = Observer.create({
      target: view,
      type: 'wheel,touch',
      preventDefault: true,
      // ブラウザの拡大（Ctrl＋ホイール、2本指のピンチ）はスクロールにせず、そのまま通す
      ignoreCheck: event =>
        (event instanceof WheelEvent && event.ctrlKey) ||
        (typeof TouchEvent !== 'undefined' &&
          event instanceof TouchEvent &&
          event.touches.length > 1),
      dragMinimum: 2,
      onStopDelay: 0.14,
      onPress: () => scroller.press(performance.now()),
      onDrag: self => scroller.drag(-self.deltaY, performance.now()),
      onDragEnd: () => scroller.release(performance.now()),
      onWheel: self => scroller.wheel(self.deltaY),
      onStop(self) {
        if (!self.isPressed) scroller.idle()
      },
    })
    // キーボードでフォーカスした項目が見出し・フッターに隠れたり画面の外に出たりしたら、見える位置まで送る
    const onFocusIn = (event: FocusEvent) => {
      if (!(event.target instanceof Element) || !inner.contains(event.target)) return
      const bounds = event.target.getBoundingClientRect()
      const body = inner.parentElement!.getBoundingClientRect()
      const wide = isWide()
      const visibleTop = (wide ? body.top : head.getBoundingClientRect().bottom) + FOCUS_MARGIN
      const visibleBottom = (wide ? body.bottom : foot.getBoundingClientRect().top) - FOCUS_MARGIN
      let shift = 0
      if (bounds.top < visibleTop) shift = bounds.top - visibleTop
      else if (bounds.bottom > visibleBottom) shift = bounds.bottom - visibleBottom
      if (!shift) return
      scroller.set(Math.max(0, Math.min(maxOf(), scroller.y + shift)))
      kick()
    }
    view.addEventListener('focusin', onFocusIn)
    const onResize = () => {
      pad()
      edge()
    }
    addEventListener('resize', onResize)
    return () => {
      scroller.stop()
      observer.kill()
      view.removeEventListener('focusin', onFocusIn)
      removeFrame()
      removeEventListener('resize', onResize)
    }
  }, [viewRef, innerRef, headRef, footRef, initialY])
}
