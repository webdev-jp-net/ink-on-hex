// ヘックスの両端だけを描いたボタン。ホームの入口に使う
import styles from './HexButton.module.scss'

interface HexButtonProperty {
  label: string
  onClick: () => void
}

export function HexButton({ label, onClick }: HexButtonProperty) {
  return (
    <button type="button" className={styles.hexButton} onClick={onClick}>
      <svg viewBox="0 0 192 48" aria-hidden="true">
        <polyline points="12.62,16.00 8.00,24.00 12.62,32.00" />
        <polyline points="179.38,16.00 184.00,24.00 179.38,32.00" />
      </svg>
      <span>{label}</span>
    </button>
  )
}
