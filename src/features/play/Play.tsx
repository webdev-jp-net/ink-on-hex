// プレイ画面（ミッションとアトリエ）。インクを選び、セルに垂らす。ゲームの進行を受け持つ
import { useLayoutEffect, useRef, useState } from 'react'
import { useSetAtom } from 'jotai'
import { gsap } from 'gsap'
import {
  applyRing,
  canDrop,
  cloneState,
  INK_LIST,
  finalScoreOf,
  isCleared,
  isFull,
  isTargetColor,
  colorNameOf,
  ringListOf,
  scoreOf,
  amountOf,
} from '@/game/core'
import { ATELIER_RADIUS, MISSION_LIST } from '@/game/missionList'
import { colorRGB, rgb } from '@/game/color'
import { bestOf, commitMade, saveBest } from '@/game/storage'
import { currentScene, despawnTile, enter, pick } from '@/lib/board/engine'
import { worldPosition } from '@/lib/board/geometry'
import { kick } from '@/lib/board/redraw'
import { startSweep } from '@/lib/board/sweep'
import { missionColumnCount, missionOffset } from '@/lib/missionLayout'
import { rgbToken } from '@/utils/colorToken'
import { milliseconds } from '@/utils/motionToken'
import { POP } from '@/utils/pop'
import { backAtom } from '@/state/atoms'
import { InkButton } from '@/components/InkButton'
import { IconButton } from '@/components/IconButton'
import { MoveRow } from '@/components/MoveRow'
import { usePhase, useScene } from '@/hooks/screenContext'
import { FootActionList } from './FootActionList'
import { ScorePanel } from './ScorePanel'
import { countListOf, liveStateOf, newGame, viewOf, type Game } from './game'
import { followSpawn } from './motion'
import { createPlayScene } from './playScene'
import type { ScorePanelHandle } from './useScorePanel'
import { useTimerList } from './useTimerList'
import styles from './Play.module.scss'

const SETTLE_WAIT_MS = 200
const RETRY_WAIT_MS = 1000
const RETRY_SPREAD_MS = 500
const REPLAY_GAP_MS = 300

export function Play({
  kind,
  missionIndex = 0,
}: {
  kind: 'mission' | 'atelier'
  missionIndex?: number
}) {
  const phase = usePhase()
  const setBack = useSetAtom(backAtom)
  useLayoutEffect(
    () => setBack({ to: { name: kind === 'mission' ? 'missionList' : 'home' } }),
    [setBack, kind]
  )
  const [initialGame] = useState(() => newGame(kind, missionIndex, false))
  const gameRef = useRef(initialGame)
  // 描画に使う写し。進行は gameRef で持ち、変わるたびに写しを作り直す
  const [view, setView] = useState(() => viewOf(initialGame))
  const rerender = () => setView(viewOf(gameRef.current))
  const [generation, setGeneration] = useState(0)
  const [isMoveIntro, setMoveIntro] = useState(true)
  const [isPlayIntro, setPlayIntro] = useState(false)
  const [foot, setFoot] = useState<'best' | 'retry' | 'none' | 'history'>(() =>
    kind === 'atelier' ? 'history' : bestOf(missionIndex) ? 'best' : 'none'
  )

  const fieldAreaRef = useRef<HTMLDivElement>(null)
  const fitRef = useRef<HTMLDivElement>(null)
  const paletteRef = useRef<HTMLDivElement>(null)
  const timer = useTimerList(phase)
  const panelRef = useRef<ScorePanelHandle>(null)

  const radius = kind === 'mission' ? MISSION_LIST[missionIndex].radius : ATELIER_RADIUS
  // 盤面を置く位置は開いたときに決め、場面とタップ判定とで同じ値を使う
  const [offset] = useState<[number, number]>(() =>
    kind === 'mission' ? missionOffset(missionIndex, missionColumnCount()) : [0, 0]
  )

  const buildScene = (target: Game) =>
    createPlayScene({ target, radius, offset, fieldAreaRef, fitRef })

  const onEnter = (target: Game) => {
    if (gameRef.current !== target) return
    if (target.unspawned)
      [...target.unspawned].forEach(key =>
        timer.later(Math.random() * RETRY_SPREAD_MS, () => {
          target.unspawned?.delete(key)
          kick()
        })
      )
    setPlayIntro(true)
    if (target.kind === 'mission') {
      panelRef.current?.playIntro(!!target.unspawned)
      if (paletteRef.current)
        gsap.to(paletteRef.current.querySelectorAll('svg'), {
          keyframes: [
            { opacity: 1, scale: POP.over, duration: POP.in, ease: 'power2.out' },
            { scale: 1, duration: POP.settle, ease: 'power2.out' },
          ],
        })
    }
  }

  // 開いた直後の状態。点数表はぼかしておき、インクのボタンは小さく消しておく
  useLayoutEffect(() => {
    if (kind !== 'mission') return
    if (paletteRef.current)
      gsap.set(paletteRef.current.querySelectorAll('svg'), {
        opacity: 0,
        scale: POP.from,
        transformOrigin: '50% 50%',
      })
    panelRef.current?.hideForIntro(!!gameRef.current.unspawned)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation])

  useScene(
    () => {
      const scene = buildScene(gameRef.current)
      if (kind === 'mission')
        requestAnimationFrame(() => {
          const hex = panelRef.current?.targetHex()
          if (hex) followSpawn(hex)
        })
      return scene
    },
    () => onEnter(gameRef.current)
  )

  // スコア領域を今の盤面に合わせる。CLEARと課題色のセル数は、変わったときだけ表示を動かす
  const syncScore = () => {
    const target = gameRef.current
    const panel = panelRef.current
    if (!target.targetColor || !panel) return
    const score = scoreOf(liveStateOf(target.state, target.despawned), target.targetColor)
    if (target.isRevealed && target.despawned)
      panel.showPointList(countListOf(target.state, target.despawned))
    const cleared = isCleared(score)
    if (cleared !== target.isCleared) {
      target.isCleared = cleared
      panel.showClear(cleared, !!target.despawned)
    }
    if (score.hitCount !== target.targetColorCountTo) {
      target.targetColorCountTo = score.hitCount
      panel.countTargetColor(score.hitCount)
    }
  }

  const paint = () => {
    kick()
    syncScore()
    rerender()
  }

  // 終了時の最終スコア。新しいベストなら、演出を始める時点で保存する
  const revealScore = () => {
    const target = gameRef.current
    target.isRevealed = true
    const finalScore = finalScoreOf(scoreOf(target.state, target.targetColor!))
    const best = bestOf(target.index)
    const isNewBest = !target.isReplaying && finalScore > 0 && finalScore > (best?.score ?? 0)
    if (isNewBest) saveBest(target.index, { score: finalScore, dropList: target.dropList.slice() })
    const timeline = panelRef.current?.showFinal(
      countListOf(target.state, null),
      finalScore,
      isNewBest
    )
    if (timeline) timer.track(timeline)
  }

  const settled = () => {
    const target = gameRef.current
    target.isBusy = false
    if (target.kind === 'atelier') {
      target.stateHistory.length = target.historyIndex + 1
      target.inkHistory.length = target.historyIndex + 1
      target.stateHistory.push(cloneState(target.state))
      target.inkHistory.push(target.pending)
      target.pending = null
      target.historyIndex++
      rerender()
      return
    }
    if (!target.isReplaying)
      for (const key in target.state) {
        const name = colorNameOf(target.state[key])
        if (name && name !== target.previousNameList[key])
          target.madeTally[name] = (target.madeTally[name] || 0) + 1
      }
    const over = target.moveCountLeft <= 0 || isFull(target.state)
    if (target.isReplaying && target.replayQueue.length && !over) {
      timer.later(REPLAY_GAP_MS, () => {
        if (gameRef.current === target) replayNext()
      })
      return
    }
    if (over) {
      target.isDone = true
      // クリアしたときだけ、作った色を記録する
      if (!target.isReplaying) {
        const result = scoreOf(target.state, target.targetColor!)
        if (isCleared(result)) commitMade(target.madeTally)
      }
      revealScore()
      setFoot('retry')
    }
    rerender()
  }

  const drop = (key: string, replayed = false) => {
    const target = gameRef.current
    if (target.isBusy || target.isDone) return
    if (target.isReplaying && !replayed) return
    if (!canDrop(target.state, key)) return
    const ringList = ringListOf(target.field, key)
    const ink = target.ink
    if (target.kind === 'mission') {
      target.previousNameList = {}
      for (const one in target.state) target.previousNameList[one] = colorNameOf(target.state[one])
      target.moveCountLeft--
      target.used.push(ink)
      target.dropList.push([key, ink])
      if (!target.isReplaying && target.used.length === 1) setFoot('none')
    } else target.pending = ink
    target.isBusy = true
    rerender()
    const ringMs = milliseconds('--duration-ring')
    ringList.forEach((ring, step) =>
      timer.later(step * ringMs, () => {
        if (gameRef.current !== target) return
        const beforeList = ring.map(one => target.state[one].slice())
        applyRing(target.state, ring, ink, step)
        const now = performance.now()
        let isHit = false
        ring.forEach((one, i) => {
          if (target.state[one].join() === beforeList[i].join()) return
          target.pulse.set(one, now)
          const name = colorNameOf(target.state[one])
          if (
            target.targetColor &&
            isTargetColor(name, target.targetColor) &&
            colorNameOf(beforeList[i]) !== name
          )
            isHit = true
        })
        if (isHit) startSweep()
        paint()
      })
    )
    timer.later(ringList.length * ringMs + SETTLE_WAIT_MS, () => {
      if (gameRef.current === target) settled()
    })
  }

  const replayNext = () => {
    const target = gameRef.current
    if (!target.isReplaying || !target.replayQueue.length) return
    const [key, ink] = target.replayQueue.shift()!
    if (!(key in target.state)) return
    target.ink = ink
    drop(key, true)
  }

  const showBest = () => {
    const target = gameRef.current
    if (target.isBusy || target.used.length) return
    const best = bestOf(target.index)
    if (!best) return
    target.isReplaying = true
    target.replayQueue = best.dropList.map(step => [step[0], step[1]])
    setFoot('retry')
    replayNext()
  }

  // やり直し。タイルを落としてから、空の盤面を下から出す
  const retry = () => {
    const target = gameRef.current
    const scene = currentScene()
    if (!scene || target.despawned) return
    // 垂らしている途中の続きと、再生の予約を止める
    timer.clear()
    const [offsetQ, offsetR] = offset
    target.despawned = new Set()
    target.isBusy = true
    panelRef.current?.leave()
    target.field.cellList.forEach(cell =>
      timer.later(Math.random() * RETRY_SPREAD_MS, () => {
        if (gameRef.current !== target) return
        const camera = scene.camera
        const [x, y] = worldPosition(cell.q + offsetQ, cell.r + offsetR)
        despawnTile(
          cell.q + offsetQ + ',' + (cell.r + offsetR),
          x * camera.scale + camera.offsetX,
          y * camera.scale + camera.offsetY,
          1,
          amountOf(target.state[cell.key])
            ? colorRGB(target.state[cell.key], rgbToken('--bg-cell'))
            : null
        )
        target.despawned!.add(cell.key)
        kick()
        syncScore()
      })
    )
    timer.later(RETRY_SPREAD_MS + RETRY_WAIT_MS, () => {
      if (gameRef.current !== target) return
      timer.clear()
      const next = newGame('mission', target.index, true)
      gameRef.current = next
      panelRef.current?.reset()
      setMoveIntro(true)
      setPlayIntro(false)
      setGeneration(generation => generation + 1)
      rerender()
      syncScore()
      setFoot(bestOf(next.index) ? 'best' : 'none')
      enter(buildScene(next)).then(() => onEnter(next))
    })
  }

  const stepHistory = (direction: number) => {
    const target = gameRef.current
    if (target.isBusy) return
    const next = target.historyIndex + direction
    if (next < 0 || next >= target.stateHistory.length) return
    target.historyIndex = next
    target.state = cloneState(target.stateHistory[next])
    paint()
  }

  const glint = () => !!gameRef.current.isCleared && !gameRef.current.despawned

  return (
    <section
      className={[styles.play, kind === 'mission' ? styles.mission : styles.atelier].join(' ')}
      data-phase={phase}
    >
      <div className={styles.bar} />
      <div className={styles.scorePanel}>
        {kind === 'mission' && (
          <ScorePanel
            ref={panelRef}
            targetColor={MISSION_LIST[missionIndex].targetColor}
            generation={generation}
            glint={glint}
            countList={countListOf(view.state, view.despawned)}
          />
        )}
      </div>
      <div ref={fieldAreaRef} className={styles.fieldArea}>
        <div
          ref={fitRef}
          className={styles.fit}
          onClick={event => {
            const [q, r] = pick(event.clientX, event.clientY)
            const key = q - offset[0] + ',' + (r - offset[1])
            if (key in gameRef.current.state) drop(key)
          }}
        />
      </div>
      <div className={styles.tray}>
        <div className={styles.moveRow}>
          <MoveRow
            key={generation}
            stateList={view.moveStateList}
            isIntro={isMoveIntro}
            isPlayIntro={isPlayIntro}
            onIntroDone={() => setMoveIntro(false)}
            label={
              kind === 'mission' && !isMoveIntro ? view.moveCountLeft + ' moves left' : undefined
            }
          />
        </div>
        <div ref={paletteRef} className={styles.palette} role="group" aria-label="Ink">
          {view.inkList.map(ink => (
            <InkButton
              key={ink}
              label={INK_LIST[ink].name}
              color={rgb(INK_LIST[ink].rgb)}
              isSelected={ink === view.ink}
              disabled={view.isDone}
              onClick={() => {
                gameRef.current.ink = ink
                rerender()
              }}
            />
          ))}
        </div>
      </div>
      <div className={styles.foot}>
        <span />
        <FootActionList actionKey={foot}>
          {foot === 'best' && <IconButton icon="trophy" label="Best score" onClick={showBest} />}
          {foot === 'retry' && <IconButton icon="retry" label="Retry" onClick={retry} />}
          {foot === 'history' && (
            <>
              <IconButton
                isCompact
                icon="undo"
                label="Undo"
                onClick={() => stepHistory(-1)}
                disabled={view.isBusy || view.historyIndex <= 0}
              />
              <IconButton
                isCompact
                icon="redo"
                label="Redo"
                onClick={() => stepHistory(1)}
                disabled={view.isBusy || view.historyIndex >= view.historyLength - 1}
              />
            </>
          )}
        </FootActionList>
      </div>
    </section>
  )
}
