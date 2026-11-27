// UIのカタログ。ゲームの画面の部品と、デザインの基礎（色・文字・余白・形・アイコン・動き）を並べる
import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx'],
  framework: '@storybook/react-vite',
  // 利用状況を外部に送らない
  core: { disableTelemetry: true },
}

export default config
