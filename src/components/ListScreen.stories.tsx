import { useCallback, type ReactNode } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { enter, mount } from '@/lib/board/engine'
import { homeCamera } from '@/lib/board/geometry'
import { EMPTY } from '@/lib/board/scene'
import { ListScreen } from './ListScreen'

// スクロールは盤面と同じフレームで反映するため、空の盤面を後ろに置いて毎フレームの処理を動かす
function Board({ children }: { children: ReactNode }) {
  const attach = useCallback((canvas: HTMLCanvasElement) => {
    const unmount = mount(canvas)
    void enter({ camera: homeCamera(), focus: [0, 0], cell: () => EMPTY, colored: () => false })
    return unmount
  }, [])
  return (
    <>
      <canvas
        ref={attach}
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, inlineSize: '100%', blockSize: '100%' }}
      />
      {children}
    </>
  )
}

// 一覧画面の枠。見出し・スクロールする本文・フッター。中身が見出しの下に潜るとすりガラスになる
const meta = {
  title: 'Components/ListScreen',
  component: ListScreen,
  parameters: { layout: 'fullscreen' },
  decorators: [
    Story => (
      <Board>
        <Story />
      </Board>
    ),
  ],
  args: {
    title: 'Collection',
    children: Array.from({ length: 24 }, (_, i) => (
      <div
        key={i}
        style={{
          blockSize: 64,
          borderBottom: '1px solid var(--border-basic)',
          alignContent: 'center',
        }}
      >
        Row {i + 1}
      </div>
    )),
  },
} satisfies Meta<typeof ListScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Phone: Story = { globals: { viewport: { value: 'phone' } } }

export const Wide: Story = { globals: { viewport: { value: 'wide' } } }

// スクロールした位置から始める（見出しのすりガラスを確かめる）
export const Scrolled: Story = {
  globals: { viewport: { value: 'phone' } },
  args: { initialY: 200 },
}
