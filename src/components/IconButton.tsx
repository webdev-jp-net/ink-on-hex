// アイコンのボタン。記号はアイコンで描き、PCレイアウトでは名前を横に添える
import { Icon, type IconName } from './Icon'
import styles from './IconButton.module.scss'

interface IconButtonProperty {
  icon: IconName
  label: string
  onClick: () => void
  disabled?: boolean
  // PCレイアウトでも名前を添えず、アイコンだけにする
  isCompact?: boolean
  // 置き場所は残したまま隠す。押せず、フォーカスも当たらない（見た目の消し方は使う側が className で決める）
  isHidden?: boolean
  className?: string
}

export function IconButton({
  icon,
  label,
  onClick,
  disabled,
  isCompact,
  isHidden,
  className,
}: IconButtonProperty) {
  return (
    <button
      type="button"
      className={[styles.iconButton, isCompact ? styles.compact : '', className]
        .filter(Boolean)
        .join(' ')}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      inert={isHidden}
    >
      <Icon name={icon} />
    </button>
  )
}
