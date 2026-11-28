// プレイ画面の盤面の場面。盤面を置く位置と、セルの色・膨らみ・光を返す
import type { RefObject } from 'react'
import { isTargetColor, colorNameOf, ROOT3, amountOf } from '@/game/core'
import { colorRGB } from '@/game/color'
import { boxOf, cameraOn } from '@/lib/board/geometry'
import { EMPTY, type Scene } from '@/lib/board/scene'
import { sweepPhase } from '@/lib/board/sweep'
import { fullCellList } from '@/lib/missionLayout'
import { rgbToken } from '@/utils/colorToken'
import { milliseconds } from '@/utils/motionToken'
import type { Game } from './game'
import { CELL_GAP, fitCell } from './layout'

interface PlaySceneOption {
  target: Game
  radius: number
  // 盤面を置く位置（セル単位）。場面とタップ判定とで同じ値を使う
  offset: [number, number]
  fieldAreaRef: RefObject<HTMLDivElement | null>
  fitRef: RefObject<HTMLDivElement | null>
}

export function createPlayScene({
  target,
  radius,
  offset,
  fieldAreaRef,
  fitRef,
}: PlaySceneOption): Scene {
  const [offsetQ, offsetR] = offset
  const box = boxOf(fullCellList(radius).map(([q, r]) => [q + offsetQ, r + offsetR]))
  const toLocal = (q: number, r: number) => q - offsetQ + ',' + (r - offsetR)
  // タイルを置きうる座標（盤面の形の範囲）
  const keyList = fullCellList(radius).map(([q, r]) => q + offsetQ + ',' + (r + offsetR))
  const layoutCamera = () => {
    const cellHeight = fitCell(radius)
    const fieldAreaWidth = fieldAreaRef.current!.clientWidth - 8
    const fit = fitRef.current!
    const pitch = (cellHeight + CELL_GAP) / ROOT3
    const width = (box.maxX - box.minX) * pitch + (2 * cellHeight) / ROOT3
    const height = (box.maxY - box.minY) * pitch + cellHeight
    const overflow = Math.min(0, (fieldAreaWidth - width) / 2)
    // 盤面（canvas）の座標に合わせて置くので、書字方向で反転させない
    fit.style.width = width.toFixed(1) + 'px'
    fit.style.height = height.toFixed(1) + 'px'
    fit.style.margin = '0 ' + overflow.toFixed(1) + 'px'
    return cameraOn(fit, box, pitch, cellHeight / (cellHeight + CELL_GAP))
  }
  const pulseMs = milliseconds('--duration-pulse')
  const scene: Scene = {
    camera: layoutCamera(),
    focus: [offsetQ, offsetR],
    tileKeyList: () => keyList,
    cell(q, r) {
      const key = toLocal(q, r)
      const mix = target.state[key]
      if (!mix || target.despawned?.has(key) || target.unspawned?.has(key)) return EMPTY
      let zoom = 1
      const pulseAt = target.pulse.get(key)
      if (pulseAt != null) {
        const pulseProgress = (performance.now() - pulseAt) / pulseMs
        if (pulseProgress < 1)
          zoom = 1 + (1 / scene.camera.tileRatio - 1) * Math.sin(Math.PI * pulseProgress)
        else target.pulse.delete(key)
      }
      return {
        alpha: 1,
        color: colorRGB(mix, rgbToken('--bg-cell')),
        stroke: 0,
        zoom,
        glint: target.targetColor && isTargetColor(colorNameOf(mix), target.targetColor) ? 1 : 0,
      }
    },
    tick() {
      if (target.pulse.size > 0) return true
      if (!target.targetColor || sweepPhase() >= 1.05) return false
      for (const key in target.state)
        if (isTargetColor(colorNameOf(target.state[key]), target.targetColor)) return true
      return false
    },
    colored() {
      if (target.despawned) return false
      for (const key in target.state) if (amountOf(target.state[key])) return true
      return false
    },
    layout() {
      scene.camera = layoutCamera()
    },
  }
  return scene
}
