import { defineConfig } from '@playwright/test'

// WebGL をヘッドレスで動かすため、ソフトウェア描画（SwiftShader）を使う。描画が遅いので待ち時間は長めに取る
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'e2e/out/result',
  timeout: 240_000,
  expect: { timeout: 30_000 },
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    // CHROME_PATH があれば、そのブラウザを使う（未設定なら Playwright の Chromium）
    launchOptions: {
      executablePath: process.env.CHROME_PATH,
      args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: [
    // ゲーム本体はビルドしたものを確かめる
    {
      name: 'game',
      command: 'bunx vite build && bunx vite preview --port 4173 --strictPort --host 127.0.0.1',
      url: 'http://127.0.0.1:4173/index.html',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    // ステージメーカーはビルドに含めないので、開発サーバーで確かめる
    {
      name: 'maker',
      command: 'bunx vite --port 4174 --strictPort --host 127.0.0.1',
      url: 'http://127.0.0.1:4174/maker.html',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
