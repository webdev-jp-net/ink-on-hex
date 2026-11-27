// 課題色を選ぶ欄。選択肢ごとに、色名のヘックス・色名・レシピを並べる。
// 中身を作り変えられないブラウザでは、色名だけのふつうの選択欄になる
import { useId } from 'react'
import { Icon } from '@/components/Icon'
import { Recipe } from '@/components/Recipe'
import { Swatch } from '@/components/Swatch'
import styles from './TargetColorSelect.module.scss'

interface TargetColorSelectProperty {
  // 画面に出す欄の名前。読み上げでは見出しに続けて読む
  label: string
  labelledBy: string
  value: string
  colorNameList: string[]
  // 選ばない（課題色を1色にする）を選べるか
  canBeNone?: boolean
  onChange: (value: string) => void
}

export function TargetColorSelect({
  label,
  labelledBy,
  value,
  colorNameList,
  canBeNone,
  onChange,
}: TargetColorSelectProperty) {
  const labelId = useId()
  return (
    <div className={styles.field}>
      <span id={labelId} className={styles.label}>
        {label}
      </span>
      <select
        className={styles.select}
        aria-labelledby={labelledBy + ' ' + labelId}
        value={value}
        onChange={event => onChange(event.target.value)}
      >
        <button type="button" className={styles.button}>
          <selectedcontent />
          <span className={styles.expand}>
            <Icon name="expand" />
          </span>
        </button>
        {canBeNone && (
          <option value="">
            <span className={styles.none} aria-hidden="true" />
            <span className={styles.name}>None</span>
          </option>
        )}
        {colorNameList.map(name => (
          <option key={name} value={name}>
            <Swatch name={name} isDecorative className={styles.swatch} />
            <span className={styles.text}>
              <span className={styles.name}>{name}</span>
              <span className={styles.recipeSlot}>
                <Recipe name={name} />
              </span>
            </span>
          </option>
        ))}
      </select>
    </div>
  )
}
