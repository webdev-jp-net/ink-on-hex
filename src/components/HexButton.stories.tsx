import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { HexButton } from './HexButton'

// ヘックスの両端だけを描いたボタン。ホームの入口
const meta = {
  title: 'Components/HexButton',
  component: HexButton,
  args: { label: 'Mission', onClick: fn() },
} satisfies Meta<typeof HexButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Menu: Story = {
  render: args => (
    <nav style={{ display: 'inline-flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {['Mission', 'Atelier', 'Collection'].map(label => (
        <HexButton key={label} label={label} onClick={args.onClick} />
      ))}
    </nav>
  ),
}
