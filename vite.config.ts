import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// ビルドに含めるのはゲーム本体（index.html）だけ。ステージメーカー（maker.html）は開発サーバーでだけ開く
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
