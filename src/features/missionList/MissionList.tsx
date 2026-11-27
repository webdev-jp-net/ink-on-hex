// ミッション一覧。盤面の形のサムネイルを並べ、下に課題色と手数を出す
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { buildField, targetColorListOf, ROOT3 } from '@/game/core'
import { MISSION_LIST } from '@/game/missionList'
import { boxOf, cameraOn, worldPosition } from '@/lib/board/geometry'
import { EMPTY, type Scene } from '@/lib/board/scene'
import { pick } from '@/lib/board/engine'
import { rgbToken } from '@/utils/colorToken'
import { backAtom, missionListScrollAtom, routeAtom } from '@/state/atoms'
import { Times } from '@/components/Times'
import { DropletIcon } from '@/components/Icon'
import { TargetSwatch } from '@/components/Swatch'
import { ListScreen } from '@/components/ListScreen'
import { useScene } from '@/hooks/screenContext'
import {
  fullCellList,
  missionColumnCount,
  missionOffset,
  THUMBNAIL_LABEL,
  THUMBNAIL_TILE_RATIO,
  thumbnailScale,
  thumbnailUnit,
} from '@/lib/missionLayout'
import styles from './MissionList.module.scss'

export function MissionList() {
  const setRoute = useSetAtom(routeAtom)
  const setBack = useSetAtom(backAtom)
  const [scrollY, setScrollY] = useAtom(missionListScrollAtom)
  const listRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const scrollYRef = useRef(scrollY)
  const sceneRef = useRef<Scene | null>(null)
  const [initialY] = useState(scrollY)
  useLayoutEffect(() => setBack({ to: { name: 'home' } }), [setBack])

  const plan = useMemo(() => {
    const columnCount = missionColumnCount()
    const scale = thumbnailScale(columnCount)
    const cellHeight = THUMBNAIL_TILE_RATIO * scale * ROOT3
    const owner = new Map<string, number>()
    const all: [number, number][] = []
    const bottomList: number[] = []
    MISSION_LIST.forEach((mission, i) => {
      const [offsetQ, offsetR] = missionOffset(i, columnCount)
      let bottom = -1e9
      for (const [q, r] of fullCellList(mission.radius)) {
        bottom = Math.max(bottom, worldPosition(q + offsetQ, r + offsetR)[1])
        all.push([q + offsetQ, r + offsetR])
      }
      bottomList.push(bottom)
      for (const cell of buildField(mission.radius, mission.removed).cellList)
        owner.set(cell.q + offsetQ + ',' + (cell.r + offsetR), i)
    })
    const box = boxOf(all)
    const hexRadius = THUMBNAIL_TILE_RATIO * scale
    const labelList = MISSION_LIST.map((_, i) => {
      const [x] = worldPosition(...missionOffset(i, columnCount))
      return {
        left: (x - box.minX) * scale + hexRadius,
        top: (bottomList[i] - box.minY) * scale + cellHeight + 16,
      }
    })
    return {
      scale,
      owner,
      box,
      labelList,
      width: (box.maxX - box.minX) * scale + 2 * hexRadius,
      height: (box.maxY - box.minY) * scale + cellHeight + 16 + THUMBNAIL_LABEL,
      marginLeft: thumbnailUnit().gap * scale - 24,
    }
  }, [])

  const open = (index: number) => {
    setScrollY(scrollYRef.current)
    setRoute({ name: 'mission', index })
  }

  const layout = () => {
    const scene = sceneRef.current
    if (!scene || !listRef.current || !bodyRef.current) return
    scene.camera = cameraOn(listRef.current, plan.box, plan.scale, THUMBNAIL_TILE_RATIO)
    const bounds = bodyRef.current.getBoundingClientRect()
    scene.clipTop = bounds.top
    scene.clipBottom = bounds.bottom
  }

  useScene(() => {
    const scene: Scene = {
      camera: cameraOn(listRef.current!, plan.box, plan.scale, THUMBNAIL_TILE_RATIO),
      focus: [0, 0],
      cell: (q, r) =>
        plan.owner.has(q + ',' + r) ? { alpha: 1, color: rgbToken('--bg-cell'), stroke: 0 } : EMPTY,
      colored: () => false,
      layout,
    }
    sceneRef.current = scene
    layout()
    return scene
  })

  return (
    <ListScreen
      title="Mission"
      bodyRef={bodyRef}
      initialY={initialY}
      onMove={y => {
        scrollYRef.current = y
        layout()
      }}
    >
      <div
        ref={listRef}
        className={styles.list}
        // 盤面（canvas）の座標に合わせて置くので、書字方向で反転させない
        style={{
          width: plan.width.toFixed(1) + 'px',
          height: plan.height + 'px',
          marginLeft: plan.marginLeft.toFixed(1) + 'px',
        }}
        onClick={event => {
          const [q, r] = pick(event.clientX, event.clientY)
          const index = plan.owner.get(q + ',' + r)
          if (index !== undefined) open(index)
        }}
      >
        {MISSION_LIST.map((mission, i) => (
          <button
            key={i}
            type="button"
            className={styles.mission}
            style={{
              left: plan.labelList[i].left.toFixed(1) + 'px',
              top: plan.labelList[i].top.toFixed(1) + 'px',
            }}
            aria-label={
              'Mission ' +
              (i + 1) +
              ', target color ' +
              targetColorListOf(mission.targetColor).join(' and ') +
              ', ' +
              mission.moveCount +
              ' moves'
            }
            onClick={event => {
              event.stopPropagation()
              open(i)
            }}
          >
            <span className={styles.targetColor}>
              <TargetSwatch targetColor={mission.targetColor} />
            </span>
            <span className={styles.moveCount} aria-label={mission.moveCount + ' moves'}>
              <DropletIcon className={styles.droplet} />
              <Times>
                <span>{mission.moveCount}</span>
              </Times>
            </span>
          </button>
        ))}
      </div>
    </ListScreen>
  )
}
