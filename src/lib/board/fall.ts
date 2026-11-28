// タイルが倒れて落ちる動き。角を支点に倒れ、離れたら重力と抵抗で落ちる
import { GLASS_ALPHA, type Fall, type Tile } from './createBoard'

const GRAVITY = 9
const DRAG = 3
const ANGULAR_DRAG = 1.5
const FALL_RELEASE = 0.12
export const FADE_FROM = 0.5
export const FADE_TO = 2

const fallList = new Map<string, Fall>()

export function addFall(
  key: string,
  gravityDirection: Fall['gravityDirection'],
  speed: number,
  color: readonly number[] | null
): void {
  const phase = Math.PI / 6 + ((Math.random() * 6) | 0) * (Math.PI / 3)
  fallList.set(key, {
    phase,
    axisX: -Math.sin(phase),
    axisY: Math.cos(phase),
    angle: 0,
    angularVelocity: 0,
    isFree: false,
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    age: 0,
    alpha: 1,
    speed,
    gravityDirection,
    color: color ? [...color] : null,
  })
}

export function fallOf(key: string): Fall | undefined {
  return fallList.get(key)
}

export function hasFall(key: string): boolean {
  return fallList.has(key)
}

// 落ちている途中のタイルの座標
export function fallKeyList(): IterableIterator<string> {
  return fallList.keys()
}

export function isFalling(): boolean {
  return fallList.size > 0
}

// 落下を終える。元の場所へ戻しきったタイルを、盤面のタイルとして続けるときに使う
export function removeFall(key: string): void {
  fallList.delete(key)
}

// 落ちているタイルを、今の姿勢・見え方から元の場所へ戻し始める。
// zoom は切り替え中なら今の寄り引きの進み、startedAt は切り替えていないときの開始時刻
export function startReturning(fall: Fall, zoom: number, startedAt: number | null): void {
  const settle = fall.settle
  // また落としている途中なら、残っている盤面の見え方から戻す
  const fromProgress = settle ? settle.weight : 0
  const ratio = settle ? settle.weight / settle.from : 0
  const alpha = fall.alpha * (GLASS_ALPHA + (1 - GLASS_ALPHA) * fromProgress)
  const color = fall.color ? [...fall.color] : [255, 255, 255]
  const radiusScale = settle ? 1 + (settle.radiusScale - 1) * ratio : 1
  const stroke = settle ? settle.stroke * ratio : 0
  const glint = settle ? settle.glint * ratio : 0
  // 姿勢は今の位置を、fromProgress まで戻した位置とみなす
  const scale = fromProgress < 1 ? 1 / (1 - fromProgress) : 1
  fall.returning = {
    position: [fall.position[0] * scale, fall.position[1] * scale, fall.position[2] * scale],
    angle: fall.angle * scale,
    fromProgress,
    alpha,
    color,
    radiusScale,
    stroke,
    glint,
    zoom,
    startedAt,
    progress: fromProgress,
    drawn: { alpha, color: [...color], radiusScale, stroke, glint },
  }
  fall.settle = null
}

// 戻している途中のタイルを、今の進みと今描いている見え方から戻し直す。新しい切り替えが始まるときに使う
export function restartReturning(): void {
  for (const fall of fallList.values()) {
    const back = fall.returning
    if (!back) continue
    back.fromProgress = back.progress
    back.alpha = back.drawn.alpha
    back.color = [...back.drawn.color]
    back.radiusScale = back.drawn.radiusScale
    back.stroke = back.drawn.stroke
    back.glint = back.drawn.glint
    back.zoom = 0
    back.startedAt = null
  }
}

// 戻している途中のタイルを、今の姿勢と今描いている見え方から、また落とす。
// 戻している途中で場面がそのタイルを要らなくなったときに使う。盤面のタイルの見え方は、落ちながら少しずつ抜く
export function resumeFalling(fall: Fall): void {
  const back = fall.returning
  if (!back) return
  const progress = back.progress
  const alpha = Math.min(1, back.drawn.alpha / (GLASS_ALPHA + (1 - GLASS_ALPHA) * progress))
  // 消え始める前の濃さなら経った時間はそのまま、消えかけなら今の濃さになる時点から続ける
  if (alpha < 1) fall.age = FADE_FROM + (1 - alpha) * (FADE_TO - FADE_FROM)
  else fall.age = Math.min(fall.age, FADE_FROM)
  fall.alpha = alpha
  fall.color = [...back.drawn.color]
  fall.velocity = [0, 0, 0]
  fall.isFree = true
  fall.returning = null
  fall.settle =
    progress > 0
      ? {
          from: progress,
          weight: progress,
          radiusScale: back.drawn.radiusScale,
          stroke: back.drawn.stroke,
          glint: back.drawn.glint,
        }
      : null
}

// 条件に合う落下を終える。切り替えが終わるときに、次の場面にも要るタイルの落下を終えて、盤面のタイルとして続けるために使う
export function endFallList(shouldEnd: (key: string, fall: Fall) => boolean): void {
  for (const [key, fall] of fallList) if (shouldEnd(key, fall)) fallList.delete(key)
}

export function clearFallList(): void {
  fallList.clear()
}

function rotateAroundAxis(
  axisX: number,
  axisY: number,
  angle: number,
  vector: number[]
): [number, number, number] {
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  const axisDot = axisX * vector[0] + axisY * vector[1]
  return [
    vector[0] * cosine + axisY * vector[2] * sine + axisX * axisDot * (1 - cosine),
    vector[1] * cosine + -axisX * vector[2] * sine + axisY * axisDot * (1 - cosine),
    vector[2] * cosine + (axisX * vector[1] - axisY * vector[0]) * sine,
  ]
}

// 1フレーム分進める。limit より奥へ落ちたもの、消えきったものは外す
// settleMs は、また落としたタイルから盤面のタイルの見え方を抜ききるまでの長さ
export function stepFallList(frameMs: number, limit: number, settleMs: number): void {
  const acceleration = 0.857 * GRAVITY
  const maxStep = 0.004
  for (const [key, fall] of fallList) {
    // 元の場所へ戻している途中のタイルは、落とさない（姿勢は切り替えの進みに合わせて engine が戻す）
    if (fall.returning) continue
    if (fall.settle) {
      fall.settle.weight -= (frameMs / settleMs) * fall.settle.from
      if (fall.settle.weight <= 0) fall.settle = null
    }
    let rest = (frameMs / 1000) * fall.speed
    fall.age += rest
    const pivotX = Math.cos(fall.phase) * 0.8660254
    const pivotY = Math.sin(fall.phase) * 0.8660254
    while (rest > 0) {
      const step = Math.min(maxStep, rest)
      rest -= step
      if (!fall.isFree) {
        fall.angularVelocity += acceleration * Math.cos(fall.angle) * step
        fall.angle += fall.angularVelocity * step
        const q = rotateAroundAxis(fall.axisX, fall.axisY, -fall.angle, [-pivotX, -pivotY, 0])
        fall.position = [pivotX + q[0], pivotY + q[1], q[2]]
        if (fall.angle >= FALL_RELEASE) {
          const arm = [fall.position[0] - pivotX, fall.position[1] - pivotY, fall.position[2]]
          const spin = [-fall.angularVelocity * fall.axisX, -fall.angularVelocity * fall.axisY, 0]
          fall.velocity = [
            spin[1] * arm[2] - spin[2] * arm[1],
            spin[2] * arm[0] - spin[0] * arm[2],
            spin[0] * arm[1] - spin[1] * arm[0],
          ]
          fall.isFree = true
        }
      } else {
        for (let i = 0; i < 3; i++) {
          fall.velocity[i] += (GRAVITY * fall.gravityDirection[i] - DRAG * fall.velocity[i]) * step
          fall.position[i] += fall.velocity[i] * step
        }
        fall.angularVelocity *= Math.exp(-ANGULAR_DRAG * step)
        fall.angle += fall.angularVelocity * step
      }
    }
    fall.alpha = 1 - Math.min(1, Math.max(0, (fall.age - FADE_FROM) / (FADE_TO - FADE_FROM)))
    if (fall.position[2] < -limit || fall.age >= FADE_TO) fallList.delete(key)
  }
}

// 落ちているタイルの描き方
// また落としている途中で盤面のタイルの見え方が残っているときは、その分を混ぜる
export function fallTile(fall: Fall, x: number, y: number, radius: number): Tile {
  const color = fall.color
  const settle = fall.settle
  const ratio = settle ? settle.weight / settle.from : 0
  return {
    x,
    y,
    radius: settle ? radius * (1 + (settle.radiusScale - 1) * ratio) : radius,
    red: color ? color[0] / 255 : 1,
    green: color ? color[1] / 255 : 1,
    blue: color ? color[2] / 255 : 1,
    // 落ちているタイルはシェーダーで GLASS_ALPHA が掛かる。見え方が残っている間はここで掛ける
    alpha: settle ? fall.alpha * (GLASS_ALPHA + (1 - GLASS_ALPHA) * settle.weight) : fall.alpha,
    stroke: settle ? settle.stroke * ratio : 0,
    fall,
    glint: settle ? settle.glint * ratio : 0,
    lift: 0,
  }
}
