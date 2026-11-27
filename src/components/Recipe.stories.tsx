import type { Meta, StoryObj } from '@storybook/react-vite'
import { COLOR_NAME_LIST } from '@/game/color'
import { Recipe } from './Recipe'

// レシピ。6つの点で、色名を作るインクの配合を示す
const meta = {
  title: 'Components/Recipe',
  component: Recipe,
  args: { name: 'Dark Cobalt' },
  argTypes: { name: { control: 'select', options: COLOR_NAME_LIST } },
} satisfies Meta<typeof Recipe>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

// まだ作っていない色
export const Unknown: Story = { args: { name: null } }
