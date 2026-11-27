// 一覧画面の枠。見出し・スクロールする本文・フッター
import { useRef, type ReactNode, type RefObject } from 'react'
import { useScroller } from '@/hooks/useScroller'
import { usePhase } from '@/hooks/screenContext'
import styles from './ListScreen.module.scss'

interface ListScreenProperty {
  title: string
  className?: string
  scrollClassName?: string
  initialY?: number
  bodyRef?: RefObject<HTMLDivElement | null>
  onMove?: (y: number) => void
  children: ReactNode
}

export function ListScreen({
  title,
  className,
  scrollClassName,
  initialY,
  bodyRef,
  onMove,
  children,
}: ListScreenProperty) {
  const viewRef = useRef<HTMLElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const footRef = useRef<HTMLDivElement>(null)
  const phase = usePhase()
  useScroller({ viewRef, innerRef, headRef, footRef, initialY, onMove })
  return (
    <section
      ref={viewRef}
      className={[styles.screen, className].filter(Boolean).join(' ')}
      data-phase={phase}
    >
      <div ref={headRef} className={styles.head}>
        <h2 className={styles.title}>{title}</h2>
      </div>
      <div ref={bodyRef} className={styles.body}>
        <div
          ref={innerRef}
          className={[styles.scroll, scrollClassName].filter(Boolean).join(' ')}
          data-testid="scroll"
        >
          {children}
        </div>
      </div>
      <div ref={footRef} className={styles.foot} />
    </section>
  )
}
