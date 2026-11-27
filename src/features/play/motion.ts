// プレイ画面の演出。課題色のヘックスを盤面と同じ浮きで出す動き
import { gsap } from 'gsap'
import { ROOT3 } from '@/game/core'
import { PERSPECTIVE } from '@/lib/board/createBoard'
import { SPAWN_LIFT, boardOf, transitionProgress } from '@/lib/board/engine'

const CHIP_HEIGHT = 64

// 場面の切り替え中、課題色のヘックスを盤面のセルと同じ浮きで出す
export function followSpawn(hex: HTMLElement): void {
  const bounds = hex.getBoundingClientRect()
  const centerX = bounds.left + bounds.width / 2
  const centerY = bounds.top + bounds.height / 2
  const tileRadius = CHIP_HEIGHT / ROOT3
  const tick = () => {
    const zoomProgress = transitionProgress()
    if (zoomProgress == null) {
      gsap.ticker.remove(tick)
      gsap.set(hex, { clearProps: 'transform,opacity' })
      return
    }
    const board = boardOf()
    const distance = board.height * PERSPECTIVE
    const scale = distance / (distance - (1 - zoomProgress) * SPAWN_LIFT * tileRadius)
    gsap.set(hex, {
      x: (centerX - board.width / 2) * (scale - 1),
      y: (centerY - board.height / 2) * (scale - 1),
      scale,
      opacity: zoomProgress,
      transformOrigin: '50% 50%',
    })
  }
  tick()
  gsap.ticker.add(tick)
}
