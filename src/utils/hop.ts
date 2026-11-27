// CLEARとトロフィーの出方。少し上から現れ、さらに跳ねてから着地する（design.md「動き」）
import { gsap } from 'gsap'

const CLEAR_HOP = 2
const CLEAR_UP = 0.08
const CLEAR_DOWN = 0.15

export function hopIn(target: Element[] | Element, stagger: number) {
  gsap.fromTo(
    target,
    { opacity: 0, y: -CLEAR_HOP / 2 },
    {
      keyframes: [
        { opacity: 1, y: -CLEAR_HOP, duration: CLEAR_UP, ease: 'power2.out' },
        { y: 0, duration: CLEAR_DOWN, ease: 'power2.out' },
      ],
      stagger,
    }
  )
}
