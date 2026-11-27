// 数の式。×の印に数を4px詰めて続ける
import type { ReactNode, Ref } from 'react'
import { TimesIcon } from './Icon'
import styles from './Times.module.scss'

interface TimesProperty {
  children: ReactNode
  label?: string
  className?: string
  ref?: Ref<HTMLSpanElement>
}

export function Times({ children, label, className, ref }: TimesProperty) {
  return (
    <span
      ref={ref}
      className={[styles.times, className].filter(Boolean).join(' ')}
      aria-label={label}
    >
      <TimesIcon />
      {children}
    </span>
  )
}
