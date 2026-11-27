// ルール（盤面・垂らす・色名・スコア）。画面に依存しない
export const MAX = 6
export const ROOT3 = Math.sqrt(3)

export type Mix = number[]
export type State = Record<string, Mix>
export type Removed = (q: number, r: number) => boolean
export type TargetColor = string | string[]

export interface Cell {
  q: number
  r: number
  key: string
  x: number
  y: number
}

export interface Field {
  cellList: Cell[]
  map: Map<string, Cell>
}

export interface Ink {
  name: string
  rgb: [number, number, number]
}

export const INK_LIST: Ink[] = [
  { name: 'Cyan', rgb: [0, 174, 239] },
  { name: 'Magenta', rgb: [236, 0, 140] },
  { name: 'Yellow', rgb: [255, 242, 0] },
]

export const PAIR_COLOR_NAME_LIST: Record<string, string[]> = {
  '0,1': ['Cyan', 'Azure', 'Cobalt', 'Blue', 'Purple', 'Violet', 'Magenta'],
  '1,2': ['Magenta', 'Rose', 'Crimson', 'Red', 'Orange', 'Amber', 'Yellow'],
  '0,2': ['Cyan', 'Spring Green', 'Jade', 'Green', 'Lime', 'Chartreuse', 'Yellow'],
}

export const MIXED = [
  'Azure',
  'Cobalt',
  'Blue',
  'Purple',
  'Violet',
  'Rose',
  'Crimson',
  'Red',
  'Orange',
  'Amber',
  'Chartreuse',
  'Lime',
  'Green',
  'Jade',
  'Spring Green',
  'Dark Cyan',
  'Dark Cobalt',
  'Dark Purple',
  'Dark Magenta',
  'Dark Crimson',
  'Dark Orange',
  'Dark Yellow',
  'Dark Lime',
  'Dark Jade',
  'Black',
]

const DIRECTION_LIST: [number, number][] = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
]

// 'q,r;q,r;...' で列挙したセルで true を返す判定関数。ステージメーカーの書き出しに使う
export function cellSet(list: string): Removed {
  const keyList = new Set(String(list).split(';').filter(Boolean))
  return (q, r) => keyList.has(q + ',' + r)
}

export function hexDistance(q: number, r: number): number {
  return (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2
}

export function keyOf(q: number, r: number): string {
  return q + ',' + r
}

export function buildField(radius: number, removed?: Removed | null): Field {
  const cellList: Cell[] = []
  const map = new Map<string, Cell>()
  for (let r = -radius; r <= radius; r++)
    for (let q = -radius; q <= radius; q++) {
      if (hexDistance(q, r) > radius) continue
      if (removed && removed(q, r)) continue
      const cell = { q, r, key: keyOf(q, r), x: 1.5 * q, y: ROOT3 * (r + q / 2) }
      cellList.push(cell)
      map.set(cell.key, cell)
    }
  return { cellList, map }
}

export function newState(field: Field): State {
  const state: State = {}
  for (const cell of field.cellList) state[cell.key] = INK_LIST.map(() => 0)
  return state
}

export function cloneState(state: State): State {
  const copy: State = {}
  for (const key in state) copy[key] = state[key].slice()
  return copy
}

export function amountOf(mix: Mix): number {
  return mix.reduce((sum, part) => sum + part, 0)
}

export function canDrop(state: State, key: string): boolean {
  return key in state && amountOf(state[key]) < MAX
}

export function ringListOf(field: Field, key: string): string[][] {
  const out = [[key]]
  const seen = new Set([key])
  for (let distance = 1; distance < MAX; distance++) {
    const next: string[] = []
    for (const currentKey of out[distance - 1]) {
      const cell = field.map.get(currentKey)!
      for (const [stepQ, stepR] of DIRECTION_LIST) {
        const nextKey = keyOf(cell.q + stepQ, cell.r + stepR)
        if (field.map.has(nextKey) && !seen.has(nextKey)) {
          seen.add(nextKey)
          next.push(nextKey)
        }
      }
    }
    if (!next.length) break
    out.push(next)
  }
  return out
}

export function applyRing(state: State, ring: string[], ink: number, distance: number): void {
  const addedAmount = MAX - distance
  for (const key of ring) {
    const mix = state[key]
    const got = Math.min(addedAmount, MAX - amountOf(mix))
    if (got > 0) mix[ink] += got
  }
}

export function applyDrop(field: Field, state: State, key: string, ink: number): void {
  ringListOf(field, key).forEach((ring, distance) => applyRing(state, ring, ink, distance))
}

export function colorNameOf(mix: Mix): string | null {
  if (amountOf(mix) !== MAX) return null
  const usedList: number[] = []
  mix.forEach((part, i) => {
    if (part > 0) usedList.push(i)
  })
  if (usedList.length === 1) return INK_LIST[usedList[0]].name
  if (usedList.length === 2) {
    const [low, high] = usedList
    return PAIR_COLOR_NAME_LIST[low + ',' + high][mix[high]]
  }
  const base = Math.min(...mix)
  if (mix.every(part => part === base)) return 'Black'
  const remainList = mix.map(part => part - base)
  const restList: number[] = []
  remainList.forEach((part, i) => {
    if (part > 0) restList.push(i)
  })
  if (restList.length === 1) return 'Dark ' + INK_LIST[restList[0]].name
  return (
    'Dark ' +
    PAIR_COLOR_NAME_LIST[restList[0] + ',' + restList[1]][
      (remainList[restList[1]] * MAX) / (MAX - 3 * base)
    ]
  )
}

export function targetColorListOf(targetColor: TargetColor | null | undefined): string[] {
  if (targetColor == null) return []
  return Array.isArray(targetColor) ? targetColor : [targetColor]
}

export function isTargetColor(name: string | null, targetColor: TargetColor): boolean {
  return !!name && targetColorListOf(targetColor).includes(name)
}

export interface Score {
  totalAmount: number
  hitCount: number
  each: number[]
}

export function scoreOf(state: State, targetColor: TargetColor): Score {
  const nameList = targetColorListOf(targetColor)
  let totalAmount = 0
  let hitCount = 0
  const each = nameList.map(() => 0)
  for (const key in state) {
    totalAmount += amountOf(state[key])
    const i = nameList.indexOf(colorNameOf(state[key]) ?? '')
    if (i >= 0) {
      hitCount++
      each[i]++
    }
  }
  return { totalAmount, hitCount, each }
}

// 課題色がすべて1セル以上あればCLEAR
export function isCleared(score: Score): boolean {
  return score.each.length > 0 && score.each.every(count => count > 0)
}

// 最終スコア。CLEARしていなければ0
export function finalScoreOf(score: Score): number {
  return isCleared(score) ? score.hitCount * score.totalAmount : 0
}

export function isFull(state: State): boolean {
  for (const key in state) if (amountOf(state[key]) < MAX) return false
  return true
}
