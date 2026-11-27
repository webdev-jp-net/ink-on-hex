import { expect, test } from '@playwright/test'
import {
  back,
  collectError,
  dropAt,
  footLabelList,
  openMission,
  OUT,
  PHONE,
  playMission1,
  scoreText,
  waitIdle,
} from './harness'

test.describe('スマートフォン', () => {
  test.use(PHONE)

  test('ベスト再生で同じスコアが再現され、再生中の盤面タップは無視される', async ({ page }) => {
    const errorList = collectError(page)
    await page.goto('/')
    await openMission(page, 0)
    await playMission1(page)
    await expect.poll(() => scoreText(page)).toMatch(/= \d+ /)
    await page.waitForTimeout(3000)
    const played = await scoreText(page)
    await page.getByRole('button', { name: 'Retry' }).dispatchEvent('click')
    await expect.poll(() => footLabelList(page)).toEqual(['Best score'])
    await page.getByRole('button', { name: 'Best score' }).dispatchEvent('click')
    await expect.poll(() => footLabelList(page)).toEqual(['Retry'])
    // 1手ごとの垂らし終わりと次の手の間にも当たるよう、再生のあいだ叩き続ける
    for (let i = 0; i < 30; i++) {
      await page.mouse.click(195, 420)
      await page.waitForTimeout(100)
    }
    await expect.poll(() => scoreText(page), { timeout: 60_000 }).toBe(played)
    await page.screenshot({ path: OUT + 'best_replay.png' })
    expect(errorList).toEqual([])
  })

  test('リトライで点数表が戻り、CLEAR が消える', async ({ page }) => {
    const errorList = collectError(page)
    await page.goto('/')
    await openMission(page, 0)
    await playMission1(page)
    await page.waitForTimeout(2000)
    await page.getByRole('button', { name: 'Retry' }).dispatchEvent('click')
    await expect.poll(() => footLabelList(page)).toEqual(['Best score'])
    const text = await scoreText(page)
    for (let point = 1; point <= 6; point++) expect(text).toContain(`${point} 00 = NNN`)
    await expect
      .poll(() => page.getByLabel('CLEAR').evaluate(node => getComputedStyle(node).opacity))
      .toBe('0')
    expect(errorList).toEqual([])
  })

  test('リトライの直後に戻っても、操作できる', async ({ page }) => {
    const errorList = collectError(page)
    await page.goto('/')
    await openMission(page, 0)
    await playMission1(page)
    await page.waitForTimeout(2000)
    await page.getByRole('button', { name: 'Retry' }).dispatchEvent('click')
    await page.waitForTimeout(800)
    await back(page)
    // 一覧から、ふつうのクリックでミッションを開き直せる
    await page.locator('button[aria-label^="Mission 1,"]').click()
    await waitIdle(page)
    await expect(page.getByTestId('score')).toBeVisible()
    expect(errorList).toEqual([])
  })

  test('課題色2色のミッション（12番目）が開ける', async ({ page }) => {
    const errorList = collectError(page)
    await page.goto('/')
    await openMission(page, 11)
    await expect(page.getByRole('img', { name: 'Azure and Violet' })).toBeVisible()
    await page.screenshot({ path: OUT + 'mission12.png' })
    expect(errorList).toEqual([])
  })

  test('戻るボタンでホームまで戻ると隠れる', async ({ page }) => {
    const errorList = collectError(page)
    await page.goto('/')
    await openMission(page, 0)
    await back(page)
    await back(page)
    // 見えなくなり、フォーカスも当たらない
    const backButton = page.locator('button[aria-label="Back"]')
    await expect(backButton).toHaveCSS('opacity', '0')
    await backButton.evaluate(node => (node as HTMLButtonElement).focus())
    expect(await backButton.evaluate(node => document.activeElement === node)).toBe(false)
    expect(errorList).toEqual([])
  })

  test('スコア計算の演出中に戻っても、ベストスコアは保存される', async ({ page }) => {
    const errorList = collectError(page)
    await page.goto('/')
    await openMission(page, 0)
    await dropAt(page, 120, 300)
    await dropAt(page, 270, 300)
    await page.mouse.click(195, 480)
    await page.waitForTimeout(1500)
    await back(page)
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('inkOnHex.bestList') || '{}')
    )
    expect(saved['0']?.score).toBeGreaterThan(0)
    expect(errorList).toEqual([])
  })

  test('クリアできなかったプレイでは、作った回数が増えない', async ({ page }) => {
    const errorList = collectError(page)
    await page.goto('/')
    // 課題は Blue。Cyan だけを垂らしてクリアさせない
    await openMission(page, 2)
    await playMission1(page)
    await page.waitForTimeout(1000)
    expect(await page.evaluate(() => localStorage.getItem('inkOnHex.madeCount'))).toBeNull()
    await back(page)
    await back(page)
    await openMission(page, 0)
    await playMission1(page)
    await page.waitForTimeout(1000)
    const madeCount = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('inkOnHex.madeCount') || '{}')
    )
    expect(madeCount.Cyan).toBeGreaterThan(0)
    expect(errorList).toEqual([])
  })
})
