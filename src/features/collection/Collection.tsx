// コレクション。色名ごとに盤面のヘックスとレシピを並べる。見えなくなった行のタイルは落ち、見えてきた行は現れる
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useSetAtom } from 'jotai'
import { gsap } from 'gsap'
import { MIXED, ROOT3 } from '@/game/core'
import { COLOR_NAME_ORDER_LIST, COLOR_NAME_RGB } from '@/game/color'
import { rgbToken } from '@/utils/colorToken'
import { collection, madeCount } from '@/game/storage'
import { boxOf, cameraOn, HOME_TILE, HOME_TILE_GAP, worldPosition } from '@/lib/board/geometry'
import { despawnTile } from '@/lib/board/engine'
import { EMPTY, type Scene } from '@/lib/board/scene'
import { FADE_FROM, FADE_TO } from '@/lib/board/fall'
import { isWide } from '@/utils/viewport'
import { kick } from '@/lib/board/redraw'
import { ease } from '@/utils/motionToken'
import { backAtom } from '@/state/atoms'
import { Times } from '@/components/Times'
import { ListScreen } from '@/components/ListScreen'
import { Recipe } from '@/components/Recipe'
import { useScene } from '@/hooks/screenContext'
import { LIST_WIDTH } from '@/lib/missionLayout'
import {
  CHIP_HEIGHT,
  COLUMN_Q,
  COLUMN_WIDTH,
  collectionColumnCount,
  HEX_RADIUS,
  PITCH,
  SCALE,
  TILE_RATIO,
} from './layout'
import { POP, popIn } from '@/utils/pop'
import styles from './Collection.module.scss'

const OUT_BLUR = 8
const DOT_GONE = 0.5
const DOT_STEP = 0.1
const DOT_PAIR = 2

export function Collection() {
  const setBack = useSetAtom(backAtom)
  useLayoutEffect(() => setBack({ to: { name: 'home' } }), [setBack])
  const slotRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const rowListRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<Scene | null>(null)
  const hasEnteredRef = useRef(false)

  const plan = useMemo(() => {
    const scale = SCALE
    const tileRatio = TILE_RATIO
    const hexRadius = HEX_RADIUS
    const rowHeight = 1.5 * PITCH
    const columnWidth = COLUMN_WIDTH
    const columnCount = collectionColumnCount()
    const rowCount = Math.ceil(COLOR_NAME_ORDER_LIST.length / columnCount)
    // 画面の中ほどの行を、ホームの盤面と同じ並びに合わせる
    const anchor = Math.min(
      rowCount - 1,
      Math.max(0, Math.round((innerHeight / 2 - 96) / rowHeight))
    )
    const middle = Math.round(1.5 * anchor)
    const homeScale = (HOME_TILE + HOME_TILE_GAP) / ROOT3
    const qShift =
      2 *
      Math.round(
        ((isWide() ? LIST_WIDTH : 0) + 24 + hexRadius - innerWidth / 2) / (1.5 * homeScale) / 2
      )
    const cellOf = (i: number): [number, number] => {
      const row = Math.floor(i / columnCount)
      const column = i % columnCount
      const q = row % 2
      return [
        q + column * COLUMN_Q + qShift,
        1.5 * row - q / 2 - middle - qShift / 2 - (column * COLUMN_Q) / 2,
      ]
    }
    const rowList = COLOR_NAME_ORDER_LIST.map((name, i) => {
      const isKnown = !MIXED.includes(name) || collection.has(name)
      const cell = cellOf(i)
      return {
        name,
        isKnown,
        key: cell.join(','),
        cell,
        paddingLeft:
          (cell[0] - qShift - (i % columnCount) * COLUMN_Q) * 1.5 * scale + 2 * hexRadius + 16,
      }
    })
    return {
      scale,
      tileRatio,
      rowHeight,
      columnWidth,
      columnCount,
      anchor: cellOf(anchor),
      box: boxOf(rowList.map(row => row.cell)),
      rowList,
      slotWidth: (columnCount - 1) * columnWidth + 2 * hexRadius + 1.5 * scale,
      slotHeight: (rowCount - 1) * rowHeight + CHIP_HEIGHT,
    }
  }, [])

  // 行ごとの見え方。毎フレームの判定に使うので ref で持つ
  const rowState = useRef(plan.rowList.map(row => ({ ...row, isVisible: false, isHidden: false })))

  const elementOf = (i: number) => {
    const row = rowListRef.current!.children[i] as HTMLElement
    return {
      row,
      wordList: [...row.querySelectorAll('[data-word]')],
      dotList: [...row.querySelectorAll('[data-recipe] svg')],
    }
  }

  const edgeList = (): [number, number] => {
    const bounds = bodyRef.current!.getBoundingClientRect()
    if (isWide()) return [bounds.top, bounds.bottom]
    const view = bodyRef.current!.parentElement!
    return [
      view.firstElementChild!.getBoundingClientRect().bottom,
      view.lastElementChild!.getBoundingClientRect().top,
    ]
  }
  const clearOf = (row: HTMLElement, [top, bottom]: [number, number]) => {
    const bounds = row.getBoundingClientRect()
    return bounds.top >= top && bounds.bottom <= bottom
  }

  const update = () => {
    if (!hasEnteredRef.current || !rowListRef.current) return
    const bound = edgeList()
    rowState.current.forEach((state, i) => {
      const { row, wordList, dotList } = elementOf(i)
      const clear = clearOf(row, bound)
      if (!state.isVisible && clear) {
        state.isVisible = true
        state.isHidden = false
        gsap.to(wordList, {
          opacity: 1,
          filter: 'blur(0px)',
          duration: POP.out(),
          ease,
          overwrite: true,
        })
        popIn(dotList)
        kick()
      } else if (state.isVisible && !clear) {
        state.isVisible = false
        state.isHidden = true
        const scene = sceneRef.current!
        const [x, y] = worldPosition(...state.cell)
        despawnTile(
          state.key,
          x * scene.camera.scale + scene.camera.offsetX,
          y * scene.camera.scale + scene.camera.offsetY,
          1,
          state.isKnown ? COLOR_NAME_RGB[state.name] : null
        )
        gsap
          .timeline()
          .to(wordList, {
            filter: 'blur(' + OUT_BLUR + 'px)',
            duration: FADE_TO,
            ease: 'none',
            overwrite: true,
          })
          .to(wordList, { opacity: 0, duration: FADE_TO - FADE_FROM, ease: 'none' }, FADE_FROM)
        const order = dotList
          .map(dot => [Math.random(), dot] as const)
          .sort((left, right) => left[0] - right[0])
          .map(pair => pair[1])
        const groupCount = Math.ceil(order.length / DOT_PAIR)
        const duration = DOT_GONE - (groupCount - 1) * DOT_STEP
        order.forEach((dot, index) =>
          gsap.to(dot, {
            opacity: 0,
            duration,
            delay: Math.floor(index / DOT_PAIR) * DOT_STEP,
            ease: 'none',
            overwrite: true,
          })
        )
        kick()
      }
    })
  }

  const layout = () => {
    const scene = sceneRef.current
    if (!scene || !slotRef.current || !bodyRef.current) return
    scene.camera = cameraOn(slotRef.current, plan.box, plan.scale, plan.tileRatio)
    const bounds = bodyRef.current.getBoundingClientRect()
    scene.clipTop = bounds.top
    scene.clipBottom = bounds.bottom
    update()
  }

  useScene(
    () => {
      // 行の位置を先にまとめて読み、スタイルの書き込みは後でまとめる。
      // 読み書きを行ごとに交互にすると、そのたびにスタイルとレイアウトの計算がやり直しになり、開くときの処理が1フレームに収まらない
      const bound = edgeList()
      const elementList = rowState.current.map((_, i) => elementOf(i))
      rowState.current.forEach((state, i) => {
        state.isVisible = clearOf(elementList[i].row, bound)
        state.isHidden = !state.isVisible
      })
      const camera = cameraOn(slotRef.current!, plan.box, plan.scale, plan.tileRatio)
      const bounds = bodyRef.current!.getBoundingClientRect()
      // 点は popIn が縮めた状態から出すので、ここでは隠すだけにする（変形を読む処理は重いので、出すときに回す）
      gsap.set(
        elementList.flatMap(element => element.dotList),
        { opacity: 0 }
      )
      gsap.set(
        elementList.flatMap(element => element.wordList),
        { filter: 'blur(0px)' }
      )
      const hiddenWordList = elementList
        .filter((_, i) => rowState.current[i].isHidden)
        .flatMap(element => element.wordList)
      if (hiddenWordList.length)
        gsap.set(hiddenWordList, { opacity: 0, filter: 'blur(' + OUT_BLUR + 'px)' })
      const byKey = new Map(rowState.current.map(state => [state.key, state]))
      const scene: Scene = {
        camera,
        focus: plan.anchor,
        cell(q, r) {
          const state = byKey.get(q + ',' + r)
          if (!state || state.isHidden) return EMPTY
          return {
            alpha: 1,
            color: state.isKnown ? COLOR_NAME_RGB[state.name] : rgbToken('--bg-cell'),
            stroke: 0,
          }
        },
        // 1色の行（Cyan・Magenta・Yellow）は常に色が付いている
        colored: () => true,
        layout,
      }
      sceneRef.current = scene
      scene.clipTop = bounds.top
      scene.clipBottom = bounds.bottom
      return scene
    },
    () => {
      hasEnteredRef.current = true
      rowState.current.forEach((state, i) => {
        if (state.isVisible) popIn(elementOf(i).dotList)
      })
      update()
    }
  )

  return (
    <ListScreen
      title="Collection"
      scrollClassName={styles.scroll}
      bodyRef={bodyRef}
      onMove={layout}
    >
      <div className={styles.collection}>
        <div
          ref={slotRef}
          className={styles.slot}
          style={{
            width: plan.slotWidth.toFixed(1) + 'px',
            height: plan.slotHeight.toFixed(1) + 'px',
          }}
        />
        <div
          ref={rowListRef}
          className={styles.rowList}
          style={{
            marginTop: CHIP_HEIGHT / 2 - plan.rowHeight / 2 + 'px',
            ...(plan.columnCount > 1
              ? {
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(' +
                    (plan.columnCount - 1) +
                    ',' +
                    plan.columnWidth.toFixed(1) +
                    'px) 1fr',
                }
              : {}),
          }}
        >
          {plan.rowList.map(row => (
            <div
              key={row.name}
              className={[styles.row, row.isKnown ? '' : styles.none].join(' ')}
              style={{
                height: plan.rowHeight + 'px',
                paddingLeft: row.paddingLeft.toFixed(1) + 'px',
              }}
            >
              <div className={styles.text}>
                <div className={styles.word} data-word>
                  <span className={styles.name}>{row.isKnown ? row.name : '?'}</span>
                </div>
                <span data-recipe className={styles.recipeSlot}>
                  <Recipe name={row.isKnown ? row.name : null} />
                </span>
                <div className={styles.word} data-word>
                  <Times className={styles.times} label={(madeCount[row.name] || 0) + ' made'}>
                    <span>{madeCount[row.name] || 0}</span>
                  </Times>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ListScreen>
  )
}
