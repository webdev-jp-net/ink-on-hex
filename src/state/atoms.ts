import { atom } from 'jotai'

export type Route =
  | { name: 'home' }
  | { name: 'missionList' }
  | { name: 'collection' }
  | { name: 'mission'; index: number }
  | { name: 'atelier' }

export const routeAtom = atom<Route>({ name: 'home' })

// 戻るボタンの行き先。null のときは隠す
export const backAtom = atom<{ to: Route } | null>(null)

// ミッション一覧のスクロール位置。ミッションから戻ったときに復元する
export const missionListScrollAtom = atom(0)
