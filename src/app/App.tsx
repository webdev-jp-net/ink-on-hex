// 画面の切り替え。前の画面を消しながら次の画面を出し、盤面の場面切り替えが終わったら前の画面を外す
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { mount, resize } from '@/lib/board/engine'
import { viewHeight } from '@/utils/viewport'
import { backAtom, routeAtom, type Route } from '@/state/atoms'
import { IconButton } from '@/components/IconButton'
import { Home } from '@/features/home/Home'
import { MissionList } from '@/features/missionList/MissionList'
import { Collection } from '@/features/collection/Collection'
import { Play } from '@/features/play/Play'
import { useLayoutKey } from './useLayoutKey'
import { ScreenContext, type Phase } from '@/hooks/screenContext'
import styles from './App.module.scss'

interface Shown {
  id: number
  route: Route
  phase: Phase
}

function ScreenOf({ route }: { route: Route }) {
  // 一覧は並びが変わったら作り直す
  const layoutKey = useLayoutKey(route.name === 'collection' ? 'collection' : 'missionList')
  switch (route.name) {
    case 'home':
      return <Home />
    case 'missionList':
      return <MissionList key={layoutKey} />
    case 'collection':
      return <Collection key={layoutKey} />
    case 'mission':
      return <Play kind="mission" missionIndex={route.index} />
    case 'atelier':
      return <Play kind="atelier" />
  }
}

function syncViewport() {
  document.documentElement.style.setProperty('--vh', viewHeight() + 'px')
}

export default function App() {
  const route = useAtomValue(routeAtom)
  const back = useAtomValue(backAtom)
  const setRoute = useSetAtom(routeAtom)
  const [shownList, setShownList] = useState<Shown[]>([{ id: 0, route, phase: 'idle' }])

  // 盤面の canvas。画面より先に用意する（兄弟の画面より前に置くので、画面の初期化より先に呼ばれる）
  // 画面の大きさの変化は、盤面を作ったときから追う
  const attachBoard = useCallback((canvas: HTMLCanvasElement) => {
    syncViewport()
    const unmount = mount(canvas)
    const onViewport = () => {
      syncViewport()
      resize()
    }
    addEventListener('resize', onViewport)
    window.visualViewport?.addEventListener('resize', onViewport)
    return () => {
      removeEventListener('resize', onViewport)
      window.visualViewport?.removeEventListener('resize', onViewport)
      unmount()
    }
  }, [])

  // 行き先が変わったら、今の画面を消しにかかり次の画面を出す
  const [lastRoute, setLastRoute] = useState(route)
  if (route !== lastRoute) {
    setLastRoute(route)
    const id = Math.max(...shownList.map(shown => shown.id)) + 1
    setShownList(list => [
      ...list
        .filter(shown => shown.phase !== 'leaving')
        .map(shown => ({ ...shown, phase: 'leaving' as const })),
      { id, route, phase: 'entering' },
    ])
  }

  const busy = shownList.some(shown => shown.phase !== 'idle')
  useEffect(() => {
    document.body.style.pointerEvents = busy ? 'none' : ''
  }, [busy])

  const contextList = useMemo(
    () =>
      shownList.map(shown => ({
        phase: shown.phase,
        entered: () =>
          setShownList(list =>
            list
              .filter(one => one.phase !== 'leaving')
              .map(one => (one.id === shown.id ? { ...one, phase: 'idle' as const } : one))
          ),
      })),
    [shownList]
  )

  return (
    <>
      <canvas ref={attachBoard} className={styles.board} aria-hidden="true" />
      {shownList.map((shown, i) => (
        <ScreenContext.Provider key={shown.id} value={contextList[i]}>
          <ScreenOf route={shown.route} />
        </ScreenContext.Provider>
      ))}
      <IconButton
        icon="back"
        label="Back"
        isHidden={!back}
        className={[styles.back, back ? '' : styles.off].join(' ')}
        onClick={() => back && setRoute(back.to)}
      />
    </>
  )
}
