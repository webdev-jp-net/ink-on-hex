// スコア領域の表示を動かす（ScorePanel の中で使う）。数え上げ・CLEARの出し入れ・終了時の最終スコアの演出
// 何を出すかはプレイ画面が決め、ここは表示の動きだけを受け持つ
import { useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react'
import { gsap } from 'gsap'
import { hopIn } from '@/utils/hop'
import { POP } from '@/utils/pop'
import { ease, seconds } from '@/utils/motionToken'
import { POINT_LIST } from './game'

const OUT_BLUR = 8
// 段階のあいだの間（秒）
const COUNT_WAIT = 0.3
const EQUAL_SIGN_WAIT = 0.3
const FINAL_WAIT = 0.3
const BEST_WAIT = 0.3

interface Reveal {
  isEqualSignShown: boolean
  isFinalShown: boolean
  isBestShown: boolean
  isLeaving: boolean
}

// プレイ画面から表示を動かすための操作
export interface ScorePanelHandle {
  hideForIntro(isRespawning: boolean): void
  playIntro(isRespawning: boolean): void
  showPointList(countList: Record<number, number>): void
  showClear(isClearedNow: boolean, isFading: boolean): void
  countTargetColor(hitCount: number): void
  showFinal(
    countList: Record<number, number>,
    finalScore: number,
    isNewBest: boolean
  ): gsap.core.Timeline
  leave(): void
  reset(): void
  targetHex(): HTMLSpanElement | null
}

export function useScorePanel(ref: Ref<ScorePanelHandle>) {
  const targetHexRef = useRef<HTMLSpanElement>(null)
  const clearRef = useRef<HTMLSpanElement>(null)
  const targetColorCountTextRef = useRef<HTMLSpanElement>(null)
  const pointGridRef = useRef<HTMLDivElement>(null)
  const pointTextRef = useRef<Record<number, HTMLSpanElement | null>>({})
  const totalAmountRef = useRef<HTMLSpanElement>(null)
  const finalRef = useRef<HTMLSpanElement>(null)
  // 数え上げの途中の値。表示が遅れて現れても、今の値から出す
  const countedRef = useRef({ totalAmount: 0, final: 0 })
  const extraRef = useRef<HTMLSpanElement>(null)
  const trophyRef = useRef<HTMLSpanElement>(null)
  const targetColorCounter = useRef({ value: 0 })
  const [reveal, setReveal] = useState<Reveal | null>(null)

  useLayoutEffect(() => {
    if (reveal?.isBestShown && trophyRef.current) hopIn(trophyRef.current, 0)
  }, [reveal?.isBestShown])
  useLayoutEffect(() => {
    if (reveal?.isLeaving && extraRef.current)
      gsap.to(extraRef.current.children, {
        opacity: 0,
        duration: seconds('--duration-fade-out'),
        ease: 'none',
        onComplete: () => setReveal(null),
      })
  }, [reveal?.isLeaving])

  // 開いた直後の状態。点数表はぼかしておき、CLEARは消しておく。作り直した盤面では点数表を残す
  const hideForIntro = (isRespawning: boolean) => {
    if (!isRespawning && pointGridRef.current)
      gsap.set(pointGridRef.current, { opacity: 0, filter: 'blur(' + OUT_BLUR + 'px)' })
    gsap.set(clearRef.current, { opacity: 0 })
  }

  // 場面の切り替えが終わったら、ぼかしていた点数表を出す
  const playIntro = (isRespawning: boolean) => {
    if (!isRespawning && pointGridRef.current)
      gsap.to(pointGridRef.current, {
        opacity: 1,
        filter: 'blur(0px)',
        duration: POP.out(),
        ease,
      })
  }

  // 消えたセルを除いた点数表の行。リトライでタイルが落ちていくあいだに使う
  const showPointList = (countList: Record<number, number>) => {
    for (const point of POINT_LIST) {
      const node = pointTextRef.current[point]
      if (node) node.textContent = countList[point] ? String(point * countList[point]) : 'NNN'
    }
  }

  // CLEARの出し入れ。リトライで消えるときはフェードで消す
  const showClear = (isClearedNow: boolean, isFading: boolean) => {
    const mark = clearRef.current
    if (!mark) return
    gsap.killTweensOf(mark)
    if (isClearedNow) {
      const letterList = [...mark.children]
      gsap.set(mark, { opacity: 1 })
      gsap.killTweensOf(letterList)
      hopIn(letterList, seconds('--duration-stagger'))
    } else if (isFading)
      gsap.to(mark, { opacity: 0, duration: seconds('--duration-fade-out'), ease: 'none' })
    else gsap.set(mark, { opacity: 0 })
  }

  // 課題色のセル数を数え上げる
  const countTargetColor = (hitCount: number) => {
    gsap.killTweensOf(targetColorCounter.current)
    gsap.to(targetColorCounter.current, {
      value: hitCount,
      duration: seconds('--duration-count'),
      ease: 'power2.out',
      onUpdate: () => {
        if (targetColorCountTextRef.current)
          targetColorCountTextRef.current.textContent = String(
            Math.round(targetColorCounter.current.value)
          )
      },
    })
  }

  // 最終スコア。各行を数え上げ、課題色のセル数 × 単純合計 = 最終スコア。止められるようにタイムラインを返す
  const showFinal = (
    countList: Record<number, number>,
    finalScore: number,
    isNewBest: boolean
  ): gsap.core.Timeline => {
    setReveal({
      isEqualSignShown: false,
      isFinalShown: false,
      isBestShown: false,
      isLeaving: false,
    })
    countedRef.current = { totalAmount: 0, final: 0 }
    const countSeconds = seconds('--duration-count')
    const row = { value: 0 }
    const counter = { value: 0 }
    const timeline = gsap
      .timeline({ delay: COUNT_WAIT })
      .to(row, {
        value: 1,
        duration: countSeconds,
        ease: 'power2.out',
        onUpdate: () => {
          let running = 0
          for (const point of POINT_LIST) {
            const value = Math.round(row.value * point * countList[point])
            running += value
            const node = pointTextRef.current[point]
            if (node) node.textContent = String(value)
          }
          countedRef.current.totalAmount = running
          if (totalAmountRef.current) totalAmountRef.current.textContent = String(running)
        },
      })
      .call(
        () => setReveal(now => now && { ...now, isEqualSignShown: true }),
        [],
        '+=' + EQUAL_SIGN_WAIT
      )
      .call(() => setReveal(now => now && { ...now, isFinalShown: true }), [], '+=' + FINAL_WAIT)
      .to(counter, {
        value: finalScore,
        duration: countSeconds,
        ease: 'power2.out',
        onUpdate: () => {
          countedRef.current.final = Math.round(counter.value)
          if (finalRef.current) finalRef.current.textContent = String(countedRef.current.final)
        },
      })
    if (isNewBest)
      timeline.call(
        () => setReveal(now => now && { ...now, isBestShown: true }),
        [],
        '+=' + BEST_WAIT
      )
    return timeline
  }

  // リトライで、最終スコアの部分を消しはじめる
  const leave = () => {
    if (reveal) setReveal(now => now && { ...now, isLeaving: true })
  }

  // リトライ後の盤面に合わせて、数を初めの状態に戻す
  const reset = () => {
    targetColorCounter.current.value = 0
    if (targetColorCountTextRef.current) targetColorCountTextRef.current.textContent = '0'
    for (const point of POINT_LIST) {
      const node = pointTextRef.current[point]
      if (node) node.textContent = 'NNN'
    }
    setReveal(null)
  }

  useImperativeHandle(ref, () => ({
    hideForIntro,
    playIntro,
    showPointList,
    showClear,
    countTargetColor,
    showFinal,
    leave,
    reset,
    targetHex: () => targetHexRef.current,
  }))

  return {
    targetHexRef,
    clearRef,
    targetColorCountTextRef,
    pointGridRef,
    pointTextRef,
    totalAmountRef,
    finalRef,
    countedRef,
    extraRef,
    trophyRef,
    reveal,
  }
}
