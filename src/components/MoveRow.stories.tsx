import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { INK_LIST } from '@/game/core'
import { MoveRow, type DropletState } from './MoveRow'

// 手数の列。使ったインクの色で埋まり、次に垂らす1滴は大きく浮く
const CYAN = INK_LIST[0].rgb
const MAGENTA = INK_LIST[1].rgb

const meta = {
  title: 'Components/MoveRow',
  component: MoveRow,
  args: { isIntro: false, isPlayIntro: true, onIntroDone: fn() },
} satisfies Meta<typeof MoveRow>

export default meta
type Story = StoryObj<typeof meta>

const freshList: DropletState[] = [
  { color: CYAN, isCurrent: true },
  { color: null, isCurrent: false },
  { color: null, isCurrent: false },
]

// ミッションを始めたところ（残り3手）
export const Start: Story = { args: { stateList: freshList, label: '3 moves left' } }

// 1手使ったところ
export const Played: Story = {
  args: {
    stateList: [
      { color: CYAN, isCurrent: false },
      { color: MAGENTA, isCurrent: true },
      { color: null, isCurrent: false },
    ],
    label: '2 moves left',
  },
}

// 手数を使い切ったところ
export const Done: Story = {
  args: {
    stateList: [
      { color: CYAN, isCurrent: false },
      { color: MAGENTA, isCurrent: false },
      { color: CYAN, isCurrent: false },
    ],
    label: '0 moves left',
  },
}
