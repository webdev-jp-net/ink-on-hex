// ステージメーカー（企画用）。盤面の形・インク・手数・課題色を決め、試し、ランダム試行で難しさを見て、ミッション定義を書き出す
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  applyDrop,
  buildField,
  canDrop,
  cloneState,
  INK_LIST,
  finalScoreOf,
  isCleared,
  isFull,
  colorNameOf,
  newState,
  scoreOf,
  targetColorListOf,
  type Field,
  type Mix,
  type State,
  ROOT3,
} from '@/game/core'
import { MISSION_LIST } from '@/game/missionList'
import { colorRGB, COLOR_NAME_ORDER_LIST, rgb } from '@/game/color'
import { rgbToken } from '@/utils/colorToken'
import { TargetColorSelect } from './TargetColorSelect'
import styles from './Maker.module.scss'

const RADIUS = 6
const STORE = 'inkOnHex.maker'
const TRIAL_COUNT = 20000
const TRIAL_CHUNK = 1000
const MOVE_MAX = 12

const ALL_CELL_LIST = buildField(RADIUS).cellList
const ALL_KEY_LIST = ALL_CELL_LIST.map(cell => cell.key)

interface Stage {
  keepList: string[]
  inkList: number[]
  moveCount: number
  targetColorList: [string, string]
}

interface Game {
  field: Field
  state: State
  history: { state: State; ink: number }[]
  left: number
}

// 課題色を、選んだインクで作れるものに揃える。2つ目は1つ目と同じ色にしない
function fitTargetColor(stage: Stage): Stage {
  const optionList = COLOR_NAME_ORDER_LIST.filter(name => reachable(name, stage.inkList))
  const [first, second] = stage.targetColorList
  const fitFirst = optionList.includes(first) ? first : optionList[0]
  return {
    ...stage,
    targetColorList: [
      fitFirst,
      second && second !== fitFirst && optionList.includes(second) ? second : '',
    ],
  }
}

function loadStage(): Stage {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null')
    if (saved) {
      const initial = initialStage()
      return fitTargetColor({
        keepList: Array.isArray(saved.keepList) ? saved.keepList : initial.keepList,
        inkList: saved.inkList ?? saved.dyeList ?? initial.inkList,
        moveCount: Number.isInteger(saved.moveCount) ? saved.moveCount : initial.moveCount,
        targetColorList:
          saved.targetColorList ?? saved.taskList ?? saved.targetList ?? initial.targetColorList,
      })
    }
  } catch {
    // 読めなければ初期値
  }
  return initialStage()
}

function initialStage(): Stage {
  return { keepList: ALL_KEY_LIST, inkList: [0, 1], moveCount: 4, targetColorList: ['Azure', ''] }
}

const hexPoint = (x: number, y: number, size: number) =>
  [0, 1, 2, 3, 4, 5]
    .map(
      corner =>
        (x + size * Math.cos((Math.PI / 3) * corner)).toFixed(3) +
        ',' +
        (y + size * Math.sin((Math.PI / 3) * corner)).toFixed(3)
    )
    .join(' ')

// 選んだインクだけで作れる色かどうか
function reachable(name: string, inkList: number[]) {
  for (let cyan = 0; cyan <= 6; cyan++)
    for (let magenta = 0; cyan + magenta <= 6; magenta++)
      for (let yellow = 0; cyan + magenta + yellow <= 6; yellow++) {
        const mix: Mix = [cyan, magenta, yellow]
        if (!cyan && !magenta && !yellow) continue
        if (mix.some((x, i) => x && !inkList.includes(i))) continue
        if (colorNameOf(mix) === name) return true
      }
  return false
}

function evaluate(state: State, nameList: string[]) {
  const score = scoreOf(state, nameList)
  return {
    each: score.each,
    totalAmount: score.totalAmount,
    clear: isCleared(score),
    hitCount: score.hitCount,
    final: finalScoreOf(score),
  }
}

export function Maker() {
  const [stage, setStage] = useState<Stage>(loadStage)
  const [mode, setMode] = useState<'edit' | 'play'>('edit')
  const [playInk, setPlayInk] = useState(stage.inkList[0])
  const [game, setGame] = useState<Game | null>(null)
  const [simulation, setSimulation] = useState<
    string | { rate: number; best: number; average: number }
  >('')
  const [copied, setCopied] = useState('')
  const painting = useRef<boolean | null>(null)
  // 続けて押したときは前の試行を打ち切る
  const simulationRun = useRef(0)
  const keep = useMemo(() => new Set(stage.keepList), [stage.keepList])
  const nameList = stage.targetColorList.filter(Boolean)
  const targetColorHeadingId = useId()
  const optionList = useMemo(
    () => COLOR_NAME_ORDER_LIST.filter(name => reachable(name, stage.inkList)),
    [stage.inkList]
  )

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(stage))
    } catch {
      // 保存できない環境では残さない
    }
  }, [stage])

  const makeField = (keepSet = keep) => buildField(RADIUS, (q, r) => !keepSet.has(q + ',' + r))
  const newGame = (next: Stage = stage): Game => {
    const field = makeField(new Set(next.keepList))
    return { field, state: newState(field), history: [], left: next.moveCount }
  }
  const updateStage = (patch: Partial<Stage>) => {
    const next = fitTargetColor({ ...stage, ...patch })
    setStage(next)
    if (mode === 'play') setGame(newGame(next))
    if (patch.inkList && !patch.inkList.includes(playInk)) setPlayInk(patch.inkList[0])
  }

  const toggle = (key: string) => {
    setStage(now => {
      const set = new Set(now.keepList)
      if (painting.current) set.add(key)
      else set.delete(key)
      return { ...now, keepList: [...set] }
    })
  }

  const playDrop = (key: string) => {
    if (!game || game.left <= 0 || !canDrop(game.state, key)) return
    const state = cloneState(game.state)
    applyDrop(game.field, state, key, playInk)
    setGame({
      ...game,
      state,
      history: [...game.history, { state: game.state, ink: playInk }],
      left: game.left - 1,
    })
  }

  const simulate = () => {
    const field = makeField()
    if (!field.cellList.length || !nameList.length) {
      setSimulation('no cells or target color')
      return
    }
    const run = ++simulationRun.current
    let done = 0
    let cleared = 0
    let best = 0
    let sumFinal = 0
    setSimulation('running…')
    const chunk = () => {
      if (run !== simulationRun.current) return
      const end = Math.min(TRIAL_COUNT, done + TRIAL_CHUNK)
      for (; done < end; done++) {
        const state = newState(field)
        let left = stage.moveCount
        let guard = 0
        while (left > 0 && !isFull(state) && guard++ < 500) {
          const cell = field.cellList[(Math.random() * field.cellList.length) | 0]
          if (!canDrop(state, cell.key)) continue
          applyDrop(
            field,
            state,
            cell.key,
            stage.inkList[(Math.random() * stage.inkList.length) | 0]
          )
          left--
        }
        const result = evaluate(state, nameList)
        if (result.clear) {
          cleared++
          sumFinal += result.final
          best = Math.max(best, result.final)
        }
      }
      if (done < TRIAL_COUNT) {
        setSimulation('running… ' + done)
        setTimeout(chunk, 0)
      } else
        setSimulation({
          rate: (100 * cleared) / TRIAL_COUNT,
          best,
          average: cleared ? Math.round(sumFinal / cleared) : 0,
        })
    }
    chunk()
  }

  const code = useMemo(() => {
    const removed = ALL_KEY_LIST.filter(key => !keep.has(key))
    const targetColor =
      nameList.length > 1
        ? '[' + nameList.map(x => "'" + x + "'").join(', ') + ']'
        : "'" + (nameList[0] || '') + "'"
    return (
      '{ radius: ' +
      RADIUS +
      ', moveCount: ' +
      stage.moveCount +
      ', inkList: [' +
      stage.inkList.join(', ') +
      '], targetColor: ' +
      targetColor +
      (removed.length ? ",\n  removed: cellSet('" + removed.join(';') + "')" : '') +
      ' },'
    )
  }, [keep, nameList, stage.inkList, stage.moveCount])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied('copied')
    } catch {
      setCopied('copy failed')
    }
    setTimeout(() => setCopied(''), 1500)
  }

  const load = (value: string) => {
    const mission = MISSION_LIST[Number(value)]
    if (!mission) return
    const targetColorList = targetColorListOf(mission.targetColor)
    const next: Stage = {
      keepList: ALL_CELL_LIST.filter(cell => !mission.removed?.(cell.q, cell.r)).map(
        cell => cell.key
      ),
      inkList: mission.inkList.slice(),
      moveCount: mission.moveCount,
      targetColorList: [targetColorList[0], targetColorList[1] || ''],
    }
    setStage(next)
    if (mode === 'play') setGame(newGame(next))
    setPlayInk(next.inkList[0])
  }

  const result = game ? evaluate(game.state, nameList) : null
  const width = 1.5 * 2 * RADIUS + 2
  const height = ROOT3 * (2 * RADIUS + 1)

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Stage Maker</h1>
      <div className={styles.layout}>
        <div className={styles.fieldWrap}>
          <div className={styles.tabList} role="group" aria-label="Mode">
            {(['edit', 'play'] as const).map(one => (
              <button
                key={one}
                type="button"
                className={styles.tab}
                aria-pressed={mode === one}
                onClick={() => {
                  setMode(one)
                  if (one === 'play') setGame(newGame())
                }}
              >
                {one === 'edit' ? 'Edit' : 'Play'}
              </button>
            ))}
          </div>
          <svg
            className={styles.field}
            viewBox={-width / 2 + ' ' + -height / 2 + ' ' + width + ' ' + height}
            aria-label="Field"
            onPointerDown={event => {
              const key = (event.target as SVGElement).dataset?.key
              if (!key) return
              if (mode === 'edit') {
                painting.current = !keep.has(key)
                event.currentTarget.setPointerCapture(event.pointerId)
                toggle(key)
              } else playDrop(key)
            }}
            onPointerMove={event => {
              if (painting.current == null || mode !== 'edit') return
              const target = document.elementFromPoint(
                event.clientX,
                event.clientY
              ) as SVGElement | null
              const key = target?.dataset?.key
              if (key) toggle(key)
            }}
            onPointerUp={() => (painting.current = null)}
            onPointerCancel={() => (painting.current = null)}
          >
            {ALL_CELL_LIST.map(({ key, x, y }) => {
              const kept = keep.has(key)
              const fill = !kept
                ? undefined
                : mode === 'play' && game
                  ? rgb(colorRGB(game.state[key], rgbToken('--bg-cell')))
                  : 'var(--bg-cell)'
              return (
                <polygon
                  key={key}
                  data-key={key}
                  className={kept ? styles.hex : styles.off}
                  points={hexPoint(x, y, 0.92)}
                  style={{ fill }}
                />
              )
            })}
          </svg>
          <div className={styles.moveRow} aria-label="Moves">
            {mode === 'play' &&
              game &&
              [
                ...game.history.map(step => rgb(INK_LIST[step.ink].rgb)),
                ...Array.from({ length: game.left }, () => null),
              ].map((color, i) => (
                <i
                  key={i}
                  className={color ? undefined : styles.left}
                  style={color ? { background: color } : undefined}
                />
              ))}
          </div>
        </div>
        <div className={styles.panel}>
          <section className={styles.section}>
            <h2>Load</h2>
            <div className={styles.row}>
              <select
                aria-label="Load mission"
                value=""
                onChange={event => load(event.target.value)}
              >
                <option value="">Mission…</option>
                {MISSION_LIST.map((mission, i) => (
                  <option key={i} value={i}>
                    {i + 1 + '. ' + targetColorListOf(mission.targetColor).join(' + ')}
                  </option>
                ))}
              </select>
            </div>
          </section>
          {mode === 'edit' && (
            <section className={styles.section}>
              <h2>Shape</h2>
              <div className={styles.row}>
                <button
                  type="button"
                  className={styles.chip}
                  onClick={() => updateStage({ keepList: ALL_KEY_LIST })}
                >
                  Fill
                </button>
                <button
                  type="button"
                  className={styles.chip}
                  onClick={() => updateStage({ keepList: [] })}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className={styles.chip}
                  onClick={() =>
                    updateStage({ keepList: ALL_KEY_LIST.filter(key => !keep.has(key)) })
                  }
                >
                  Invert
                </button>
              </div>
              <div className={styles.status + ' ' + styles.muted}>{keep.size + ' cells'}</div>
            </section>
          )}
          <section className={styles.section}>
            <h2>Inks</h2>
            <div className={styles.row}>
              {INK_LIST.map((ink, i) => (
                <button
                  key={ink.name}
                  type="button"
                  className={styles.ink}
                  aria-label={ink.name}
                  aria-pressed={stage.inkList.includes(i)}
                  onClick={() => {
                    const has = stage.inkList.includes(i)
                    if (has && stage.inkList.length === 1) return
                    updateStage({
                      inkList: has
                        ? stage.inkList.filter(x => x !== i)
                        : [...stage.inkList, i].sort(),
                    })
                  }}
                >
                  <i style={{ background: rgb(ink.rgb) }} />
                </button>
              ))}
            </div>
          </section>
          <section className={styles.section}>
            <h2>Moves</h2>
            <div className={styles.step}>
              <button
                type="button"
                aria-label="Fewer moves"
                onClick={() => updateStage({ moveCount: Math.max(1, stage.moveCount - 1) })}
              >
                −
              </button>
              <output>{stage.moveCount}</output>
              <button
                type="button"
                aria-label="More moves"
                onClick={() => updateStage({ moveCount: Math.min(MOVE_MAX, stage.moveCount + 1) })}
              >
                +
              </button>
            </div>
          </section>
          <section className={styles.section}>
            <h2 id={targetColorHeadingId}>Target color</h2>
            {[0, 1].map(i => (
              <TargetColorSelect
                key={i}
                label={String(i + 1)}
                labelledBy={targetColorHeadingId}
                value={stage.targetColorList[i]}
                colorNameList={optionList.filter(
                  name => i === 0 || name !== stage.targetColorList[0]
                )}
                canBeNone={i === 1}
                onChange={value => {
                  const targetColorList: [string, string] = [...stage.targetColorList]
                  targetColorList[i] = value
                  updateStage({ targetColorList })
                }}
              />
            ))}
          </section>
          {mode === 'play' && game && result && (
            <section className={styles.section}>
              <h2>Test play</h2>
              <div className={styles.row}>
                {stage.inkList.map(i => (
                  <button
                    key={i}
                    type="button"
                    className={styles.ink}
                    aria-label={'Drop ' + INK_LIST[i].name}
                    aria-pressed={i === playInk}
                    onClick={() => setPlayInk(i)}
                  >
                    <i style={{ background: rgb(INK_LIST[i].rgb) }} />
                  </button>
                ))}
              </div>
              <div className={styles.row}>
                <button
                  type="button"
                  className={styles.chip}
                  onClick={() => {
                    const last = game.history.at(-1)
                    if (last)
                      setGame({
                        ...game,
                        state: last.state,
                        history: game.history.slice(0, -1),
                        left: game.left + 1,
                      })
                  }}
                >
                  Undo
                </button>
                <button type="button" className={styles.chip} onClick={() => setGame(newGame())}>
                  Reset
                </button>
              </div>
              <div className={styles.status}>
                {nameList.map((name, i) => (
                  <div key={name}>
                    {name} <b>× {result.each[i]}</b>
                  </div>
                ))}
                <div className={styles.muted}>
                  {'total ' + result.totalAmount + ' · moves left ' + game.left}
                </div>
                {result.clear ? (
                  <div className={styles.clear}>
                    {'CLEAR · ' +
                      result.hitCount +
                      ' × ' +
                      result.totalAmount +
                      ' = ' +
                      result.final}
                  </div>
                ) : (
                  <div className={styles.muted}>not clear</div>
                )}
              </div>
            </section>
          )}
          <section className={styles.section}>
            <h2>Check</h2>
            <div className={styles.row}>
              <button type="button" className={styles.chip} onClick={simulate}>
                {'Simulate ' + TRIAL_COUNT}
              </button>
            </div>
            <div className={styles.status}>
              {typeof simulation === 'string' ? (
                simulation
              ) : (
                <>
                  <div>
                    random clear rate <b>{simulation.rate.toFixed(2)}%</b>
                  </div>
                  <div className={styles.muted}>
                    {'best ' + simulation.best + ' · avg on clear ' + simulation.average}
                  </div>
                </>
              )}
            </div>
          </section>
          <section className={styles.section}>
            <h2>Export</h2>
            <textarea readOnly aria-label="Mission code" value={code} />
            <div className={styles.row}>
              <button type="button" className={styles.chip} onClick={copy}>
                Copy
              </button>
              <span className={styles.muted}>{copied}</span>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
