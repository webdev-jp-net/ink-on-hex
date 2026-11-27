// ミッションのスコア領域。課題色・CLEAR・課題色のセル数・1〜6点の行・最終スコア
import type { Ref } from 'react'
import { Times } from '@/components/Times'
import { Icon } from '@/components/Icon'
import { PointHex } from '@/components/PointHex'
import { TargetSwatch } from '@/components/Swatch'
import type { TargetColor } from '@/game/core'
import { usePhase } from '@/hooks/screenContext'
import { POINT_LIST } from './game'
import { useScorePanel, type ScorePanelHandle } from './useScorePanel'
import styles from './ScorePanel.module.scss'

interface ScorePanelProperty {
  ref: Ref<ScorePanelHandle>
  targetColor: TargetColor
  // 作り直すたびに課題色のヘックスを新しくする
  generation: number
  glint: () => boolean
  countList: Record<number, number>
}

const padTwoDigits = (value: number) => String(value).padStart(2, '0')

export function ScorePanel({ ref, targetColor, generation, glint, countList }: ScorePanelProperty) {
  const phase = usePhase()
  const {
    targetHexRef,
    clearRef,
    targetColorCountTextRef,
    pointGridRef,
    pointTextRef,
    totalAmountRef,
    finalRef,
    countedRef,
    extraRef,
    trophyRef,
    reveal,
  } = useScorePanel(ref)
  return (
    <div
      className={[styles.score, phase === 'entering' ? styles.entering : ''].join(' ')}
      aria-live="polite"
      data-testid="score"
    >
      <div className={styles.targetColor}>
        <span ref={targetHexRef} className={styles.targetHex}>
          <TargetSwatch key={generation} targetColor={targetColor} glint={glint} />
        </span>
        <div className={styles.text}>
          <span className={styles.spacer} aria-hidden="true" />
          <span ref={clearRef} className={styles.clear} role="img" aria-label="CLEAR">
            {[...'CLEAR'].map((letter, i) => (
              <span key={i} aria-hidden="true">
                {letter}
              </span>
            ))}
          </span>
          <div className={styles.word}>
            <Times className={styles.times}>
              <span ref={targetColorCountTextRef}>0</span>
              {reveal && (
                <Times ref={extraRef} className={styles.extra}>
                  <span
                    ref={node => {
                      totalAmountRef.current = node
                      if (node) node.textContent = String(countedRef.current.totalAmount)
                    }}
                  />
                  <span style={{ visibility: reveal.isEqualSignShown ? undefined : 'hidden' }}>
                    =
                  </span>
                  <span
                    ref={node => {
                      finalRef.current = node
                      if (node) node.textContent = String(countedRef.current.final)
                    }}
                    className={styles.final}
                    style={{ visibility: reveal.isFinalShown ? undefined : 'hidden' }}
                  >
                    0
                  </span>
                  {reveal.isBestShown && (
                    <span
                      ref={trophyRef}
                      className={styles.best}
                      role="img"
                      aria-label="Best score"
                    >
                      <Icon name="trophy" />
                    </span>
                  )}
                </Times>
              )}
            </Times>
          </div>
        </div>
      </div>
      <div ref={pointGridRef} className={styles.pointList}>
        {POINT_LIST.map(point => (
          <div key={point} className={styles.pointRow}>
            <PointHex point={point} />
            <Times>
              <span>{padTwoDigits(countList[point])}</span>
              <span>=</span>
              <span ref={node => void (pointTextRef.current[point] = node)}>NNN</span>
            </Times>
          </div>
        ))}
      </div>
    </div>
  )
}
