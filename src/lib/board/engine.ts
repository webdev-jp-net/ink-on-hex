// 盤面の場面（Scene）を持ち、毎フレーム描く。場面の切り替えと、タイルの登場・消滅の描き方を扱う
import { gsap } from 'gsap'
import { ROOT3 } from '@/game/core'
import { ease, milliseconds, seconds } from '@/utils/motionToken'
import { createBoard, type Board, type Camera, type Tile } from './createBoard'
import { addFall, clearFallList, fallOf, fallTile, hasFall, isFalling, stepFallList } from './fall'
import { angleRatio, axialRound, cameraBetween, homeCamera, worldPosition } from './geometry'
import { isRedrawNeeded, kick, markDrawn } from './redraw'
import type { Scene } from './scene'
import { resetSweep, sweepNow } from './sweep'

const THICKNESS = 0.16
const HOME_BLUR = 10
const DESPAWN_SPEED = 3
export const SPAWN_LIFT = 0.6

interface Transition {
  from: Scene
  to: Scene
  progress: { zoom: number; color: number }
  despawnedList: Set<string>
  timeline?: gsap.core.Timeline
  // 途中で打ち切られたときも待っている側を進める
  settle: () => void
}

interface Shown {
  alpha: number
  color: number[]
  stroke: number
  glint: number
  spawnedAt?: number | null
}

let board: Board | null = null
let current: Scene | null = null
let transition: Transition | null = null
const shownList = new Map<string, Shown>()
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

// 毎フレームの前に呼ぶ処理（スクロールの反映など）。変化があれば true を返す
export function addBeforeFrame(callback: () => boolean): () => void {
  beforeFrameList.add(callback)
  return () => beforeFrameList.delete(callback)
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
  addFall(key, boardOf().viewDirection(planeX, planeY, camera), speed, color)
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
    camera = cameraBetween(
      transition.from.camera,
      transition.to.camera,
      transition.to.focus,
      zoomProgress
    )
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
    stepFallList(frameMs, board.depth / tileRadius)
    kick()
  }
  const alphaEase = 1 - Math.exp(-frameMs / 260)
  const colorEase = 1 - Math.exp(-frameMs / 110)
  const spawnMs = milliseconds('--duration-spawn')
  const seen = transition ? null : new Set<string>()
  // ホームのタイルは飾りで、ほかの場面のセルとは座標が重なっても別のもの。
  // 重なった座標だけが残らないよう、ホームとの切り替えでは前後のタイルを別々に描く
  const isSeparate = !!transition && (transition.from.isHome || transition.to.isHome)
  const isLeavingHome = !!transition?.from.isHome
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
  const pushTile = (
    planeX: number,
    planeY: number,
    radius: number,
    color: readonly number[],
    alpha: number,
    stroke: number,
    glint: number,
    lift: number
  ) => {
    if (alpha < 0.01) return
    tileList.push({
      x: planeX,
      y: planeY,
      radius,
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
      let zoom = 1
      let glint: number
      let lift = 0
      if (transition) {
        const fromCell = transition.from.cell(q, r)
        const toCell = transition.to.cell(q, r)
        stroke = fromCell.stroke + (toCell.stroke - fromCell.stroke) * colorProgress
        glint =
          (fromCell.glint || 0) + ((toCell.glint || 0) - (fromCell.glint || 0)) * colorProgress
        color = [0, 1, 2].map(
          i => fromCell.color[i] + (toCell.color[i] - fromCell.color[i]) * colorProgress
        )
        if (isSeparate) {
          // ホームを離れるときは、タイルが画面に入ったところで倒して落とす。
          // 最初から見えていたタイルも、引いて見えてくるタイルも同じ消え方にし、消え方の違いで境目を作らない
          // 同じ座標でほかの落下が続いているときは、それを上書きしない
          if (
            isLeavingHome &&
            fromCell.alpha > 0 &&
            !transition.despawnedList.has(key) &&
            isOnScreen(planeX, planeY, tileRadius)
          ) {
            transition.despawnedList.add(key)
            if (!hasFall(key)) despawnTile(key, planeX, planeY, DESPAWN_SPEED, null, camera)
          }
          const fall = fallOf(key)
          if (fall) tileList.push(fallTile(fall, planeX, planeY, tileRadius))
          // ホームのタイルは落ちるものとして描く。まだ画面に入っていないものは描かない
          const fromAlpha = isLeavingHome || fall ? 0 : fromCell.alpha * (1 - zoomProgress)
          const toAlpha = toCell.alpha * zoomProgress
          // 2枚が重なる座標は、濃い方の1枚と同じ濃さに見えるよう、次のタイルを薄める
          const toShownAlpha =
            fromAlpha >= 1 ? 0 : Math.max(0, toAlpha - fromAlpha) / (1 - fromAlpha)
          pushTile(planeX, planeY, tileRadius, color, fromAlpha, stroke, glint, 0)
          pushTile(
            planeX,
            planeY,
            tileRadius,
            color,
            toShownAlpha,
            stroke,
            glint,
            (1 - zoomProgress) * SPAWN_LIFT * tileRadius
          )
          continue
        }
        alpha = fromCell.alpha + (toCell.alpha - fromCell.alpha) * zoomProgress
        if (fromCell.alpha === 0 && toCell.alpha > 0)
          lift = (1 - zoomProgress) * SPAWN_LIFT * tileRadius
        const fall = fallOf(key)
        if (fall) {
          tileList.push(fallTile(fall, planeX, planeY, tileRadius))
          if (toCell.alpha === 0) continue
        }
      } else {
        const target = current.cell(q, r)
        let shown = shownList.get(key)
        if (!shown) {
          shown = {
            alpha: target.alpha,
            color: [...target.color],
            stroke: target.stroke,
            glint: target.glint || 0,
          }
          shownList.set(key, shown)
        }
        const targetGlint = target.glint || 0
        if (Math.abs(targetGlint - shown.glint) > 0.004) {
          shown.glint += (targetGlint - shown.glint) * alphaEase
          kick()
        } else shown.glint = targetGlint
        if (target.alpha > 0 && shown.alpha < 0.004 && shown.spawnedAt == null) {
          shown.spawnedAt = performance.now()
          shown.alpha = 0
        }
        if (shown.spawnedAt != null) {
          const spawnProgress = Math.min(1, (performance.now() - shown.spawnedAt) / spawnMs)
          const easeOut = 1 - Math.pow(1 - spawnProgress, 3)
          shown.alpha = easeOut * target.alpha
          lift = (1 - easeOut) * SPAWN_LIFT * tileRadius
          if (spawnProgress >= 1 || target.alpha === 0) shown.spawnedAt = null
          kick()
        } else if (Math.abs(target.alpha - shown.alpha) > 0.004) {
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
        zoom = target.zoom || 1
        seen!.add(key)
        const fall = fallOf(key)
        if (fall) {
          tileList.push(fallTile(fall, planeX, planeY, tileRadius))
          if (target.alpha === 0) {
            shown.alpha = 0
            continue
          }
        }
      }
      pushTile(planeX, planeY, tileRadius * zoom, color, alpha, stroke, glint, lift)
    }
  }
  const clipTopOf = (scene: Scene) => scene.clipTop || 0
  const clipBottomOf = (scene: Scene) => (scene.clipBottom == null ? height : scene.clipBottom)
  const clipTop = transition
    ? clipTopOf(transition.from) +
      (clipTopOf(transition.to) - clipTopOf(transition.from)) * zoomProgress
    : clipTopOf(current)
  const clipBottom = transition
    ? clipBottomOf(transition.from) +
      (clipBottomOf(transition.to) - clipBottomOf(transition.from)) * zoomProgress
    : clipBottomOf(current)
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
  if (seen && shownList.size > seen.size * 3)
    for (const key of shownList.keys()) if (!seen.has(key)) shownList.delete(key)
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
    kick()
    return Promise.resolve()
  }
  // 切り替えの途中では current は前の場面のままなので、打ち切る切り替えも同じ場面から離れている。
  // 落とし済みのタイルを引き継ぎ、落ちきったタイルをもう一度落とさない
  const interrupted = transition
  stopTransition()
  const fromColored = previous.colored()
  const toColored = next.colored()
  const progress = { zoom: 0, color: 0 }
  let settle = () => {}
  const zoomSeconds = seconds('--duration-zoom')
  const colorSeconds = seconds('--duration-color')
  const state: Transition = {
    settle: () => settle(),
    from: previous,
    to: next,
    progress,
    despawnedList: new Set(interrupted?.despawnedList),
  }
  transition = state
  return new Promise(resolve => {
    settle = resolve
    const timeline = gsap.timeline({
      onComplete: () => {
        if (transition !== state) return
        transition = null
        current = next
        shownList.clear()
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
  if (current && !transition && current.layout) {
    current.layout()
    shownList.clear()
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
    clearFallList()
    resetSweep()
  }
}
