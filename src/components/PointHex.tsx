// 点数の印。ヘックスの輪郭に点数の数字を重ねる
import { HEX_POINT, HEX_VIEW_BOX } from './hex'
import styles from './PointHex.module.scss'

export function PointHex({ point }: { point: number }) {
  return (
    <span
      className={styles.pointHex}
      role="img"
      aria-label={point + (point === 1 ? ' point' : ' points')}
    >
      <svg viewBox={HEX_VIEW_BOX} overflow="visible" aria-hidden="true">
        <polygon
          points={HEX_POINT}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className={styles.digit}>{point}</span>
    </span>
  )
}
