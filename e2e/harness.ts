// 画面テストの共通処理
import { expect, type Page } from '@playwright/test'

export const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }
export const OUT = 'e2e/out/'

// ページ内の例外を集める
export function collectError(page: Page): string[] {
  const errorList: string[] = []
  page.on('pageerror', error => errorList.push(String(error)))
  return errorList
}

// 画面の切り替えが終わるまで待つ（切り替え中は body が操作を受けない）
export async function waitIdle(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.body.style.pointerEvents === '' &&
          !document.querySelector('[data-phase="entering"],[data-phase="leaving"]')
      )
    )
    .toBe(true)
}

export async function openMission(page: Page, index: number): Promise<void> {
  await page.getByRole('button', { name: 'Mission', exact: true }).click()
  await waitIdle(page)
  await page.locator(`button[aria-label^="Mission ${index + 1},"]`).dispatchEvent('click')
  await waitIdle(page)
}

export async function back(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Back' }).dispatchEvent('click')
  await waitIdle(page)
}

export function scoreText(page: Page): Promise<string> {
  return page
    .getByTestId('score')
    .evaluate(node => (node as HTMLElement).innerText.split('\n').join(' '))
}

export function footLabelList(page: Page): Promise<(string | null)[]> {
  return page
    .getByTestId('foot-actions')
    .evaluate(node =>
      [...node.querySelectorAll('span:not([class*="out"]) > button')].map(button =>
        button.getAttribute('aria-label')
      )
    )
}

// 手を打ち、垂らし終わるまで待つ
export async function dropAt(page: Page, x: number, y: number): Promise<void> {
  await page.mouse.click(x, y)
  await page.waitForTimeout(2500)
}

// ミッション1を3手で使い切る（390x844 前提の座標）
export async function playMission1(page: Page): Promise<void> {
  for (const [x, y] of [
    [120, 300],
    [270, 300],
    [195, 480],
  ])
    await dropAt(page, x, y)
}
