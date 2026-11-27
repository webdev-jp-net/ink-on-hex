// タイルが倒れて落ちる動き。角を支点に倒れ、離れたら重力と抵抗で落ちる
import type { Fall, Tile } from './createBoard'

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

export function isFalling(): boolean {
  return fallList.size > 0
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
export function stepFallList(frameMs: number, limit: number): void {
  const acceleration = 0.857 * GRAVITY
  const maxStep = 0.004
  for (const [key, fall] of fallList) {
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
export function fallTile(fall: Fall, x: number, y: number, radius: number): Tile {
  const color = fall.color
  return {
    x,
    y,
    radius,
    red: color ? color[0] / 255 : 1,
    green: color ? color[1] / 255 : 1,
    blue: color ? color[2] / 255 : 1,
    alpha: fall.alpha,
    stroke: 0,
    fall,
    glint: 0,
    lift: 0,
  }
}
