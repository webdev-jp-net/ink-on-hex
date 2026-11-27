import { expect, test } from '@playwright/test'
import { collectError, dropAt, openMission, PHONE } from './harness'

test.describe('画面の大きさが変わったとき', () => {
  test.use(PHONE)

  // 一番下の行のセルを叩く。叩いた位置と盤面がずれていると、盤面の外とみなされて垂らせない
  test('ミッションの盤面で、叩いたセルに垂らせる', async ({ page }) => {
    const errorList = collectError(page)
    await page.goto('/')
    await openMission(page, 10)
    await page.setViewportSize({ width: 414, height: 896 })
    await page.waitForTimeout(500)
    const box = (await page.locator('[class*="fit"]').boundingBox())!
    // 半径6の盤面の高さは 12 × (セルの高さ + 間隔4px) + セルの高さ
    const cellHeight = (box.height - 48) / 13
    const centerX = box.x + box.width / 2
    const centerY = box.y + box.height / 2
    await dropAt(page, centerX, centerY)
    await dropAt(page, centerX, centerY + 6 * (cellHeight + 4))
    await expect(page.getByRole('img', { name: /moves left/ })).toHaveAttribute(
      'aria-label',
      '3 moves left'
    )
    expect(errorList).toEqual([])
  })

  test('盤面の描画の大きさが画面に合う', async ({ page }) => {
    await page.goto('/')
    await page.setViewportSize({ width: 414, height: 896 })
    await expect
      .poll(() =>
        page
          .locator('canvas')
          .evaluate(
            canvas =>
              (canvas as HTMLCanvasElement).width /
              Math.min(devicePixelRatio, 2) /
              canvas.clientWidth
          )
      )
      .toBe(1)
  })
})
