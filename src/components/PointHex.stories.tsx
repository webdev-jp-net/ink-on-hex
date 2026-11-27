import type { Meta, StoryObj } from '@storybook/react-vite'
import { PointHex } from './PointHex'

// 点数の印
const meta = {
  title: 'Components/PointHex',
  component: PointHex,
  args: { point: 6 },
  argTypes: { point: { control: { type: 'range', min: 1, max: 6, step: 1 } } },
} satisfies Meta<typeof PointHex>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const All: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
      {[6, 5, 4, 3, 2, 1].map(point => (
        <PointHex key={point} point={point} />
      ))}
    </div>
  ),
}
