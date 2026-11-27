// プレイ1回分の進行の状態と、そこから描画に使う値を作る関数。React と演出に依存しない
import {
  buildField,
  cloneState,
  INK_LIST,
  MAX,
  newState,
  amountOf,
  type Field,
  type State,
  type TargetColor,
} from '@/game/core'
import { ATELIER_RADIUS, MISSION_LIST, type Mission } from '@/game/missionList'
import type { DropList } from '@/game/storage'
import type { DropletState } from '@/components/MoveRow'

// 点数表の行の並び（6点から1点）
export const POINT_LIST = [6, 5, 4, 3, 2, 1]

export interface Game {
  kind: 'mission' | 'atelier'
  index: number
  mission: Mission | null
  targetColor: TargetColor | null
  field: Field
  state: State
  inkList: number[]
  ink: number
  isBusy: boolean
  isDone: boolean
  pulse: Map<string, number>
  // ミッション
  used: number[]
  moveCountLeft: number
  dropList: DropList
  madeTally: Record<string, number>
  previousNameList: Record<string, string | null>
  unspawned: Set<string> | null
  despawned: Set<string> | null
  isReplaying: boolean
  replayQueue: DropList
  isRevealed: boolean
  isCleared: boolean
  targetColorCountTo: number
  // アトリエ
  stateHistory: State[]
  inkHistory: (number | null)[]
  historyIndex: number
  pending: number | null
}

export function newGame(kind: 'mission' | 'atelier', index: number, isRespawning: boolean): Game {
  const mission = kind === 'mission' ? MISSION_LIST[index] : null
  const field = mission ? buildField(mission.radius, mission.removed) : buildField(ATELIER_RADIUS)
  const state = newState(field)
  const inkList = mission ? mission.inkList : INK_LIST.map((_, i) => i)
  return {
    kind,
    index,
    mission,
    targetColor: mission ? mission.targetColor : null,
    field,
    state,
    inkList,
    ink: inkList[0],
    isBusy: false,
    isDone: false,
    pulse: new Map(),
    used: [],
    moveCountLeft: mission ? mission.moveCount : 0,
    dropList: [],
    madeTally: {},
    previousNameList: {},
    unspawned: isRespawning ? new Set(field.cellList.map(cell => cell.key)) : null,
    despawned: null,
    isReplaying: false,
    replayQueue: [],
    isRevealed: false,
    isCleared: false,
    targetColorCountTo: -1,
    stateHistory: [cloneState(state)],
    inkHistory: [null],
    historyIndex: 0,
    pending: null,
  }
}

// 消えたセルを除いた盤面
export function liveStateOf(state: State, despawned: Set<string> | null): State {
  const live: State = {}
  for (const key in state) if (!despawned?.has(key)) live[key] = state[key]
  return live
}

// 点数ごとのセル数。消えたセルは数えない
export function countListOf(state: State, despawned: Set<string> | null) {
  const countList: Record<number, number> = {}
  for (let point = 1; point <= MAX; point++) countList[point] = 0
  for (const key in state) {
    if (despawned?.has(key)) continue
    const amount = amountOf(state[key])
    if (amount) countList[amount]++
  }
  return countList
}

function moveStateListOf(game: Game): DropletState[] {
  if (game.kind === 'atelier')
    return game.inkHistory
      .slice(1, game.historyIndex + 1)
      .concat(game.pending != null ? [game.pending] : [])
      .map(ink => ({ color: INK_LIST[ink!].rgb, isCurrent: false }))
      .concat([{ color: INK_LIST[game.ink].rgb, isCurrent: true }])
  return Array.from({ length: game.mission!.moveCount }, (_, i) =>
    i < game.used.length
      ? { color: INK_LIST[game.used[i]].rgb, isCurrent: false }
      : i === game.used.length && !game.isDone
        ? { color: INK_LIST[game.ink].rgb, isCurrent: true }
        : { color: null, isCurrent: false }
  )
}

// 描画に使う値
export function viewOf(game: Game) {
  return {
    state: cloneState(game.state),
    despawned: game.despawned ? new Set(game.despawned) : null,
    inkList: game.inkList,
    ink: game.ink,
    isDone: game.isDone,
    isBusy: game.isBusy,
    historyIndex: game.historyIndex,
    historyLength: game.stateHistory.length,
    moveCountLeft: game.moveCountLeft,
    moveStateList: moveStateListOf(game),
  }
}
