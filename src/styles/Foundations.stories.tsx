// デザインの基礎（design.md）。色・文字・余白・形・動きを、src/styles/index.scss のCSS変数から読んで並べる
import { useRef, type CSSProperties, type ReactNode } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { gsap } from 'gsap'
import { INK_LIST, type TargetColor } from '@/game/core'
import { rgb } from '@/game/color'
import { HexButton } from '@/components/HexButton'
import { TimesIcon } from '@/components/Icon'
import { PointHex } from '@/components/PointHex'
import { Swatch, TargetSwatch } from '@/components/Swatch'
import { hopIn } from '@/utils/hop'
import { seconds } from '@/utils/motionToken'
import { popIn } from '@/utils/pop'

const meta = {
  title: 'Foundations',
  parameters: { layout: 'padded' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const valueOf = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

const captionStyle: CSSProperties = { fontSize: 'var(--font-size-mark)', color: 'var(--txt-muted)' }

function Row({ name, note, children }: { name: string; note: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '200px 1fr',
        gap: 'var(--spacing-md)',
        alignItems: 'center',
        padding: 'var(--spacing-sm) 0',
        borderBottom: '1px solid var(--border-basic)',
      }}
    >
      <div>
        <code>{name}</code>
        <div style={captionStyle}>{note}</div>
      </div>
      <div>{children}</div>
    </div>
  )
}

// 画面の部品は無彩色だけで作り、色はインク（ゲームの中身）にだけ使う
const COLOR_LIST = [
  ['--bg-basic', '背景'],
  ['--bg-cell', 'セル'],
  ['--txt-basic', '黒（文字）。結果や到達を示す要素'],
  ['--txt-muted', '灰（補助の情報）。経過や補助の情報'],
  ['--border-basic', '線'],
] as const

export const Color: Story = {
  render: () => (
    <div>
      {COLOR_LIST.map(([name, note]) => (
        <Row key={name} name={name} note={note}>
          <span style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
            <span
              style={{
                inlineSize: 48,
                blockSize: 24,
                background: `var(${name})`,
                border: '1px solid var(--border-basic)',
              }}
            />
            <code>{valueOf(name)}</code>
          </span>
        </Row>
      ))}
      {INK_LIST.map(ink => (
        <Row key={ink.name} name={ink.name} note="インク">
          <span style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
            <span style={{ inlineSize: 48, blockSize: 24, background: rgb(ink.rgb) }} />
            <code>{rgb(ink.rgb)}</code>
          </span>
        </Row>
      ))}
    </div>
  ),
}

// 大きさは役割で決める。数字は等幅。文字は大文字の高さで切り詰める（太さは画面での使い方に合わせて示す）
const TYPE_LIST = [
  ['--font-size-mark', '小さな印（CLEAR、点数の印の数字）', 'CLEAR 123', 400],
  ['--font-size-body', '本文とカウント', 'Mission 3', 400],
  ['--font-size-color-name', 'コレクションの色名', 'Spring Green', 600],
  ['--font-size-heading', '画面の見出し', 'COLLECTION', 600],
  ['--font-size-result', '到達の結果（最終スコア）', '13257', 400],
  ['--font-size-title', 'タイトル', 'INK on HEX', 600],
] as const

export const Typography: Story = {
  render: () => (
    <div>
      {TYPE_LIST.map(([name, note, sample, weight]) => (
        <Row key={name} name={name} note={note + '・' + valueOf(name)}>
          <span
            style={{
              display: 'inline-block',
              fontSize: `var(${name})`,
              fontWeight: weight,
              whiteSpace: 'nowrap',
              textBox: 'trim-both cap alphabetic',
              outline: '1px solid var(--border-basic)',
            }}
          >
            {sample}
          </span>
        </Row>
      ))}
      <Row name="TimesIcon" note="記号は文字で代用せず、アイコンで描く">
        <span
          style={{
            display: 'flex',
            gap: 'var(--spacing-xs)',
            alignItems: 'center',
            color: 'var(--txt-muted)',
          }}
        >
          <TimesIcon />
          <span>3</span>
        </span>
      </Row>
    </div>
  ),
}

// 8pxを単位にする。同じまとまりの中で詰めるときだけ4px
const SPACING_LIST = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'].map(size => '--spacing-' + size)

export const Spacing: Story = {
  render: () => (
    <div>
      {SPACING_LIST.map(name => (
        <Row key={name} name={name} note={valueOf(name)}>
          <span
            style={{
              display: 'block',
              inlineSize: `var(${name})`,
              blockSize: 16,
              background: 'var(--txt-muted)',
            }}
          />
        </Row>
      ))}
    </div>
  ),
}

// ヘックスを共通の形にする（セル、課題色、点数の印、ホームのタイル、一覧のサムネイル）
const TWO_COLOR_TARGET: TargetColor = ['Azure', 'Violet']

export const Shape: Story = {
  render: () => (
    <div>
      <Row name="Swatch" note="色名のヘックス">
        <span style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          {INK_LIST.map(ink => (
            <Swatch key={ink.name} name={ink.name} className="swatch" />
          ))}
        </span>
      </Row>
      <Row name="TargetSwatch" note="課題色。2色のときは重ねる">
        <span className="targetColor">
          <TargetSwatch targetColor={TWO_COLOR_TARGET} />
        </span>
      </Row>
      <Row name="PointHex" note="点数の印">
        <span style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          {[1, 2, 3, 4, 5, 6].map(point => (
            <PointHex key={point} point={point} />
          ))}
        </span>
      </Row>
    </div>
  ),
  decorators: [
    Story => (
      <div>
        <style>{`.swatch{block-size:32px} .targetColor{display:flex} .targetColor svg{block-size:56px} .targetColor{--swatch-overlap:calc(24px - 56px * 2 / 1.7321)}`}</style>
        <Story />
      </div>
    ),
  ],
}

const DURATION_LIST = [
  ['--duration-stagger', '複数の要素を順に出すずらし'],
  ['--duration-ring', '広がりが1段進む間隔'],
  ['--duration-fade-out', '消す（現れるときより短くする）'],
  ['--duration-color', '盤面の色の切り替え'],
  ['--duration-pulse', 'セルの膨らみ'],
  ['--duration-fade-in', '画面の中身が現れる'],
  ['--duration-spawn', 'タイルの登場'],
  ['--duration-move', '手数の列・点数表の出入り'],
  ['--duration-zoom', '盤面の寄り引き'],
  ['--duration-count', 'カウントアップ'],
] as const

function MotionDemo() {
  const dotRef = useRef<HTMLSpanElement>(null)
  const letterRef = useRef<HTMLSpanElement>(null)
  return (
    <div style={{ display: 'flex', gap: 'var(--spacing-xl)', alignItems: 'center' }}>
      <HexButton
        label="popIn"
        onClick={() => {
          if (dotRef.current) popIn([...dotRef.current.children])
        }}
      />
      <span ref={dotRef} style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
        {INK_LIST.map(ink => (
          <span
            key={ink.name}
            style={{ inlineSize: 16, blockSize: 16, borderRadius: '50%', background: rgb(ink.rgb) }}
          />
        ))}
      </span>
      <HexButton
        label="hopIn"
        onClick={() => {
          if (!letterRef.current) return
          const letterList = [...letterRef.current.children]
          gsap.killTweensOf(letterList)
          hopIn(letterList, seconds('--duration-stagger'))
        }}
      />
      <span ref={letterRef} style={{ fontSize: 'var(--font-size-mark)' }}>
        {[...'CLEAR'].map((letter, i) => (
          <span key={i} style={{ display: 'inline-block' }}>
            {letter}
          </span>
        ))}
      </span>
    </div>
  )
}

// 登場は行き過ぎてから落ち着かせる
export const Motion: Story = {
  render: () => (
    <div>
      <Row name="--ease-standard" note="標準のイージング">
        <code>{valueOf('--ease-standard')}</code>
      </Row>
      {DURATION_LIST.map(([name, note]) => (
        <Row key={name} name={name} note={note}>
          <code>{valueOf(name)}</code>
        </Row>
      ))}
      <Row name="popIn / hopIn" note="大きくなってから戻る / 跳ねてから着地する">
        <MotionDemo />
      </Row>
    </div>
  ),
}
