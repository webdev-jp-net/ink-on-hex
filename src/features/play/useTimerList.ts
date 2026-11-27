// 予約した動き（遅延呼び出し・タイムライン）をまとめて持ち、画面を離れはじめたときと閉じたときに止める
import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import type { Phase } from '@/hooks/screenContext'

export function useTimerList(phase: Phase) {
  const timerList = useRef<gsap.core.Animation[]>([])

  const later = (delayMs: number, callback: () => void) => {
    timerList.current.push(gsap.delayedCall(delayMs / 1000, callback))
  }
  const track = (animation: gsap.core.Animation) => {
    timerList.current.push(animation)
  }
  const clear = () => {
    timerList.current.forEach(timer => timer.kill())
    timerList.current = []
  }
  useLayoutEffect(() => () => clear(), [])
  useLayoutEffect(() => {
    if (phase === 'leaving') clear()
  }, [phase])

  return { later, track, clear }
}
