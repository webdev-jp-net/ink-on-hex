// 右下のボタン群。入れ替えるときは古いほうを消しながら新しいほうを出す
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { seconds } from '@/utils/motionToken'
import styles from './Play.module.scss'

interface Shown {
  key: string
  node: ReactNode
  isLeaving: boolean
}

export function FootActionList({
  actionKey,
  children,
}: {
  actionKey: string
  children: ReactNode
}) {
  const [shownList, setShownList] = useState<Shown[]>(() => [
    { key: actionKey, node: children, isLeaving: false },
  ])
  const [lastKey, setLastKey] = useState(actionKey)
  if (actionKey !== lastKey) {
    setLastKey(actionKey)
    setShownList(list => [
      ...list.filter(one => !one.isLeaving).map(one => ({ ...one, isLeaving: true })),
      { key: actionKey, node: children, isLeaving: false },
    ])
  }
  // 中身（押せる・押せない）は最新を映す
  const latest = shownList.map(one =>
    one.key === actionKey && !one.isLeaving ? { ...one, node: children } : one
  )
  return (
    <span className={styles.footRight} data-testid="foot-actions">
      {latest.map(one => (
        <Group
          key={one.key + (one.isLeaving ? '-out' : '')}
          isLeaving={one.isLeaving}
          onGone={() =>
            setShownList(list => list.filter(x => x !== one && !(x.key === one.key && x.isLeaving)))
          }
        >
          {one.node}
        </Group>
      ))}
    </span>
  )
}

function Group({
  isLeaving,
  onGone,
  children,
}: {
  isLeaving: boolean
  onGone: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const duration = seconds('--duration-fade-out')
    if (!ref.current) {
      if (isLeaving) onGone()
      return
    }
    if (isLeaving) gsap.to(ref.current, { opacity: 0, duration, ease: 'none', onComplete: onGone })
    else gsap.fromTo(ref.current, { opacity: 0 }, { opacity: 1, duration, ease: 'none' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLeaving])
  if (!children) return null
  return (
    <span ref={ref} className={[styles.footGroup, isLeaving ? styles.out : ''].join(' ')}>
      {children}
    </span>
  )
}
