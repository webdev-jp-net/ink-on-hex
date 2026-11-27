// インクを選ぶボタン。色はインク（ゲームの中身）にだけ使う
import styles from './InkButton.module.scss'

interface InkButtonProperty {
  label: string
  // CSSの色（rgb(...)）
  color: string
  isSelected: boolean
  // 終了して選べないとき
  disabled?: boolean
  onClick: () => void
}

export function InkButton({ label, color, isSelected, disabled, onClick }: InkButtonProperty) {
  return (
    <button
      type="button"
      className={styles.inkButton}
      aria-label={label}
      aria-pressed={isSelected}
      disabled={disabled}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <circle cx="12" cy="12" r="12" fill={color} />
      </svg>
    </button>
  )
}
