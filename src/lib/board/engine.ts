// 盤面の場面（Scene）を持ち、毎フレーム描く。場面の切り替えと、タイルの登場・消滅の描き方を扱う
import { gsap } from 'gsap'
import { ROOT3 } from '@/game/core'
import { ease, milliseconds, seconds } from '@/utils/motionToken'
import { createBoard, type Board, type Camera, type Fall, type Tile } from './createBoard'
import {
  addFall,
  clearFallList,
  fallOf,
  fallTile,
  hasFall,
  endFallList,
  fallKeyList,
  isFalling,
  removeFall,
  restartReturning,
  resumeFalling,
  startReturning,
  stepFallList,
} from './fall'
import { angleRatio, axialRound, cameraBetween, homeCamera, worldPosition } from './geometry'
import { isRedrawNeeded, kick, markDrawn } from './redraw'
import type { Scene } from './scene'
import { resetSweep, sweepNow } from './sweep'

const THICKNESS = 0.16
const HOME_BLUR = 10
const DESPAWN_SPEED = 3
export const SPAWN_LIFT = 0.6
// これより薄いタイルは、盤面にないものとして扱う
const VISIBLE_ALPHA = 0.004
// 見え方が目標にこれより近づいたら、追いついたものとして目標の値にそろえる
const SETTLE = 0.004

// 盤面の1枚のタイルの見え方。描画側が座標ごとに持ち続ける
export interface Shown {
  alpha: number
  color: number[]
  stroke: number
  glint: number
  zoom: number
  // 浮いた位置から降りている途中の浮きの割合（0〜1）
  lift: number
  spawnedAt?: number | null
}

interface Transition {
  from: Scene
  to: Scene
  progress: { zoom: number; color: number }
  // 打ち切った切り替えから続けるときの、出発のカメラと切り抜き。打ち切りでなければ前の場面のものを毎フレーム読む
  fromCamera: Camera | null
  fromClip: [number, number] | null
  // 切り替えを始めたときの、盤面のタイルの見え方。座標ごとに、初めて描くときに控える
  startList: Map<string, Shown>
  despawnedList: Set<string>
  timeline?: gsap.core.Timeline
  // 途中で打ち切られたときも待っている側を進める
  settle: () => void
}

let board: Board | null = null
let current: Scene | null = null
let transition: Transition | null = null
let shownList = new Map<string, Shown>()
// 見え方が、最後に終わった切り替えの次の場面（切り替えていないときは今の場面）の見え方に追いついていない記録の座標。
// 切り替えで動かしたものと、切り替えていないときに変化の途中のものを控える
const unsettledList = new Set<string>()
const beforeFrameList = new Set<() => boolean>()

export function boardOf(): Board {
  if (!board) throw new Error('盤面がまだありません')
  return board
}

export function currentScene(): Scene | null {
  return current
}

export function transitionProgress(): number | null {
  return transition ? transition.progress.zoom : null
}

// 盤面のその座標に、今タイルがあるか。描画側が持っているタイルの見え方から答える
// 場面が自分のタイルを決めるときに、盤面にあるタイルを引き継ぐために使う。
// 切り替えの間は、描く前にその座標の出発の見え方を控えてから次の場面の cell を呼ぶので、出発の見え方で答える
export function hasTileAt(q: number, r: number): boolean {
  const key = q + ',' + r
  const shown = transition?.startList.get(key) ?? shownList.get(key)
  return !!shown && shown.alpha > VISIBLE_ALPHA
}

// 盤面のその座標のタイルの状態（テスト用。e2e/board.spec.ts が、画面をまたいで同じタイルが続くことを確かめるために読む）
export function tileAt(
  q: number,
  r: number
): (Readonly<Omit<Shown, 'color'>> & { readonly color: readonly number[] }) | undefined {
  return shownList.get(q + ',' + r)
}

function clipOf(scene: Scene): [number, number] {
  return [scene.clipTop || 0, scene.clipBottom ?? boardOf().height]
}

// 切り替えの途中の切り抜き。出発から次の場面の切り抜きへ、寄り引きに合わせて移す
function clipBetween(state: Transition): [number, number] {
  const [fromTop, fromBottom] = state.fromClip ?? clipOf(state.from)
  const [toTop, toBottom] = clipOf(state.to)
  const zoom = state.progress.zoom
  return [fromTop + (toTop - fromTop) * zoom, fromBottom + (toBottom - fromBottom) * zoom]
}

// 切り替えの途中のカメラ
function cameraOf(state: Transition): Camera {
  return cameraBetween(
    state.fromCamera ?? state.from.camera,
    state.to.camera,
    state.to.focus,
    state.progress.zoom
  )
}

// 毎フレームの前に呼ぶ処理（スクロールの反映など）。変化があれば true を返す
export function addBeforeFrame(callback: () => boolean): () => void {
  beforeFrameList.add(callback)
  return () => beforeFrameList.delete(callback)
}

// その座標にタイルを登場させる（浮いた位置から降りてくる）。場面がその座標にタイルを置くようになったときに、画面側が呼ぶ。
// 呼ばなければ、画面に入ってきたタイルと同じく、その場の見え方で描き始める
export function spawnTile(key: string): void {
  const shown = shownList.get(key)
  if (shown) shown.alpha = 0
  else shownList.set(key, { alpha: 0, color: [0, 0, 0], stroke: 0, glint: 0, zoom: 1, lift: 0 })
  unsettledList.add(key)
  kick()
}

// タイルを倒して落とす。planeX, planeY は盤面の平面上の座標。camera は落ちる向きを決めるカメラ
export function despawnTile(
  key: string,
  planeX: number,
  planeY: number,
  speed = 1,
  color: readonly number[] | null = null,
  camera: Camera = current?.camera ?? homeCamera()
): void {
  // 落ちている途中か、戻している途中のタイルは、作り直さずに今の姿勢から落とし続ける
  const fall = fallOf(key)
  if (fall) {
    resumeFalling(fall)
    return
  }
  addFall(key, boardOf().viewDirection(planeX, planeY, camera), speed, color)
}

// 落ちている途中のタイルを元の場所へ戻して描く。step（0〜1）は今回の戻し（戻し始めた・戻し直したときから）の進み。
// 戻しきったら落下を終え、盤面のタイル（shown）として続ける
function returnFall(
  key: string,
  fall: Fall,
  step: number,
  shown: Shown,
  targetAlpha: number,
  planeX: number,
  planeY: number,
  tileRadius: number,
  tileList: Tile[]
): void {
  const back = fall.returning!
  const progress = back.fromProgress + (1 - back.fromProgress) * step
  back.progress = progress
  for (let i = 0; i < 3; i++) fall.position[i] = back.position[i] * (1 - progress)
  fall.angle = back.angle * (1 - progress)
  // 戻し始めた・戻し直したときの見え方から、盤面のタイルの見え方へ移す
  const mix = (from: number, to: number) => from + (to - from) * step
  const drawn = {
    alpha: mix(back.alpha, targetAlpha),
    color: back.color.map((value, i) => mix(value, shown.color[i])),
    radiusScale: mix(back.radiusScale, shown.zoom),
    stroke: mix(back.stroke, shown.stroke),
    glint: mix(back.glint, shown.glint),
  }
  back.drawn = drawn
  shown.lift = 0
  shown.alpha = drawn.alpha
  tileList.push({
    ...fallTile(fall, planeX, planeY, tileRadius),
    radius: tileRadius * drawn.radiusScale,
    red: drawn.color[0] / 255,
    green: drawn.color[1] / 255,
    blue: drawn.color[2] / 255,
    alpha: drawn.alpha,
    stroke: drawn.stroke,
    glint: drawn.glint,
  })
  if (progress >= 1) removeFall(key)
}

function frame(time: number, deltaMs: number) {
  const now = time * 1000
  const frameMs = Math.min(64, deltaMs || 16)
  if (!current || !board) return
  for (const callback of beforeFrameList) if (callback()) kick()
  let camera: Camera
  let zoomProgress = 1
  let colorProgress = 1
  if (transition) {
    zoomProgress = transition.progress.zoom
    colorProgress = transition.progress.color
    transition.to.tick?.(now)
    transition.from.tick?.(now)
    camera = cameraOf(transition)
  } else {
    if (current.tick?.(now)) kick()
    if (isFalling()) kick()
    if (!isRedrawNeeded()) return
    camera = current.camera
  }
  markDrawn()
  const height = board.height
  const scale = camera.scale
  const tileRadius = camera.tileRatio * scale
  const [boundLeft, boundRight, boundTop, boundBottom] = board.boundList(camera)
  const worldLeft = (boundLeft - tileRadius - camera.offsetX) / scale
  const worldRight = (boundRight + tileRadius - camera.offsetX) / scale
  const worldTop = (boundTop - tileRadius - camera.offsetY) / scale
  const worldBottom = (boundBottom + tileRadius - camera.offsetY) / scale
  const qFrom = Math.floor(worldLeft / 1.5) - 1
  const qTo = Math.ceil(worldRight / 1.5) + 1
  const tileList: Tile[] = []
  if (isFalling()) {
    stepFallList(frameMs, board.depth / tileRadius, milliseconds('--duration-spawn'))
    kick()
  }
  const alphaEase = 1 - Math.exp(-frameMs / 260)
  const colorEase = 1 - Math.exp(-frameMs / 110)
  const spawnMs = milliseconds('--duration-spawn')
  const isHomeTransition = !!transition && (transition.from.isHome || transition.to.isHome)
  // タイルの一部でも画面に映るか。planeX, planeY は盤面の平面上の座標
  // toScreen は直前に aim したカメラで投影する。倒すときもこのフレームの camera を渡し、判定の傾きをそろえる
  // 余白は、遠近で大きく映る分と、厚み・奥行きぼかしの分を含めて広めに取る（早めに倒れても害はない）
  const drawingBoard = board
  const isOnScreen = (planeX: number, planeY: number, radius: number) => {
    const [screenX, screenY] = drawingBoard.toScreen(planeX, planeY)
    const margin = radius * 1.5 + HOME_BLUR
    return (
      screenX > -margin &&
      screenX < drawingBoard.width + margin &&
      screenY > -margin &&
      screenY < height + margin
    )
  }
  for (let q = qFrom; q <= qTo; q++) {
    const rFrom = Math.floor(worldTop / ROOT3 - q / 2) - 1
    const rTo = Math.ceil(worldBottom / ROOT3 - q / 2) + 1
    for (let r = rFrom; r <= rTo; r++) {
      const key = q + ',' + r
      const [worldX, worldY] = worldPosition(q, r)
      const planeX = worldX * scale + camera.offsetX
      const planeY = worldY * scale + camera.offsetY
      let alpha: number
      let color: number[]
      let stroke: number
      let zoom: number
      let glint: number
      let lift = 0
      if (transition) {
        // 切り替えは、盤面に今あるタイルをその見え方から動かす。
        // 描画側が持っているタイルはその状態から、まだ描いていない座標（画面の外にあったタイル）は
        // 前の場面がそこに置いているタイルから始める。画面の外にあったタイルも同じ盤面の一部として扱う
        let start = transition.startList.get(key)
        if (!start) {
          const shownBefore = shownList.get(key)
          if (shownBefore)
            start = { ...shownBefore, color: [...shownBefore.color], spawnedAt: null }
          else {
            const fromCell = transition.from.cell(q, r)
            start = {
              alpha: fromCell.alpha,
              color: [...fromCell.color],
              stroke: fromCell.stroke,
              glint: fromCell.glint || 0,
              zoom: fromCell.zoom || 1,
              lift: 0,
            }
          }
          transition.startList.set(key, start)
        }
        const toCell = transition.to.cell(q, r)
        // 描く見え方は、盤面のタイルの状態そのものに書き込む。切り替えの後や打ち切ったときも、ここから続ける
        let shown = shownList.get(key)
        if (!shown) {
          // 前にも次にもタイルのない座標は、記録を作らない
          if (start.alpha <= VISIBLE_ALPHA && toCell.alpha === 0 && !hasFall(key)) continue
          shown = { alpha: 0, color: [0, 0, 0], stroke: 0, glint: 0, zoom: 1, lift: 0 }
          shownList.set(key, shown)
        }
        unsettledList.add(key)
        // 盤面になかったタイルは浮いた位置から降ろし、降りている途中のタイルはその浮きから降ろす
        const isArriving = start.alpha < VISIBLE_ALPHA && toCell.alpha > 0
        shown.lift = (isArriving ? 1 : start.lift) * (1 - zoomProgress)
        shown.alpha = start.alpha + (toCell.alpha - start.alpha) * zoomProgress
        shown.zoom = start.zoom + ((toCell.zoom || 1) - start.zoom) * zoomProgress
        shown.stroke = start.stroke + (toCell.stroke - start.stroke) * colorProgress
        shown.glint = start.glint + ((toCell.glint || 0) - start.glint) * colorProgress
        for (let i = 0; i < 3; i++)
          shown.color[i] = start.color[i] + (toCell.color[i] - start.color[i]) * colorProgress
        shown.spawnedAt = null
        // ホームとの切り替えでは、次の場面にないタイルを、寄り引きが始まってから画面に入ったところで倒して落とす。
        // 切り替えの始めに見えていた範囲だけを落とすと、引いて見えてくるタイルは薄くなるだけで、その境が縁として見える
        // 色を抜いてから引く切り替えでは、色を抜き終わるまでその場に描く
        // 同じ座標でほかの落下が続いているときは、それを上書きしない
        const isLeaving = toCell.alpha === 0 && start.alpha > VISIBLE_ALPHA
        if (
          isHomeTransition &&
          isLeaving &&
          zoomProgress > 0 &&
          !transition.despawnedList.has(key) &&
          isOnScreen(planeX, planeY, tileRadius)
        ) {
          transition.despawnedList.add(key)
          if (!hasFall(key)) despawnTile(key, planeX, planeY, DESPAWN_SPEED, shown.color, camera)
        }
        const fall = fallOf(key)
        // 次の場面にも要るタイルが落ちている途中なら、そのタイルを落ちていた姿勢から元の場所へ戻し、
        // 次の場面のタイルとして続ける。同じ座標に、落ちるタイルと次の場面のタイルを別々に描かない
        if (fall && toCell.alpha > 0) {
          if (!fall.returning) startReturning(fall, zoomProgress, null)
          const back = fall.returning!
          const progress =
            back.zoom >= 1
              ? 1
              : Math.max(0, Math.min(1, (zoomProgress - back.zoom) / (1 - back.zoom)))
          returnFall(key, fall, progress, shown, toCell.alpha, planeX, planeY, tileRadius, tileList)
          continue
        }
        // 戻している途中で次の場面がそのタイルを要らなくなったら、今の姿勢と見え方からまた落とす
        if (fall?.returning) resumeFalling(fall)
        if (fall) tileList.push(fallTile(fall, planeX, planeY, tileRadius))
        // 落としたタイルは盤面から外れる。落ちきった後もその場に描き直さない
        if (isLeaving && (fall || transition.despawnedList.has(key))) {
          shown.alpha = 0
          continue
        }
        alpha = shown.alpha
        color = shown.color
        stroke = shown.stroke
        glint = shown.glint
        zoom = shown.zoom
        lift = shown.lift * SPAWN_LIFT * tileRadius
      } else {
        const target = current.cell(q, r)
        let shown = shownList.get(key)
        if (!shown) {
          // タイルのない座標は、記録を作らない
          if (target.alpha === 0 && !hasFall(key)) continue
          shown = {
            alpha: target.alpha,
            color: [...target.color],
            stroke: target.stroke,
            glint: target.glint || 0,
            zoom: target.zoom || 1,
            lift: 0,
          }
          shownList.set(key, shown)
        }
        const targetGlint = target.glint || 0
        if (Math.abs(targetGlint - shown.glint) > SETTLE) {
          shown.glint += (targetGlint - shown.glint) * alphaEase
          kick()
        } else shown.glint = targetGlint
        // 場面に要るタイルが落ちている途中なら、そのタイルを落ちていた姿勢から元の場所へ戻して続ける。
        // 同じ座標に、落ちるタイルと場面のタイルを別々に描かない
        const fall = fallOf(key)
        if (fall && target.alpha > 0) {
          if (!fall.returning) startReturning(fall, 0, performance.now())
          const back = fall.returning!
          const progress =
            back.startedAt == null ? 1 : Math.min(1, (performance.now() - back.startedAt) / spawnMs)
          for (let i = 0; i < 3; i++) {
            if (Math.abs(target.color[i] - shown.color[i]) > 0.5)
              shown.color[i] += (target.color[i] - shown.color[i]) * colorEase
            else shown.color[i] = target.color[i]
          }
          shown.stroke = target.stroke
          shown.zoom = target.zoom || 1
          shown.spawnedAt = null
          returnFall(key, fall, progress, shown, target.alpha, planeX, planeY, tileRadius, tileList)
          unsettledList.add(key)
          kick()
          continue
        }
        if (target.alpha > 0 && shown.alpha < VISIBLE_ALPHA && shown.spawnedAt == null) {
          // 新しく登場するタイルは、場面の見え方から始める
          shown.spawnedAt = performance.now()
          shown.alpha = 0
          for (let i = 0; i < 3; i++) shown.color[i] = target.color[i]
          shown.stroke = target.stroke
        }
        shown.lift = 0
        if (shown.spawnedAt != null) {
          const spawnProgress = Math.min(1, (performance.now() - shown.spawnedAt) / spawnMs)
          const easeOut = 1 - Math.pow(1 - spawnProgress, 3)
          shown.alpha = easeOut * target.alpha
          shown.lift = 1 - easeOut
          lift = shown.lift * SPAWN_LIFT * tileRadius
          if (spawnProgress >= 1 || target.alpha === 0) shown.spawnedAt = null
          kick()
        } else if (Math.abs(target.alpha - shown.alpha) > SETTLE) {
          shown.alpha += (target.alpha - shown.alpha) * alphaEase
          kick()
        } else shown.alpha = target.alpha
        for (let i = 0; i < 3; i++) {
          if (Math.abs(target.color[i] - shown.color[i]) > 0.5) {
            shown.color[i] += (target.color[i] - shown.color[i]) * colorEase
            kick()
          } else shown.color[i] = target.color[i]
        }
        shown.stroke = target.stroke
        alpha = shown.alpha
        color = shown.color
        stroke = shown.stroke
        glint = shown.glint
        shown.zoom = target.zoom || 1
        zoom = shown.zoom
        const isSettled =
          shown.spawnedAt == null &&
          shown.alpha === target.alpha &&
          shown.glint === targetGlint &&
          shown.color.every((value, i) => value === target.color[i])
        if (isSettled) unsettledList.delete(key)
        else unsettledList.add(key)
        // ここに来る落下は、場面にない座標のタイル。落ちるタイルだけを描く
        if (fall) {
          if (fall.returning) resumeFalling(fall)
          tileList.push(fallTile(fall, planeX, planeY, tileRadius))
          shown.alpha = 0
          continue
        }
      }
      if (alpha < 0.01) continue
      tileList.push({
        x: planeX,
        y: planeY,
        radius: tileRadius * zoom,
        red: color[0] / 255,
        green: color[1] / 255,
        blue: color[2] / 255,
        alpha,
        stroke,
        fall: null,
        glint,
        lift,
      })
    }
  }
  const [clipTop, clipBottom] = transition ? clipBetween(transition) : clipOf(current)
  const ratio = angleRatio(camera)
  board.render(
    tileList,
    camera,
    clipTop,
    clipBottom,
    THICKNESS * tileRadius * ratio,
    HOME_BLUR * ratio,
    sweepNow()
  )
}

// 画面に映るセル
export function visibleKeyList(camera: Camera, all = false): [number, number][] {
  const target = boardOf()
  const [boundLeft, boundRight, boundTop, boundBottom] = target.boundList(camera)
  const out: [number, number][] = []
  const scale = camera.scale
  const worldLeft = (boundLeft - camera.offsetX) / scale
  const worldRight = (boundRight - camera.offsetX) / scale
  const worldTop = (boundTop - camera.offsetY) / scale
  const worldBottom = (boundBottom - camera.offsetY) / scale
  for (let q = Math.floor(worldLeft / 1.5); q <= Math.ceil(worldRight / 1.5); q++)
    for (
      let r = Math.floor(worldTop / ROOT3 - q / 2);
      r <= Math.ceil(worldBottom / ROOT3 - q / 2);
      r++
    ) {
      const [x, y] = worldPosition(q, r)
      const [planeX, planeY] = target.toScreen(
        x * scale + camera.offsetX,
        y * scale + camera.offsetY
      )
      if (all || (planeX >= 0 && planeX <= target.width && planeY >= 0 && planeY <= target.height))
        out.push([q, r])
    }
  return out
}

// 画面座標から盤面のセル
export function pick(x: number, y: number): [number, number] {
  const camera = current!.camera
  const worldX = (x - camera.offsetX) / camera.scale
  const worldY = (y - camera.offsetY) / camera.scale
  const q = worldX / 1.5
  return axialRound(q, worldY / ROOT3 - q / 2)
}

// 場面を切り替える。色が付く場面へは寄ってから色、色が消える場面へは色を抜いてから引く
export function enter(next: Scene): Promise<void> {
  const previous = current
  if (!previous) {
    current = next
    shownList.clear()
    unsettledList.clear()
    kick()
    return Promise.resolve()
  }
  // 切り替えを打ち切ったときは、その時点のカメラ・切り抜き・色の段階から続ける。
  // タイルの見え方は、描画側が持っている状態（shownList）から続く
  const interrupted = transition
  // 戻している途中のタイルは、この切り替えの進みに合わせて今の姿勢から戻し直す
  restartReturning()
  const fromCamera = interrupted ? cameraOf(interrupted) : null
  const fromClip = interrupted ? clipBetween(interrupted) : null
  const fromColored = interrupted
    ? interrupted.progress.color > 0
      ? interrupted.to.colored()
      : interrupted.from.colored()
    : previous.colored()
  stopTransition()
  const toColored = next.colored()
  const progress = { zoom: 0, color: 0 }
  let settle = () => {}
  const state: Transition = {
    settle: () => settle(),
    from: previous,
    to: next,
    progress,
    fromCamera,
    fromClip,
    startList: new Map(),
    despawnedList: new Set(),
  }
  transition = state
  const zoomSeconds = seconds('--duration-zoom')
  const colorSeconds = seconds('--duration-color')
  return new Promise(resolve => {
    settle = resolve
    const timeline = gsap.timeline({
      onComplete: () => {
        if (transition !== state) return
        transition = null
        current = next
        // 次の場面にも要るタイルが落ちている途中なら、落下を終えて盤面のタイルとして続ける。
        // 戻している途中のものに加え、切り替えの間ずっと描く範囲の外にいて戻せなかったものも含める
        endFallList((key, fall) => {
          if (fall.returning) return true
          const [q, r] = key.split(',').map(Number)
          return next.cell(q, r).alpha > 0
        })
        // 盤面のタイルの状態は捨てずに、次の場面のまま続ける。
        // 盤面のタイルを、作り直さずに、切り替えを終えた見え方（次の場面の見え方）へそろえる。
        // 切り替えの間ずっと画面の外にいたものや途中で画面から出ていったものも同じ盤面の一部で、
        // 最後に描いたフレームは進みが1に届く手前のことがあるので、描いたタイルもそろえる。
        // 次の場面にタイルのない座標の記録は外す（タイルが盤面から外れる）
        const settle = (key: string, shown: Shown) => {
          const [q, r] = key.split(',').map(Number)
          const target = next.cell(q, r)
          shown.alpha = target.alpha
          for (let i = 0; i < 3; i++) shown.color[i] = target.color[i]
          shown.stroke = target.stroke
          shown.glint = target.glint || 0
          shown.zoom = target.zoom || 1
          shown.lift = 0
          shown.spawnedAt = null
          return shown.alpha > VISIBLE_ALPHA || hasFall(key)
        }
        if (next.tileKeyList) {
          // タイルを置きうる座標を場面が知らせるときは、その座標と落ちている途中の座標だけを調べ、
          // ほかの記録はまとめて外す。記録の数（ホームに長くいるほど増える）だけ回さずに済む
          const kept = new Map<string, Shown>()
          const keep = (key: string) => {
            const shown = shownList.get(key)
            if (shown && !kept.has(key) && settle(key, shown)) kept.set(key, shown)
          }
          for (const key of next.tileKeyList()) keep(key)
          for (const key of fallKeyList()) keep(key)
          shownList = kept
        } else if (next.isHome && previous.isHome) {
          // ホームから出る切り替えを打ち切ってホームへ戻るとき。追いついていない記録のほかは、ホームの見え方のまま変わっておらず、
          // ホームは盤面にあるタイルを欠けにせず引き継ぐ（Home.tsx の has が hasTileAt を見る）ので、次の場面でも同じ見え方になる。
          // そこで、追いついていない記録と落ちている途中の座標だけを調べる
          for (const key of [...unsettledList, ...fallKeyList()]) {
            const shown = shownList.get(key)
            if (shown && !settle(key, shown)) shownList.delete(key)
          }
        } else for (const [key, shown] of shownList) if (!settle(key, shown)) shownList.delete(key)
        unsettledList.clear()
        kick()
        resolve()
      },
    })
    state.timeline = timeline
    if (toColored && !fromColored)
      timeline
        .to(progress, { zoom: 1, duration: zoomSeconds, ease })
        .to(progress, { color: 1, duration: colorSeconds, ease: 'none' })
    else if (fromColored && !toColored)
      timeline
        .to(progress, { color: 1, duration: colorSeconds, ease: 'none' })
        .to(progress, { zoom: 1, duration: zoomSeconds, ease })
    else timeline.to(progress, { zoom: 1, color: 1, duration: zoomSeconds, ease })
  })
}

function stopTransition() {
  if (!transition) return
  transition.timeline?.kill()
  transition.settle()
  transition = null
}

// 画面の大きさが変わったとき、描画の大きさを合わせて場面を組み直す
export function resize(): void {
  board?.resize()
  relayout()
  kick()
}

// 配置が変わったとき（リサイズ・スクロール）に場面を組み直す
export function relayout(): void {
  // 盤面のタイルは座標で持っているので、カメラが動いても状態は捨てない
  if (current && !transition && current.layout) {
    current.layout()
    kick()
  }
}

export function mount(canvas: HTMLCanvasElement): () => void {
  board = createBoard(canvas)
  gsap.ticker.add(frame)
  return () => {
    gsap.ticker.remove(frame)
    stopTransition()
    board?.dispose()
    board = null
    current = null
    shownList.clear()
    unsettledList.clear()
    clearFallList()
    resetSweep()
  }
}
