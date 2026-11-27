import { createContext, useContext, useEffectEvent, useLayoutEffect } from 'react'
import { enter } from '@/lib/board/engine'
import { type Scene } from '@/lib/board/scene'

export type Phase = 'entering' | 'idle' | 'leaving'

export interface ScreenContextValue {
  phase: Phase
  // 場面の切り替えが終わったら呼ぶ
  entered(): void
}

export const ScreenContext = createContext<ScreenContextValue>({ phase: 'idle', entered: () => {} })

export function usePhase(): Phase {
  return useContext(ScreenContext).phase
}

// 画面を開いたときに盤面の場面を切り替える。build は配置が決まった後に一度だけ呼ぶ
export function useScene(build: () => Scene, onEnter?: () => void): void {
  const context = useContext(ScreenContext)
  const start = useEffectEvent(() => {
    // 最初の画面は表示済み（idle）で始まる。消えていく画面だけは場面を作らない
    if (context.phase === 'leaving') return null
    return enter(build())
  })
  const finish = useEffectEvent(() => {
    context.entered()
    onEnter?.()
  })
  // 開いたときに一度だけ
  useLayoutEffect(() => {
    const entering = start()
    if (!entering) return
    let isAlive = true
    entering.then(() => {
      if (isAlive) finish()
    })
    return () => {
      isAlive = false
    }
  }, [])
}
