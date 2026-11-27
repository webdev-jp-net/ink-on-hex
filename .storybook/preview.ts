// ゲームと同じ土台（フォント・CSS変数・リセット）で部品を表示する
import type { Preview } from '@storybook/react-vite'
import '../src/styles/font'
import '../src/styles/index.scss'

const preview: Preview = {
  parameters: {
    layout: 'centered',
    backgrounds: { disable: true },
    viewport: {
      options: {
        phone: { name: 'スマートフォン（390×844）', styles: { width: '390px', height: '844px' } },
        wide: { name: 'PC（1280×800）', styles: { width: '1280px', height: '800px' } },
      },
    },
  },
}

export default preview
