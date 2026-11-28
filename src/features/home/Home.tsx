// ホーム。傾いた盤面が流れ、ところどころタイルが抜け落ちる。抜け落ちると、別の欠けにタイルが戻るのを交互に行う
import { useEffect, useLayoutEffect, useRef } from 'react'
import { useSetAtom } from 'jotai'
import { gsap } from 'gsap'
import { backAtom, routeAtom, type Route } from '@/state/atoms'
import { despawnTile, hasTileAt, spawnTile, visibleKeyList } from '@/lib/board/engine'
import { hasFall } from '@/lib/board/fall'
import { EMPTY, type Scene } from '@/lib/board/scene'
import { homeCamera, homeFlowOffset, worldPosition } from '@/lib/board/geometry'
import { kick } from '@/lib/board/redraw'
import { rgbToken } from '@/utils/colorToken'
import { usePhase, useScene } from '@/hooks/screenContext'
import { HexButton } from '@/components/HexButton'
import styles from './Home.module.scss'

// 最初から抜けているタイルの割合
const HOLE_RATE = 0.12
// タイルが抜け落ちる・戻る間隔（交互に行う）
const HOLE_INTERVAL_MS = 1200

const MENU_LIST: { label: string; route: Route }[] = [
  { label: 'Mission', route: { name: 'missionList' } },
  { label: 'Atelier', route: { name: 'atelier' } },
  { label: 'Collection', route: { name: 'collection' } },
]

export function Home() {
  const phase = usePhase()
  const setRoute = useSetAtom(routeAtom)
  const setBack = useSetAtom(backAtom)
  useLayoutEffect(() => setBack(null), [setBack])
  // 抜け落ち・戻りの予約。GSAP の時間で数えるので、タブが裏にあるあいだは進まず、戻ったときにたまって一斉に落ちない
  const timerRef = useRef<gsap.core.Tween | null>(null)
  const startTimerRef = useRef<() => void>(() => {})

  useScene(
    () => {
      const holeList = new Map<string, boolean>()
      // 盤面にすでにあるタイルは引き継ぎ、それ以外の座標をところどころ欠けさせる
      const has = (q: number, r: number) => {
        const key = q + ',' + r
        if (!holeList.has(key)) holeList.set(key, !hasTileAt(q, r) && Math.random() < HOLE_RATE)
        return !holeList.get(key)
      }
      let startedAt = 0
      let offset = 0
      const scene: Scene = {
        isHome: true,
        camera: homeCamera(),
        focus: [0, 0],
        cell: (q, r) => (has(q, r) ? { alpha: 1, color: rgbToken('--bg-cell'), stroke: 0 } : EMPTY),
        colored: () => false,
        tick(now) {
          if (!startedAt) startedAt = now
          offset = homeFlowOffset(now - startedAt)
          scene.camera = homeCamera(offset)
          return true
        },
        layout() {
          scene.camera = homeCamera(offset)
        },
      }
      // 抜け落ちると戻るを交互に行う。同時に起こすと目まぐるしい
      let isSpawnTurn = false
      const changeOne = () => {
        const tileList = visibleKeyList(scene.camera)
        // まだ穴かどうか決めていないタイルを決めておく
        tileList.forEach(([q, r]) => has(q, r))
        const keyList = tileList.map(([q, r]) => q + ',' + r)
        if (holeList.size > keyList.length * 8) {
          const visible = new Set(visibleKeyList(scene.camera, true).map(([q, r]) => q + ',' + r))
          for (const key of holeList.keys()) if (!visible.has(key)) holeList.delete(key)
        }
        const isSpawn = isSpawnTurn
        isSpawnTurn = !isSpawnTurn
        if (isSpawn) {
          // 映っている欠けを1つ選び、タイルを戻す（浮いた位置から降りてくる）。欠けの数が増え続けないようにする。
          // 落ちている途中の座標は選ばない（選ぶと、新しいタイルではなく落ちているタイルが戻る）
          const holeKeyList = keyList.filter(key => holeList.get(key) && !hasFall(key))
          if (!holeKeyList.length) return
          const spawnKey = holeKeyList[(Math.random() * holeKeyList.length) | 0]
          holeList.set(spawnKey, false)
          spawnTile(spawnKey)
          return
        }
        const presentList = keyList.filter(key => !holeList.get(key))
        if (!presentList.length) return
        const despawnKey = presentList[(Math.random() * presentList.length) | 0]
        holeList.set(despawnKey, true)
        const [q, r] = despawnKey.split(',').map(Number)
        const [worldX, worldY] = worldPosition(q, r)
        despawnTile(
          despawnKey,
          worldX * scene.camera.scale + scene.camera.offsetX,
          worldY * scene.camera.scale + scene.camera.offsetY
        )
        kick()
      }
      startTimerRef.current = () => {
        timerRef.current?.kill()
        const next = () => {
          timerRef.current = gsap.delayedCall(HOLE_INTERVAL_MS / 1000, () => {
            changeOne()
            next()
          })
        }
        next()
      }
      return scene
    },
    () => startTimerRef.current()
  )

  useEffect(() => {
    if (phase === 'leaving') timerRef.current?.kill()
  }, [phase])
  useEffect(() => () => void timerRef.current?.kill(), [])

  return (
    <section className={styles.home} data-phase={phase}>
      <h1 className={styles.title}>INK on HEX</h1>
      <nav className={styles.menu}>
        {MENU_LIST.map(({ label, route }) => (
          <HexButton key={label} label={label} onClick={() => setRoute(route)} />
        ))}
      </nav>
    </section>
  )
}
