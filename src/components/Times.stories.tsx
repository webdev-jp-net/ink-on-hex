import type { Meta, StoryObj } from '@storybook/react-vite'
import { Times } from './Times'

// 数の式（× N）
const meta = {
  title: 'Components/Times',
  component: Times,
  args: { children: <span>12</span>, label: '12' },
} satisfies Meta<typeof Times>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

// 補助の情報として灰の行に置いたとき
export const Muted: Story = {
  render: args => (
    <div style={{ color: 'var(--txt-muted)' }}>
      <Times {...args} />
    </div>
  ),
}
