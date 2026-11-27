// 配合から表示色を出す。画面とステージメーカーで共有する
import { INK_LIST, MAX, MIXED, PAIR_COLOR_NAME_LIST, colorNameOf, amountOf, type Mix } from './core'

export type RGB = [number, number, number]

// インク量1〜6の濃さ
const DENSITY_LIST = [0, 0.2, 0.34, 0.48, 0.62, 0.76, 1]

// インクを重ねる前の白。混色の計算の土台
const PAPER_RGB: RGB = [255, 255, 255]

// base はインクを重ねる下地の色。画面ではセルの色を渡す
export function colorRGB(mix: Mix, base: RGB = PAPER_RGB): RGB {
  const amount = amountOf(mix)
  if (!amount) return base
  const density = DENSITY_LIST[amount]
  const peak = Math.max(...mix)
  const out = base.map(channel => channel / 255) as RGB
  mix.forEach((part, i) => {
    if (!part) return
    const strength = (density * part) / peak
    for (let channel = 0; channel < 3; channel++)
      out[channel] *= 1 - strength * (1 - INK_LIST[i].rgb[channel] / 255)
  })
  return out.map(x => x * 255) as RGB
}

export function rgb(channelList: readonly number[]): string {
  return 'rgb(' + channelList.map(Math.round).join(',') + ')'
}

export function mixRGB(
  fromRGB: readonly number[],
  toRGB: readonly number[],
  ratio: number
): string {
  return rgb(fromRGB.map((channel, i) => channel + (toRGB[i] - channel) * ratio))
}

// 合計6の全配合
export const FULL_MIX_LIST: Mix[] = []
for (let cyanCount = 0; cyanCount <= MAX; cyanCount++)
  for (let magentaCount = 0; cyanCount + magentaCount <= MAX; magentaCount++)
    FULL_MIX_LIST.push([cyanCount, magentaCount, MAX - cyanCount - magentaCount])

export const COLOR_NAME_LIST = INK_LIST.map(ink => ink.name).concat(MIXED)

const PAIR_ALL = new Set(Object.values(PAIR_COLOR_NAME_LIST).flat())
// 2色の環の順（Cyan→Magenta→Yellow→Cyanの手前まで）、続けて3色
export const COLOR_NAME_ORDER_LIST = [
  ...PAIR_COLOR_NAME_LIST['0,1'],
  ...PAIR_COLOR_NAME_LIST['1,2'].slice(1),
  ...PAIR_COLOR_NAME_LIST['0,2'].toReversed().slice(1, -1),
  ...MIXED.filter(name => !PAIR_ALL.has(name)),
]

// 色名ごとの代表色（その名前になる配合の平均）
export const COLOR_NAME_RGB: Record<string, RGB> = {}
for (const name of COLOR_NAME_LIST) {
  const fullMixList = FULL_MIX_LIST.filter(fullMix => colorNameOf(fullMix) === name)
  const average = [0, 1, 2].map(
    i => fullMixList.reduce((sum, fullMix) => sum + fullMix[i], 0) / fullMixList.length
  )
  COLOR_NAME_RGB[name] = colorRGB(average)
}

// 色名のレシピ。固定の量と、2色のどちらでもよい量に分ける
export interface Recipe {
  fixedList: number[]
  free: number
  freePair: [number, number] | null
}

export function recipeOf(name: string): Recipe {
  const fullMixList = FULL_MIX_LIST.filter(fullMix => colorNameOf(fullMix) === name)
  const low = [0, 1, 2].map(i => Math.min(...fullMixList.map(fullMix => fullMix[i])))
  const high = [0, 1, 2].map(i => Math.max(...fullMixList.map(fullMix => fullMix[i])))
  const varyList = [0, 1, 2].filter(i => high[i] > low[i])
  return {
    fixedList: low,
    free: MAX - amountOf(low),
    freePair: varyList.length === 2 ? [varyList[0], varyList[1]] : null,
  }
}
