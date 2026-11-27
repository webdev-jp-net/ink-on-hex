import type { Meta, StoryObj } from '@storybook/react-vite'
import { DropletIcon, Icon, ICON_NAME_LIST, TimesIcon } from './Icon'

// 記号は絵文字や文字で代用せず、アイコンとして描く（design.md「形」）
const meta = {
  title: 'Components/Icon',
  component: Icon,
  args: { name: 'back' },
  argTypes: {
    name: { control: 'select', options: ICON_NAME_LIST },
  },
  decorators: [
    Story => (
      <span
        style={{ display: 'inline-block', inlineSize: 32, blockSize: 32, fill: 'var(--txt-basic)' }}
      >
        <Story />
      </span>
    ),
  ],
} satisfies Meta<typeof Icon>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

// 一覧。灰（補助の情報）の色で並べる
export const All: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--spacing-md)', color: 'var(--txt-muted)' }}>
      {ICON_NAME_LIST.map(name => (
        <figure
          key={name}
          style={{ margin: 0, textAlign: 'center', fontSize: 'var(--font-size-mark)' }}
        >
          <span style={{ display: 'block', inlineSize: 32, blockSize: 32, fill: 'currentcolor' }}>
            <Icon name={name} />
          </span>
          {name}
        </figure>
      ))}
      <figure style={{ margin: 0, textAlign: 'center', fontSize: 'var(--font-size-mark)' }}>
        <span
          style={{
            display: 'grid',
            placeItems: 'center',
            inlineSize: 32,
            blockSize: 32,
          }}
        >
          <TimesIcon />
        </span>
        times
      </figure>
      <figure style={{ margin: 0, textAlign: 'center', fontSize: 'var(--font-size-mark)' }}>
        <span style={{ display: 'grid', placeItems: 'center', inlineSize: 32, blockSize: 32 }}>
          <span
            style={{
              display: 'block',
              blockSize: 24,
              aspectRatio: '40 / 56',
              fill: 'currentcolor',
            }}
          >
            <DropletIcon />
          </span>
        </span>
        droplet
      </figure>
    </div>
  ),
}
