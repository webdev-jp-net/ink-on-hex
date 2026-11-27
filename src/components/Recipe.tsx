// レシピ。6つの点で、色名を作るインクの配合を示す。どちらでもよい量は半分ずつの点
import { useId } from 'react'
import { INK_LIST, MAX } from '@/game/core'
import { recipeOf, rgb } from '@/game/color'
import { uncoloredRGB } from '@/utils/colorToken'
import styles from './Recipe.module.scss'

function Dot({ fill, split }: { fill: string; split?: string }) {
  const id = useId().replace(/[^\w-]/g, '')
  if (!split)
    return (
      <svg className={styles.dot} viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="20" fill={fill} />
      </svg>
    )
  return (
    <svg className={styles.dot} viewBox="0 0 40 40" aria-hidden="true">
      <clipPath id={id}>
        <circle cx="20" cy="20" r="20" />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        <rect width="20" height="40" fill={fill} />
        <rect x="20" width="20" height="40" fill={split} />
      </g>
    </svg>
  )
}

export function Recipe({ name }: { name: string | null }) {
  if (!name)
    return (
      <span className={styles.recipe}>
        {Array.from({ length: MAX }, (_, i) => (
          <Dot key={i} fill={rgb(uncoloredRGB())} />
        ))}
      </span>
    )
  const recipe = recipeOf(name)
  const colorOf = (i: number) => rgb(INK_LIST[i].rgb)
  const dotList: { fill: string; split?: string }[] = []
  for (let i = 0; i < 3; i++) {
    if (recipe.freePair && i === recipe.freePair[1])
      for (let count = 0; count < recipe.free; count++)
        dotList.push({ fill: colorOf(recipe.freePair[0]), split: colorOf(recipe.freePair[1]) })
    for (let count = 0; count < recipe.fixedList[i]; count++) dotList.push({ fill: colorOf(i) })
  }
  return (
    <span className={styles.recipe}>
      {dotList.map((dot, i) => (
        <Dot key={i} {...dot} />
      ))}
    </span>
  )
}
