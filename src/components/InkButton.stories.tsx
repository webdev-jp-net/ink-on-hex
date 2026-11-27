import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { INK_LIST } from '@/game/core'
import { rgb } from '@/game/color'
import { InkButton } from './InkButton'

// インクを選ぶボタン
const meta = {
  title: 'Components/InkButton',
  component: InkButton,
  args: {
    label: INK_LIST[0].name,
    color: rgb(INK_LIST[0].rgb),
    isSelected: true,
    onClick: fn(),
  },
} satisfies Meta<typeof InkButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

// 終了して選べないとき
export const Done: Story = { args: { disabled: true } }

export const Palette: Story = {
  render: args => (
    <div style={{ display: 'flex' }}>
      {INK_LIST.map((ink, i) => (
        <InkButton
          key={ink.name}
          label={ink.name}
          color={rgb(ink.rgb)}
          isSelected={i === 0}
          onClick={args.onClick}
        />
      ))}
    </div>
  ),
}
