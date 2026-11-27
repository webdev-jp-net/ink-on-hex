import { cellSet, hexDistance, type Removed, type TargetColor } from './core'

export const ATELIER_RADIUS = 6

export interface Mission {
  radius: number
  moveCount: number
  inkList: number[]
  targetColor: TargetColor
  removed?: Removed
}

export const MISSION_LIST: Mission[] = [
  { radius: 6, moveCount: 3, inkList: [0], targetColor: 'Cyan' },
  {
    radius: 6,
    moveCount: 3,
    inkList: [1],
    targetColor: 'Magenta',
    removed: cellSet(
      '-2,0;-2,1;-2,2;-1,-1;-1,0;-1,1;-1,2;0,-2;0,-1;0,0;0,1;0,2;1,-2;1,-1;1,0;1,1;2,-2;2,-1;2,0'
    ),
  },
  { radius: 6, moveCount: 3, inkList: [0, 1], targetColor: 'Blue' },
  {
    radius: 6,
    moveCount: 4,
    inkList: [1, 2],
    targetColor: 'Rose',
    removed: (q, r) => hexDistance(q, r) <= 1,
  },
  { radius: 6, moveCount: 4, inkList: [2, 0], targetColor: 'Spring Green', removed: q => q === 0 },
  { radius: 6, moveCount: 4, inkList: [0, 1, 2], targetColor: 'Black' },
  { radius: 6, moveCount: 3, inkList: [0, 1], targetColor: 'Cobalt' },
  {
    radius: 6,
    moveCount: 4,
    inkList: [0, 1],
    targetColor: 'Purple',
    removed: (q, r) => hexDistance(q, r) <= 3,
  },
  {
    radius: 6,
    moveCount: 4,
    inkList: [0, 2],
    targetColor: 'Green',
    removed: (q, r) =>
      !(hexDistance(q + 3, r - 1) <= 2 || hexDistance(q - 3, r + 2) <= 2 || (q === 0 && r === 0)),
  },
  {
    radius: 6,
    moveCount: 3,
    inkList: [2],
    targetColor: 'Yellow',
    removed: (q, r) => !((q <= 3 && r <= 3 && -q - r <= 3) || (q >= -3 && r >= -3 && -q - r >= -3)),
  },
  { radius: 6, moveCount: 5, inkList: [0, 1, 2], targetColor: 'Dark Cobalt' },
  {
    radius: 6,
    moveCount: 4,
    inkList: [0, 1],
    targetColor: ['Azure', 'Violet'],
    removed: (q, r) => !(hexDistance(q + 3, r + 1) <= 3 || hexDistance(q - 3, r - 1) <= 3),
  },
]
