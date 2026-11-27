import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { ICON_NAME_LIST } from './Icon'
import { IconButton } from './IconButton'

// アイコンのボタン。PCレイアウト（幅900px以上かつ横長）では名前を横に添える
const meta = {
  title: 'Components/IconButton',
  component: IconButton,
  args: { icon: 'retry', label: 'Retry', onClick: fn() },
  argTypes: { icon: { control: 'select', options: ICON_NAME_LIST } },
} satisfies Meta<typeof IconButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Disabled: Story = { args: { icon: 'undo', label: 'Undo', disabled: true } }

// PCレイアウトでも名前を添えない（アトリエの undo・redo）
export const Compact: Story = { args: { icon: 'redo', label: 'Redo', isCompact: true } }

export const Wide: Story = {
  globals: { viewport: { value: 'wide' } },
  args: { icon: 'back', label: 'Back' },
}
