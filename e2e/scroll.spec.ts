import { expect, test, type Page } from '@playwright/test'
import { collectError, PHONE, waitIdle } from './harness'

// スクロールの動き（scrollMotion）は、開発サーバーで読み込んでブラウザの中で動かす
// 盤面の描画が重い環境では、実際の指の速さを再現できないため
const DEV_URL = 'http://127.0.0.1:4174/maker.html'
const MAX = 1000

interface Step {
  kind: 'flick' | 'slow' | 'pull' | 'wheel'
  startY: number
  delta: number
  frameCount?: number
  waitMs: number
}

// 動かした結果: 離したときの位置、その後の最大・最小、最後の位置、止まったか
function runMotion(page: Page, step: Step) {
  return page.evaluate(
    async ({ step, max }) => {
      // 開発サーバーが配るモジュールを読む（型は src 側から取る）
      const modulePath = '/src/lib/scrollMotion.ts'
      const { createScrollMotion }: typeof import('../src/lib/scrollMotion') = await import(
        modulePath
      )
      const trace: number[] = []
      const motion = createScrollMotion(
        () => max,
        () => trace.push(motion.y)
      )
      motion.set(step.startY)
      let now = performance.now()
      if (step.kind === 'wheel') {
        motion.wheel(step.delta)
        motion.idle()
      } else {
        motion.press(now)
        for (let i = 0; i < (step.frameCount ?? 1); i++) motion.drag(step.delta, (now += 16))
        // ゆっくり離すときは、最後に動かしてから間を置く
        motion.release(step.kind === 'slow' ? now + 200 : now + 1)
      }
      const released = motion.y
      await new Promise(resolve => setTimeout(resolve, step.waitMs))
      return {
        released,
        highest: Math.max(released, ...trace),
        lowest: Math.min(released, ...trace),
        end: motion.y,
        moving: motion.moving(),
      }
    },
    { step, max: MAX }
  )
}

test.describe('スクロールの動き', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEV_URL)
  })

  test('端へ強くはじいても、端を越えずに端で止まる', async ({ page }) => {
    // 離した時点ではまだ端の手前
    const result = await runMotion(page, {
      kind: 'flick',
      startY: MAX - 400,
      delta: 40,
      frameCount: 5,
      waitMs: 4000,
    })
    expect(result.released).toBeLessThan(MAX)
    expect(result.highest).toBeLessThanOrEqual(MAX)
    expect(result.end).toBeCloseTo(MAX, 3)
    expect(result.moving).toBe(false)
  })

  test('端を越えて引っぱると効きが弱まり、離すと端に戻る', async ({ page }) => {
    const result = await runMotion(page, {
      kind: 'pull',
      startY: 0,
      delta: -100,
      frameCount: 2,
      waitMs: 1000,
    })
    expect(result.released).toBeCloseTo(-135, 3)
    expect(result.end).toBeCloseTo(0, 3)
  })
})

test.describe('一覧のスクロール', () => {
  test.use(PHONE)

  // 指の入力を送る
  async function touchDrag(page: Page, fromY: number, toY: number) {
    const client = await page.context().newCDPSession(page)
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: 195, y: fromY }],
    })
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: 195, y: toY }],
    })
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await client.detach()
  }
  function scrollY(page: Page) {
    return page
      .getByTestId('scroll')
      .evaluate(node => Math.abs(new DOMMatrixReadOnly(getComputedStyle(node).transform).m42))
  }

  test('コレクションで、指とホイールの入力でスクロールし、上端を越えると戻る', async ({ page }) => {
    const errorList = collectError(page)
    await page.goto('/')
    await waitIdle(page)
    await page.getByRole('button', { name: 'Collection', exact: true }).click()
    await waitIdle(page)
    await touchDrag(page, 600, 400)
    await expect.poll(() => scrollY(page)).toBeGreaterThan(100)
    await page.mouse.move(195, 400)
    const before = await scrollY(page)
    await page.mouse.wheel(0, 120)
    await expect.poll(() => scrollY(page)).toBeGreaterThan(before)
    // 一瞬で送るタッチは、はじく勢いが実行ごとにぶれて下端まで流れることがある。上端に届くまで引き下ろす
    for (let i = 0; i < 5 && (await scrollY(page)) > 0; i++) {
      await touchDrag(page, 200, 800)
      await page.waitForTimeout(1500)
    }
    await expect.poll(() => scrollY(page)).toBe(0)
    expect(errorList).toEqual([])
  })
})
