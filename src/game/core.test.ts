import { describe, expect, test } from 'bun:test'
import {
  MIXED,
  applyDrop,
  applyRing,
  buildField,
  canDrop,
  hexDistance,
  isFull,
  colorNameOf,
  newState,
  finalScoreOf,
  isCleared,
  scoreOf,
  amountOf,
  type State,
} from './core'
import { MISSION_LIST } from './missionList'

// 毎回同じ結果になる乱数（mulberry32）
function seededRandom(seed: number) {
  let value = seed
  return () => {
    value = (value + 0x6d2b79f5) | 0
    let mixed = Math.imul(value ^ (value >>> 15), 1 | value)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

describe('垂らす', () => {
  test('中心から6,5,4,3,2,1と広がる', () => {
    const field = buildField(8)
    const state = newState(field)
    applyDrop(field, state, '0,0', 0)
    for (const cell of field.cellList)
      expect(state[cell.key][0]).toBe(Math.max(0, 6 - hexDistance(cell.q, cell.r)))
  })
  test('上限6を超える分は入らない', () => {
    const state = newState(buildField(8))
    state['0,0'] = [4, 0, 0]
    applyRing(state, ['0,0'], 1, 1)
    expect(state['0,0']).toEqual([4, 2, 0])
    expect(colorNameOf(state['0,0'])).toBe('Cobalt')
  })
  test('満杯のセルには垂らせない', () => {
    expect(canDrop({ a: [3, 3, 0] }, 'a')).toBe(false)
    expect(canDrop({ a: [3, 2, 0] }, 'a')).toBe(true)
  })
})

describe('色名', () => {
  test('3色', () => {
    expect(colorNameOf([2, 2, 2])).toBe('Black')
    expect(colorNameOf([4, 1, 1])).toBe('Dark Cyan')
    expect(colorNameOf([3, 2, 1])).toBe('Dark Cobalt')
    expect(colorNameOf([2, 3, 1])).toBe('Dark Purple')
    expect(colorNameOf([3, 1, 2])).toBe('Dark Jade')
    expect(colorNameOf([2, 1, 0])).toBeNull()
  })
  test('合計6の全配合に名前がある', () => {
    for (let cyanCount = 0; cyanCount <= 6; cyanCount++)
      for (let magentaCount = 0; cyanCount + magentaCount <= 6; magentaCount++) {
        const name = colorNameOf([cyanCount, magentaCount, 6 - cyanCount - magentaCount])
        expect(name).toBeTruthy()
        if (cyanCount && magentaCount && 6 - cyanCount - magentaCount)
          expect(MIXED).toContain(name!)
      }
  })
})

describe('ミッション', () => {
  test('分割された盤面には届かない', () => {
    const mission = MISSION_LIST[4]
    const field = buildField(mission.radius, mission.removed)
    const state = newState(field)
    applyDrop(field, state, '-1,0', 0)
    expect(field.cellList.some(cell => cell.q > 0)).toBe(true)
    for (const cell of field.cellList) if (cell.q > 0) expect(amountOf(state[cell.key])).toBe(0)
  })
  test('抜いたセルは広がりを遮る', () => {
    const mission = MISSION_LIST[3]
    const field = buildField(mission.radius, mission.removed)
    const state = newState(field)
    applyDrop(field, state, '-2,0', 0)
    expect(field.map.has('0,0') || field.map.has('1,0')).toBe(false)
    const openField = buildField(mission.radius)
    const openState = newState(openField)
    applyDrop(openField, openState, '-2,0', 0)
    expect(state['3,-1'][0]).toBeLessThan(openState['3,-1'][0])
  })
  test('スコア', () => {
    const state: State = { a: [3, 3, 0], b: [2, 0, 0], c: [6, 0, 0] }
    expect(scoreOf(state, 'Blue')).toEqual({ totalAmount: 14, hitCount: 1, each: [1] })
  })
  test('課題色が2色なら、両方そろうまでスコアは0', () => {
    const state: State = { a: [3, 3, 0], b: [3, 3, 0], c: [6, 0, 0] }
    const oneMade = scoreOf(state, ['Blue', 'Red'])
    expect([isCleared(oneMade), finalScoreOf(oneMade)]).toEqual([false, 0])
    const bothMade = scoreOf(state, ['Blue', 'Cyan'])
    expect([isCleared(bothMade), finalScoreOf(bothMade)]).toEqual([true, 3 * 18])
  })
  test.each(MISSION_LIST.map((mission, i) => [i + 1, mission] as const))(
    'ミッション%iは課題色が作れる',
    (_, mission) => {
      const field = buildField(mission.radius, mission.removed)
      const random = seededRandom(1)
      let isReached = false
      for (let trial = 0; trial < 60000 && !isReached; trial++) {
        const state = newState(field)
        let left = mission.moveCount
        while (left > 0 && !isFull(state)) {
          const cell = field.cellList[(random() * field.cellList.length) | 0]
          if (!canDrop(state, cell.key)) continue
          applyDrop(
            field,
            state,
            cell.key,
            mission.inkList[(random() * mission.inkList.length) | 0]
          )
          left--
        }
        isReached = isCleared(scoreOf(state, mission.targetColor))
      }
      expect(isReached).toBe(true)
    },
    60000
  )
})
