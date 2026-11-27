import { expect, test } from '@playwright/test'
import { collectError, OUT } from './harness'

const MAKER_URL = 'http://127.0.0.1:4174/maker.html'

test('読み込んだミッションをそのまま書き出せ、試しに垂らすと手数が減る', async ({ page }) => {
  const errorList = collectError(page)
  await page.goto(MAKER_URL)
  // 11番目のミッション（Dark Cobalt）
  await page.getByLabel('Load mission').selectOption('10')
  expect(await page.getByLabel('Mission code').inputValue()).toBe(
    "{ radius: 6, moveCount: 5, inkList: [0, 1, 2], targetColor: 'Dark Cobalt' },"
  )
  await page.getByRole('button', { name: 'Play' }).click()
  const box = (await page.getByLabel('Field').boundingBox())!
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5)
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.4)
  await expect(page.getByText('moves left 3')).toBeVisible()
  await page.screenshot({ path: OUT + 'maker_play.png', fullPage: true })
  expect(errorList).toEqual([])
})

test('保存した編集中のステージを読み込める', async ({ page }) => {
  const errorList = collectError(page)
  await page.goto(MAKER_URL)
  await page.evaluate(() =>
    localStorage.setItem(
      'inkOnHex.maker',
      JSON.stringify({
        keepList: ['0,0', '1,0'],
        inkList: [1],
        moveCount: 2,
        targetColorList: ['Magenta', ''],
      })
    )
  )
  await page.reload()
  await expect(page.getByText('2 cells')).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Target color 1' })).toHaveValue('Magenta')
  await expect(page.locator('output')).toHaveText('2')
  expect(errorList).toEqual([])
})
