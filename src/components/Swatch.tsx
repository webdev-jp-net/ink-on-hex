// 色名のヘックス。課題色は盤面と同じ光りを出す
import { useEffect, useEffectEvent, useId, useRef } from 'react'
import { gsap } from 'gsap'
import { COLOR_NAME_RGB, rgb } from '@/game/color'
import { targetColorListOf, type TargetColor } from '@/game/core'
import { boardOf } from '@/lib/board/engine'
import { sweepBand, SWEEP_FACE, SWEEP_MAX, SWEEP_RIM, sweepNow } from '@/lib/board/sweep'
import { HEX_POINT, HEX_VIEW_BOX } from './hex'
import styles from './Swatch.module.scss'

const STOP_COUNT = 17
const RIM_LIST = [
  [-1, 0, -0.5, -0.8660254, 0.966],
  [-0.5, -0.8660254, 0.5, -0.8660254, 0.707],
  [-1, 0, -0.5, 0.8660254, 0.259],
]
const stopIndexList = Array.from({ length: STOP_COUNT }, (_, i) => i)

interface SwatchProperty {
  name: string
  className?: string
  isDecorative?: boolean
  // 光りを出すかどうか。毎フレーム読む
  glint?: () => boolean
}

export function Swatch({ name, className, isDecorative, glint }: SwatchProperty) {
  const id = useId().replace(/[^\w-]/g, '')
  const svgRef = useRef<SVGSVGElement>(null)
  const faceRef = useRef<SVGLinearGradientElement>(null)
  const rimRef = useRef<SVGLinearGradientElement>(null)

  const hasGlint = !!glint
  const glinting = useEffectEvent(() => !!glint?.())
  useEffect(() => {
    if (!hasGlint) return
    let isShown = false
    const update = () => {
      const svg = svgRef.current
      if (!svg || !faceRef.current || !rimRef.current) return
      const faceList = [...faceRef.current.children] as SVGStopElement[]
      const rimList = [...rimRef.current.children] as SVGStopElement[]
      const sweep = glinting() ? sweepNow() : null
      if (sweep == null) {
        if (isShown)
          for (const stop of [...faceList, ...rimList]) stop.setAttribute('stop-opacity', '0')
        isShown = false
        return
      }
      const board = boardOf()
      const bounds = svg.getBoundingClientRect()
      const span = board.width + board.height
      const bandAtCenter =
        (bounds.left + bounds.width / 2 + bounds.top + bounds.height / 2) / span - sweep
      for (let i = 0; i < STOP_COUNT; i++) {
        const along = -1 + (2 * i) / (STOP_COUNT - 1)
        const x = bandAtCenter + (2 * along * (bounds.width / 2)) / span
        const band = sweepBand(x)
        faceList[i].setAttribute('stop-opacity', Math.min(SWEEP_MAX, band * SWEEP_FACE).toFixed(3))
        rimList[i].setAttribute('stop-opacity', Math.min(SWEEP_MAX, band * SWEEP_RIM).toFixed(3))
      }
      isShown = true
    }
    gsap.ticker.add(update)
    return () => gsap.ticker.remove(update)
  }, [hasGlint])

  const label = isDecorative
    ? { 'aria-hidden': true as const }
    : { role: 'img', 'aria-label': name }
  return (
    <svg
      ref={svgRef}
      className={[styles.swatch, className].filter(Boolean).join(' ')}
      viewBox={HEX_VIEW_BOX}
      {...label}
    >
      {glint && (
        <defs>
          <linearGradient
            ref={faceRef}
            id={id + 'f'}
            gradientUnits="userSpaceOnUse"
            x1={-1}
            y1={-1}
            x2={1}
            y2={1}
          >
            {stopIndexList.map(i => (
              <stop
                key={i}
                offset={(i / (STOP_COUNT - 1)).toFixed(4)}
                stopColor="#fff"
                stopOpacity={0}
              />
            ))}
          </linearGradient>
          <linearGradient
            ref={rimRef}
            id={id + 'r'}
            gradientUnits="userSpaceOnUse"
            x1={-1}
            y1={-1}
            x2={1}
            y2={1}
          >
            {stopIndexList.map(i => (
              <stop
                key={i}
                offset={(i / (STOP_COUNT - 1)).toFixed(4)}
                stopColor="#fff"
                stopOpacity={0}
              />
            ))}
          </linearGradient>
          <clipPath id={id + 'c'}>
            <polygon points={HEX_POINT} />
          </clipPath>
        </defs>
      )}
      <polygon points={HEX_POINT} fill={rgb(COLOR_NAME_RGB[name])} />
      {glint && (
        <>
          <polygon points={HEX_POINT} fill={`url(#${id}f)`} />
          <g clipPath={`url(#${id}c)`}>
            {RIM_LIST.map(([startX, startY, endX, endY, facing], i) => (
              <line
                key={i}
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke={`url(#${id}r)`}
                strokeOpacity={facing}
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        </>
      )}
    </svg>
  )
}

interface TargetSwatchProperty {
  targetColor: TargetColor
  className?: string
  glint?: () => boolean
}

// 課題色。2色のときは重ねて並べる
export function TargetSwatch({ targetColor, className, glint }: TargetSwatchProperty) {
  const nameList = targetColorListOf(targetColor)
  if (nameList.length === 1)
    return <Swatch name={nameList[0]} className={className} glint={glint} />
  return (
    <span
      className={[styles.hexList, className].filter(Boolean).join(' ')}
      role="img"
      aria-label={nameList.join(' and ')}
    >
      {nameList.map(name => (
        <Swatch key={name} name={name} isDecorative glint={glint} />
      ))}
    </span>
  )
}
