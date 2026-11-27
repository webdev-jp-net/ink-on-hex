// 一覧の並びを決める値（PCレイアウトかどうかと列数）。変わったら一覧を作り直すのに使う
import { useSyncExternalStore } from 'react'
import { isWide } from '@/utils/viewport'
import { collectionColumnCount } from '@/features/collection/layout'
import { missionColumnCount } from '@/lib/missionLayout'

function subscribe(onChange: () => void) {
  addEventListener('resize', onChange)
  return () => removeEventListener('resize', onChange)
}

const missionListKeyOf = () => [isWide(), missionColumnCount()].join(',')
const collectionKeyOf = () => [isWide(), collectionColumnCount()].join(',')

// 一覧ごとに、その一覧の列数だけを見る
export function useLayoutKey(screen: 'missionList' | 'collection'): string {
  return useSyncExternalStore(
    subscribe,
    screen === 'missionList' ? missionListKeyOf : collectionKeyOf
  )
}
