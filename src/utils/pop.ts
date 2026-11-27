// 点やボタンが少し大きく出てから落ち着く出方
import { gsap } from 'gsap'
import { seconds } from './motionToken'

export const POP = {
  from: 0.5,
  over: 1.1,
  in: 0.3,
  settle: 0.2,
  stagger: () => seconds('--duration-stagger'),
  out: () => seconds('--duration-move'),
}

export function popIn(elementList: Element[] | NodeListOf<Element>): void {
  gsap.fromTo(
    elementList,
    { opacity: 0, scale: POP.from },
    {
      keyframes: [
        { opacity: 1, scale: POP.over, duration: POP.in, ease: 'power2.out' },
        { scale: 1, duration: POP.settle, ease: 'power2.out' },
      ],
      stagger: POP.stagger(),
      overwrite: true,
    }
  )
}
