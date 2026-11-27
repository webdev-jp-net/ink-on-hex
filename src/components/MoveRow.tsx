// 手数の列。使ったインクの色で埋まり、次に垂らす1滴は大きく浮く
import { useId, useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { mixRGB, rgb, type RGB } from '@/game/color'
import { uncoloredRGB } from '@/utils/colorToken'
import { ease, seconds } from '@/utils/motionToken'
import { DROPLET_PATH } from './Icon'
import styles from './MoveRow.module.scss'

export interface DropletState {
  color: RGB | null
  isCurrent: boolean
}

const DROPLET_HEIGHT = 24
const CURRENT_HEIGHT = 48
const RISE = 4
const GAP = 8
const INTRO_WAIT = 0.5

const sizeOf = (isCurrent: boolean) => {
  const height = isCurrent ? CURRENT_HEIGHT : DROPLET_HEIGHT
  return { inlineSize: (height * 40) / 56, blockSize: height }
}
const fillOf = (color: RGB | null) => (color ? rgb(color) : rgb(uncoloredRGB()))

// 次の1滴の下の影。インクの色を映す
function Shadow({ color }: { color: RGB }) {
  const id = useId().replace(/[^\w-]/g, '')
  const lightColor = mixRGB(color, [255, 255, 255], 0.55)
  const darkColor = mixRGB(color, [0, 0, 0], 0.45)
  return (
    <svg viewBox="0 0 48 16" aria-hidden="true">
      <defs>
        <radialGradient id={id + 'g'}>
          <stop offset="0" stopColor={lightColor} stopOpacity=".95" />
          <stop offset=".2" stopColor={lightColor} stopOpacity=".55" />
          <stop offset=".45" stopColor={darkColor} stopOpacity=".12" />
          <stop offset=".72" stopColor={darkColor} stopOpacity=".2" />
          <stop offset="1" stopColor={darkColor} stopOpacity="0" />
        </radialGradient>
        <filter id={id + 'f'} x="-20%" y="-60%" width="140%" height="220%">
          <feGaussianBlur stdDeviation=".9" />
        </filter>
      </defs>
      <ellipse cx="24" cy="8" rx="20" ry="5.5" fill={`url(#${id}g)`} filter={`url(#${id}f)`} />
    </svg>
  )
}

interface Item extends DropletState {
  id: number
  isLeaving: boolean
  isAppearing: boolean
}

function Droplet({
  item,
  isHidden,
  onRemoved,
}: {
  item: Item
  isHidden: boolean
  onRemoved: (id: number) => void
}) {
  const wrapRef = useRef<HTMLSpanElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const shadowRef = useRef<HTMLSpanElement>(null)
  const previous = useRef<DropletState | null>(null)
  const [shadowColor, setShadowColor] = useState<RGB | null>(null)

  // 外れるとき（開発時の StrictMode の付け直しを含む）は、GSAP が付けた大きさと色も外れる。
  // 次に付くときに最初の状態から付け直すよう、前回の状態を忘れる
  useLayoutEffect(
    () => () => {
      previous.current = null
    },
    []
  )

  useGSAP(() => {
    const duration = seconds('--duration-move')
    if (!previous.current) {
      gsap.set(svgRef.current, sizeOf(false))
      gsap.set(pathRef.current, { fill: fillOf(null) })
      gsap.set(shadowRef.current, { opacity: 0 })
      if (isHidden || item.isAppearing) gsap.set(wrapRef.current, { opacity: 0, y: -RISE })
      if (item.isAppearing) {
        gsap.set(svgRef.current, { inlineSize: 0, blockSize: 0 })
        gsap.set(wrapRef.current, { marginInlineStart: -GAP })
        gsap.to(wrapRef.current, { opacity: 1, y: 0, marginInlineStart: 0, duration, ease })
        gsap.to(svgRef.current, { ...sizeOf(false), duration, ease })
      }
      previous.current = { color: null, isCurrent: false }
    }
    const before = previous.current
    if (item.isLeaving) {
      gsap.to(svgRef.current, { inlineSize: 0, blockSize: 0, duration, ease })
      gsap.to(wrapRef.current, {
        opacity: 0,
        marginInlineStart: -GAP,
        duration,
        ease,
        onComplete: () => onRemoved(item.id),
      })
      return
    }
    if (item.color !== before.color || (item.isCurrent && !before.isCurrent)) {
      gsap.to(pathRef.current, { fill: fillOf(item.color), duration, ease })
      if (item.color) setShadowColor(item.color)
    }
    if (item.isCurrent !== before.isCurrent) {
      gsap.to(svgRef.current, { ...sizeOf(item.isCurrent), duration, ease })
      gsap.to(shadowRef.current, { opacity: item.isCurrent ? 1 : 0, duration, ease })
    }
    previous.current = { color: item.color, isCurrent: item.isCurrent }
  }, [item.color, item.isCurrent, item.isLeaving])

  return (
    <span
      ref={wrapRef}
      className={[styles.droplet, item.isCurrent ? styles.current : ''].join(' ')}
      data-droplet
    >
      <svg ref={svgRef} className={styles.icon} viewBox="0 0 40 56">
        <path ref={pathRef} d={DROPLET_PATH} />
      </svg>
      <span ref={shadowRef} className={styles.shadow}>
        {shadowColor && <Shadow color={shadowColor} />}
      </span>
    </span>
  )
}

interface MoveRowProperty {
  stateList: DropletState[]
  // 開いた直後は、空の列を並べてから色を入れる
  isIntro: boolean
  // 並べる演出を始める
  isPlayIntro: boolean
  onIntroDone: () => void
  label?: string
}

export function MoveRow({ stateList, isIntro, isPlayIntro, onIntroDone, label }: MoveRowProperty) {
  const rowRef = useRef<HTMLSpanElement>(null)
  const sequence = useRef(stateList.length)
  const hasIntroStarted = useRef(false)
  const makeItem = (isAppearing: boolean): Item => ({
    id: sequence.current++,
    color: null,
    isCurrent: false,
    isLeaving: false,
    isAppearing,
  })
  const [itemList, setItemList] = useState<Item[]>(() =>
    stateList.map((_, id) => ({
      id,
      color: null,
      isCurrent: false,
      isLeaving: false,
      isAppearing: false,
    }))
  )

  // 表示中は stateList に合わせる。数が減ったら余りを消し、増えたら足す
  const [lastList, setLastList] = useState<DropletState[] | null>(null)
  if (!isIntro && stateList !== lastList) {
    setLastList(stateList)
    setItemList(list => {
      const alive = list.filter(item => !item.isLeaving)
      const next = alive.map((item, i) =>
        i < stateList.length ? { ...item, ...stateList[i] } : { ...item, isLeaving: true }
      )
      for (let i = alive.length; i < stateList.length; i++)
        next.push({ ...makeItem(true), ...stateList[i] })
      return [...list.filter(item => item.isLeaving), ...next]
    })
  }

  useLayoutEffect(() => {
    if (!isIntro || !isPlayIntro || hasIntroStarted.current || !rowRef.current) return
    hasIntroStarted.current = true
    gsap.to(rowRef.current.querySelectorAll('[data-droplet]'), {
      opacity: 1,
      y: 0,
      duration: seconds('--duration-move'),
      ease,
      stagger: seconds('--duration-stagger'),
      onComplete: () => {
        gsap.delayedCall(INTRO_WAIT, onIntroDone)
      },
    })
  })

  return (
    <span ref={rowRef} className={styles.row} role={label ? 'img' : undefined} aria-label={label}>
      {itemList.map(item => (
        <Droplet
          key={item.id}
          item={item}
          isHidden={isIntro}
          onRemoved={id => setItemList(list => list.filter(one => one.id !== id))}
        />
      ))}
    </span>
  )
}
