// 端末に残す記録。コレクション・作った回数・ベストスコア
import { INK_LIST, MIXED } from './core'

const KEY_COLLECTION = 'inkOnHex.collectionList'
const KEY_MADE = 'inkOnHex.madeCount'
const KEY_BEST = 'inkOnHex.bestList'

export type DropList = [string, number][]

export interface BestRecord {
  score: number
  dropList: DropList
}

// 読んだ値は形を確かめるまで unknown として扱う
function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isDropList = (value: unknown): value is DropList =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(
    step =>
      Array.isArray(step) &&
      step.length === 2 &&
      typeof step[0] === 'string' &&
      Number.isInteger(step[1]) &&
      step[1] >= 0 &&
      step[1] < INK_LIST.length
  )

function readCollection(): string[] {
  const value = read(KEY_COLLECTION)
  return Array.isArray(value) ? value.filter(name => MIXED.includes(name)) : []
}

function readMadeCount(): Record<string, number> {
  const value = read(KEY_MADE)
  const result: Record<string, number> = {}
  if (isRecord(value))
    for (const name in value) {
      const count = value[name]
      if (typeof count === 'number' && Number.isFinite(count)) result[name] = count
    }
  return result
}

function readBestList(): Record<string, BestRecord> {
  const value = read(KEY_BEST)
  const result: Record<string, BestRecord> = {}
  if (isRecord(value))
    for (const key in value) {
      const record = value[key]
      if (isRecord(record) && typeof record.score === 'number' && isDropList(record.dropList))
        result[key] = { score: record.score, dropList: record.dropList }
    }
  return result
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 保存できない環境では記録しない
  }
}

export const collection = new Set(readCollection())
export const madeCount = readMadeCount()
const bestList = readBestList()

export function bestOf(missionIndex: number): BestRecord | null {
  return bestList[String(missionIndex)] ?? null
}

export function saveBest(missionIndex: number, record: BestRecord): void {
  bestList[String(missionIndex)] = record
  write(KEY_BEST, bestList)
}

// 作った色を記録し、新しく集まった色があれば true
export function commitMade(tally: Record<string, number>): boolean {
  let hasNewColor = false
  for (const name in tally) {
    madeCount[name] = (madeCount[name] || 0) + tally[name]
    if (MIXED.includes(name) && !collection.has(name)) {
      collection.add(name)
      hasNewColor = true
    }
  }
  write(KEY_MADE, madeCount)
  if (hasNewColor) write(KEY_COLLECTION, [...collection])
  return hasNewColor
}
