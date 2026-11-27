import type { Meta, StoryObj } from '@storybook/react-vite'
import { COLOR_NAME_LIST } from '@/game/color'
import { Swatch, TargetSwatch } from './Swatch'

// 色名のヘックス。課題色の光り（glint）は盤面と同じ光が走るため、盤面のない場では出さない
const meta = {
  title: 'Components/Swatch',
  component: Swatch,
  args: { name: 'Cyan' },
  argTypes: { name: { control: 'select', options: COLOR_NAME_LIST } },
  decorators: [
    Story => (
      <div style={{ blockSize: 56 }}>
        <style>{`.sample, .sample > span{display:flex} .sample svg{block-size:56px} .sample{--swatch-overlap:calc(24px - 56px * 2 / 1.7321)}`}</style>
        <div className="sample">
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof Swatch>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

// 課題色が2色のときは重ねる
export const TwoColorTarget: Story = {
  render: () => <TargetSwatch targetColor={['Azure', 'Violet']} />,
}

export const All: Story = {
  decorators: [
    Story => (
      <div>
        <style>{`.all svg{block-size:32px}`}</style>
        <div className="all">
          <Story />
        </div>
      </div>
    ),
  ],
  render: () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, auto)',
        gap: 'var(--spacing-md)',
        fontSize: 'var(--font-size-mark)',
        color: 'var(--txt-muted)',
      }}
    >
      {COLOR_NAME_LIST.map(name => (
        <figure key={name} style={{ margin: 0, display: 'grid', justifyItems: 'center' }}>
          <Swatch name={name} isDecorative />
          {name}
        </figure>
      ))}
    </div>
  ),
}
