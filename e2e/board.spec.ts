import { expect, test, type Page } from '@playwright/test'
import { collectError, waitIdle } from './harness'

// 描画側のモジュールを直接読むので、開発サーバー（ステージメーカー用に起動しているもの）で開く
const GAME_DEV_URL = 'http://127.0.0.1:4174/'
const ENGINE_URL = '/src/lib/board/engine.ts'

// ゲームを開き、ミッション一覧へ移ってから描画側を直接動かす。
// ホームを開いたままだと、ホームのタイマーが中央付近のタイルをときどき落とし、確かめるタイルが落ちることがある。
// zoom は寄り引きの長さ。時間のCSS変数は最初に読んだ値が使われ続けるので、最初の切り替えより前に設定する
// （描画が遅い環境でも途中のフレームを描くよう長くする、または落下が終わる前に戻れるよう短くする）
async function openBoard(page: Page, zoom?: string): Promise<void> {
  if (zoom)
    await page.addInitScript(
      value =>
        document.addEventListener('DOMContentLoaded', () =>
          document.documentElement.style.setProperty('--duration-zoom', value)
        ),
      zoom
    )
  await page.goto(GAME_DEV_URL)
  await page.getByRole('button', { name: 'Mission', exact: true }).click()
  await waitIdle(page)
}

// テストで使う描画側の関数（src の型は e2e の設定から読めないので、使う分だけ書く）
interface Tile {
  readonly color: readonly number[]
  readonly alpha: number
  readonly lift: number
}
interface Engine {
  enter(scene: object): Promise<void>
  tileAt(q: number, r: number): Tile | undefined
  hasTileAt(q: number, r: number): boolean
}

test('画面の外にいたタイルも、作り直されずに同じタイルのまま次の場面へ続き、要らなくなれば盤面から外れる', async ({
  page,
}) => {
  const errorList = collectError(page)
  await openBoard(page, '3s')
  const result = await page.evaluate(async engineUrl => {
    const engine: Engine = await import(engineUrl)
    const ROOT3 = Math.sqrt(3)
    const SCALE = 20
    type Rgb = [number, number, number]
    const EMPTY = { alpha: 0, color: [255, 255, 255], stroke: 0 }
    // 座標 (0, center) を画面の中央に映す場面。hasOrigin が false なら (0,0) にだけタイルを置かない
    const sceneAt = (center: number, color: Rgb, hasOrigin = true) => ({
      camera: {
        scale: SCALE,
        tileRatio: 0.8,
        offsetX: innerWidth / 2,
        offsetY: innerHeight / 2 - ROOT3 * center * SCALE,
      },
      focus: [0, center] as [number, number],
      cell: (q: number, r: number) =>
        !hasOrigin && q === 0 && r === 0 ? EMPTY : { alpha: 1, color, stroke: 0 },
      colored: () => false,
    })
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve))
    const colorOf = () => {
      const tile = engine.tileAt(0, 0)
      return tile ? [...tile.color] : null
    }
    // 切り替えが終わるまで、毎フレーム (0,0) の色を控える
    const watch = async (entering: Promise<void>) => {
      let isDone = false
      entering.then(() => (isDone = true))
      const colorList: (number[] | null)[] = []
      while (!isDone) {
        colorList.push(colorOf())
        await frame()
      }
      return colorList
    }
    const RED: Rgb = [255, 0, 0]
    const GREEN: Rgb = [0, 255, 0]
    const BLUE: Rgb = [0, 0, 255]

    // 位置0で (0,0) のタイルを描き、そのタイルの状態を控える
    await engine.enter(sceneAt(0, RED))
    for (let i = 0; i < 5; i++) await frame()
    const tile = engine.tileAt(0, 0)
    // 位置60へ。(0,0) は切り替えの始めに映り、途中で画面から出ていく
    const colorListOut = await watch(engine.enter(sceneAt(60, GREEN)))
    const colorAfterOut = colorOf()
    // 位置120へ。(0,0) は切り替えの間ずっと画面の外にいる
    const colorListAway = await watch(engine.enter(sceneAt(120, BLUE)))
    const isSameAfterAway = engine.tileAt(0, 0) === tile
    const colorAfterAway = colorOf()
    // 位置0へ戻る。(0,0) が画面に入る
    await engine.enter(sceneAt(0, BLUE))
    for (let i = 0; i < 5; i++) await frame()
    const afterBack = engine.tileAt(0, 0)
    const isSameAfterBack = afterBack === tile
    const liftAfterBack = afterBack?.lift ?? null
    const hasTileAfterBack = engine.hasTileAt(0, 0)
    // 位置120の、(0,0) にタイルを置かない場面へ。(0,0) は要らなくなり、画面の外で盤面から外れる
    await engine.enter(sceneAt(120, BLUE, false))
    const isGoneAfterEmpty = !engine.hasTileAt(0, 0)
    // 位置0の、(0,0) にタイルを置く場面へ。(0,0) には新しいタイルが浮いた位置から降りてくる
    let isArrived = false
    engine.enter(sceneAt(0, BLUE)).then(() => (isArrived = true))
    let maxLiftOnArrive = 0
    let isNewOnArrive = false
    while (!isArrived) {
      await frame()
      const arrived = engine.tileAt(0, 0)
      if (arrived) {
        isNewOnArrive = arrived !== tile
        maxLiftOnArrive = Math.max(maxLiftOnArrive, arrived.lift)
      }
    }
    return {
      hasTile: !!tile,
      isDrawnWhileLeaving: colorListOut.some(
        color => !!color && color[0] > 0 && color[0] < 255 && color[1] > 0
      ),
      colorAfterOut,
      isUntouchedWhileAway: colorListAway.every(
        color => JSON.stringify(color) === JSON.stringify([0, 255, 0])
      ),
      isSameAfterAway,
      colorAfterAway,
      isSameAfterBack,
      liftAfterBack,
      hasTileAfterBack,
      isGoneAfterEmpty,
      isNewOnArrive,
      maxLiftOnArrive,
    }
  }, ENGINE_URL)
  expect(result.hasTile).toBe(true)
  // 途中で画面から出ていったタイルも、終わりに次の場面の見え方へ更新される
  expect(result.isDrawnWhileLeaving).toBe(true)
  expect(result.colorAfterOut).toEqual([0, 255, 0])
  // 画面の外にいる間は描かれない
  expect(result.isUntouchedWhileAway).toBe(true)
  // 切り替えが終わっても状態は消えず、同じタイルのまま次の場面の見え方へ更新される
  expect(result.isSameAfterAway).toBe(true)
  expect(result.colorAfterAway).toEqual([0, 0, 255])
  // 画面に戻っても作り直されない（同じタイルで、浮いた位置から出直さない）。盤面にあるタイルとして引き継げる
  expect(result.isSameAfterBack).toBe(true)
  expect(result.liftAfterBack).toBe(0)
  expect(result.hasTileAfterBack).toBe(true)
  // 次の場面に要らないタイルは盤面から外れ、また要るときは新しいタイルとして降りてくる
  expect(result.isGoneAfterEmpty).toBe(true)
  expect(result.isNewOnArrive).toBe(true)
  expect(result.maxLiftOnArrive).toBeGreaterThan(0)
  expect(errorList).toEqual([])
})

test('落ちている途中のタイルを次の場面が必要とするときは、同じタイルが元の場所へ戻って続く', async ({
  page,
}) => {
  const errorList = collectError(page)
  await openBoard(page, '3s')
  const result = await page.evaluate(
    async ([engineUrl, fallUrl]) => {
      const engine: Engine & {
        despawnTile(key: string, planeX: number, planeY: number): void
      } = await import(engineUrl)
      const fall: {
        fallOf(key: string): { position: number[]; returning?: object | null } | undefined
      } = await import(fallUrl)
      const SCALE = 20
      const sceneOf = (color: [number, number, number]) => ({
        camera: { scale: SCALE, tileRatio: 0.8, offsetX: innerWidth / 2, offsetY: innerHeight / 2 },
        focus: [0, 0] as [number, number],
        cell: () => ({ alpha: 1, color, stroke: 0 }),
        colored: () => false,
      })
      const frame = () => new Promise(resolve => requestAnimationFrame(resolve))
      const distance = () => {
        const one = fall.fallOf('0,0')
        return one ? Math.hypot(...one.position) : null
      }
      await engine.enter(sceneOf([255, 0, 0]))
      for (let i = 0; i < 5; i++) await frame()
      const tile = engine.tileAt(0, 0)
      // (0,0) のタイルを落とし始め、少し落ちたところで、(0,0) にもタイルを置く場面へ切り替える
      engine.despawnTile('0,0', innerWidth / 2, innerHeight / 2)
      for (let i = 0; i < 10; i++) await frame()
      let isDone = false
      engine.enter(sceneOf([0, 0, 255])).then(() => (isDone = true))
      await frame()
      await frame()
      const distanceList: number[] = []
      while (!isDone) {
        const now = distance()
        if (now !== null) distanceList.push(now)
        await frame()
      }
      const after = engine.tileAt(0, 0)
      return {
        isGettingCloser: distanceList.every(
          (now, i) => i === 0 || now <= distanceList[i - 1] + 1e-6
        ),
        hasFallAfter: !!fall.fallOf('0,0'),
        isSame: after === tile,
        alphaAfter: after?.alpha ?? null,
      }
    },
    [ENGINE_URL, '/src/lib/board/fall.ts']
  )
  // 切り替えの間、落ちていたタイルは落ち続けずに元の場所へ近づき、終わりには落下として残らない
  expect(result.isGettingCloser).toBe(true)
  expect(result.hasFallAfter).toBe(false)
  // 同じタイルのまま、次の場面のタイルとして続く
  expect(result.isSame).toBe(true)
  expect(result.alphaAfter).toBe(1)
  expect(errorList).toEqual([])
})

test('次の場面にも要るタイルが、落ちている途中のまま切り替えの間ずっと描く範囲の外にいても、同じタイルが1枚で続く', async ({
  page,
}) => {
  const errorList = collectError(page)
  await openBoard(page, '0.3s')
  const result = await page.evaluate(
    async ([engineUrl, fallUrl]) => {
      const engine: Engine & {
        despawnTile(key: string, planeX: number, planeY: number): void
      } = await import(engineUrl)
      const fall: { fallOf(key: string): object | undefined } = await import(fallUrl)
      const ROOT3 = Math.sqrt(3)
      const SCALE = 20
      const sceneAt = (center: number) => ({
        camera: {
          scale: SCALE,
          tileRatio: 0.8,
          offsetX: innerWidth / 2,
          offsetY: innerHeight / 2 - ROOT3 * center * SCALE,
        },
        focus: [0, center] as [number, number],
        cell: () => ({ alpha: 1, color: [255, 255, 255], stroke: 0 }),
        colored: () => false,
      })
      const frame = () => new Promise(resolve => requestAnimationFrame(resolve))
      await engine.enter(sceneAt(0))
      for (let i = 0; i < 5; i++) await frame()
      const tile = engine.tileAt(0, 0)
      // 位置60へ移ってから (0,0) を落とし始め、位置120の場面へ。60から120への切り替えの間、(0,0) はずっと描く範囲の外にいる。
      // 位置120の場面も (0,0) にタイルを置く
      await engine.enter(sceneAt(60))
      engine.despawnTile('0,0', innerWidth / 2, innerHeight / 2)
      await frame()
      const isFallingBefore = !!fall.fallOf('0,0')
      await engine.enter(sceneAt(120))
      const hasFallAfterAway = !!fall.fallOf('0,0')
      // 落下が終わる前に位置0へ戻る
      await engine.enter(sceneAt(0))
      for (let i = 0; i < 5; i++) await frame()
      return {
        isFallingBefore,
        hasFallAfterAway,
        hasFallAfterBack: !!fall.fallOf('0,0'),
        isSame: engine.tileAt(0, 0) === tile,
        alphaAfterBack: engine.tileAt(0, 0)?.alpha ?? null,
      }
    },
    [ENGINE_URL, '/src/lib/board/fall.ts']
  )
  expect(result.isFallingBefore).toBe(true)
  // 切り替えが終わった時点で落下は終わり、戻ったときに落ちるタイルと盤面のタイルの2枚にならない
  expect(result.hasFallAfterAway).toBe(false)
  expect(result.hasFallAfterBack).toBe(false)
  expect(result.isSame).toBe(true)
  expect(result.alphaAfterBack).toBe(1)
  expect(errorList).toEqual([])
})

test('切り替えていないときに、落ちている途中のタイルを場面がまた必要としたら、同じ座標に2枚描かず、そのタイルが元の場所へ戻って続く', async ({
  page,
}) => {
  const errorList = collectError(page)
  await openBoard(page)
  const result = await page.evaluate(
    async ([engineUrl, fallUrl]) => {
      type DrawnTile = { x: number; y: number; fall: object | null }
      const engine: Engine & {
        despawnTile(key: string, planeX: number, planeY: number): void
        boardOf(): { render(tileList: DrawnTile[], ...rest: unknown[]): void }
      } = await import(engineUrl)
      const fall: { fallOf(key: string): { position: number[] } | undefined } = await import(
        fallUrl
      )
      const SCALE = 20
      const centerX = innerWidth / 2
      const centerY = innerHeight / 2
      // (0,0) にタイルを置くかを、切り替えずに変えられる場面（プレイのリトライ、コレクションの行の出入りと同じ形）
      let hasOrigin = true
      const scene = {
        camera: { scale: SCALE, tileRatio: 0.8, offsetX: centerX, offsetY: centerY },
        focus: [0, 0] as [number, number],
        cell: (q: number, r: number) =>
          !hasOrigin && q === 0 && r === 0
            ? { alpha: 0, color: [255, 255, 255], stroke: 0 }
            : { alpha: 1, color: [255, 255, 255], stroke: 0 },
        colored: () => false,
      }
      const frame = () => new Promise(resolve => requestAnimationFrame(resolve))
      // 描画側へ渡る描画データのうち、(0,0) の座標のものを数える
      const board = engine.boardOf()
      const render = board.render.bind(board)
      let maxCountAtOrigin = 0
      board.render = (tileList, ...rest) => {
        const count = tileList.filter(
          tile => Math.abs(tile.x - centerX) < 0.5 && Math.abs(tile.y - centerY) < 0.5
        ).length
        maxCountAtOrigin = Math.max(maxCountAtOrigin, count)
        render(tileList, ...rest)
      }
      await engine.enter(scene)
      for (let i = 0; i < 5; i++) await frame()
      const tile = engine.tileAt(0, 0)
      // (0,0) を場面から外して落とし始め、落ちている途中で場面がまた (0,0) を必要とする
      hasOrigin = false
      engine.despawnTile('0,0', centerX, centerY)
      for (let i = 0; i < 10; i++) await frame()
      const isFallingBefore = !!fall.fallOf('0,0')
      hasOrigin = true
      const distanceList: number[] = []
      let maxLift = 0
      for (let i = 0; i < 120 && fall.fallOf('0,0'); i++) {
        await frame()
        const one = fall.fallOf('0,0')
        if (one) distanceList.push(Math.hypot(...one.position))
        maxLift = Math.max(maxLift, engine.tileAt(0, 0)?.lift ?? 0)
      }
      for (let i = 0; i < 5; i++) await frame()
      board.render = render
      return {
        isFallingBefore,
        maxCountAtOrigin,
        isGettingCloser: distanceList.every(
          (now, i) => i === 0 || now <= distanceList[i - 1] + 1e-6
        ),
        hasFallAfter: !!fall.fallOf('0,0'),
        maxLift,
        isSame: engine.tileAt(0, 0) === tile,
        alphaAfter: engine.tileAt(0, 0)?.alpha ?? null,
      }
    },
    [ENGINE_URL, '/src/lib/board/fall.ts']
  )
  expect(result.isFallingBefore).toBe(true)
  // 同じ座標に描くのは、いつも1枚
  expect(result.maxCountAtOrigin).toBe(1)
  // 落ちていたタイルは元の場所へ近づき、戻りきると落下として残らない。浮いた位置から出直さない
  expect(result.isGettingCloser).toBe(true)
  expect(result.hasFallAfter).toBe(false)
  expect(result.maxLift).toBe(0)
  expect(result.isSame).toBe(true)
  expect(result.alphaAfter).toBe(1)
  expect(errorList).toEqual([])
})

test('戻している途中のタイルは、また落とされても、切り替えが始まっても、作り直されずに今の姿勢から続く', async ({
  page,
}) => {
  const errorList = collectError(page)
  await openBoard(page, '3s')
  const result = await page.evaluate(
    async ([engineUrl, fallUrl]) => {
      type Pose = { position: number[]; angle: number; returning?: object | null }
      const engine: Engine & {
        despawnTile(key: string, planeX: number, planeY: number): void
      } = await import(engineUrl)
      const fall: { fallOf(key: string): Pose | undefined } = await import(fallUrl)
      type DrawnTile = { x: number; y: number; alpha: number; radius: number }
      const board = (
        engine as unknown as {
          boardOf(): { render(tileList: DrawnTile[], ...rest: unknown[]): void }
        }
      ).boardOf()
      const SCALE = 20
      const centerX = innerWidth / 2
      const centerY = innerHeight / 2
      let hasOrigin = true
      const sceneOf = () => ({
        camera: { scale: SCALE, tileRatio: 0.8, offsetX: centerX, offsetY: centerY },
        focus: [0, 0] as [number, number],
        cell: (q: number, r: number) =>
          !hasOrigin && q === 0 && r === 0
            ? { alpha: 0, color: [255, 255, 255], stroke: 0 }
            : { alpha: 1, color: [255, 255, 255], stroke: 0 },
        colored: () => false,
      })
      const frame = () => new Promise(resolve => requestAnimationFrame(resolve))
      const poseOf = () => {
        const one = fall.fallOf('0,0')
        return one ? { position: [...one.position], angle: one.angle } : null
      }
      const gap = (a: { position: number[] } | null, b: { position: number[] } | null) =>
        a && b ? Math.hypot(...a.position.map((value, i) => value - b.position[i])) : null
      await engine.enter(sceneOf())
      for (let i = 0; i < 5; i++) await frame()
      // (0,0) に描く大きさを、フレームごとに控える
      const render = board.render.bind(board)
      const drawnList: number[] = []
      board.render = (tileList, ...rest) => {
        const one = tileList.find(
          tile => Math.abs(tile.x - centerX) < 0.5 && Math.abs(tile.y - centerY) < 0.5
        )
        if (one) drawnList.push(one.radius)
        render(tileList, ...rest)
      }
      // 落とし、落ちている途中で場面がまた必要として戻し始める
      hasOrigin = false
      engine.despawnTile('0,0', centerX, centerY)
      for (let i = 0; i < 20; i++) await frame()
      hasOrigin = true
      for (let i = 0; i < 3; i++) await frame()
      const fallObject = fall.fallOf('0,0')
      const isReturning = !!fallObject?.returning
      // 戻している途中で、場面がまた要らなくなり、落とし直される（コレクションの行がまた隠れるときと同じ形）
      const beforeHide = poseOf()
      hasOrigin = false
      engine.despawnTile('0,0', centerX, centerY)
      const afterHide = poseOf()
      const isSameFallOnHide = fall.fallOf('0,0') === fallObject
      await frame()
      // また必要になって戻している途中で、切り替えが始まる
      hasOrigin = true
      for (let i = 0; i < 3; i++) await frame()
      const beforeEnter = poseOf()
      let isDone = false
      engine.enter(sceneOf()).then(() => (isDone = true))
      await frame()
      const afterEnter = poseOf()
      while (!isDone) await frame()
      board.render = render
      const maxStep = (list: number[]) =>
        Math.max(...list.slice(1).map((value, i) => Math.abs(value - list[i])))
      return {
        maxRadiusStep: maxStep(drawnList),
        isReturning,
        isSameFallOnHide,
        jumpOnHide: gap(beforeHide, afterHide),
        // 元の場所からの距離。切り替えが始まっても、戻し始めの姿勢へ跳ね戻らなければ増えない
        distanceBeforeEnter: beforeEnter ? Math.hypot(...beforeEnter.position) : null,
        distanceAfterEnter: afterEnter ? Math.hypot(...afterEnter.position) : null,
        hasFallAfter: !!fall.fallOf('0,0'),
      }
    },
    [ENGINE_URL, '/src/lib/board/fall.ts']
  )
  expect(result.isReturning).toBe(true)
  // 落とし直しても同じ落下のまま、姿勢が跳ばない
  expect(result.isSameFallOnHide).toBe(true)
  expect(result.jumpOnHide).toBe(0)
  // 切り替えが始まっても、戻し始めの姿勢へ跳ね戻らない
  expect(result.distanceBeforeEnter).not.toBeNull()
  expect(result.distanceAfterEnter).not.toBeNull()
  expect(result.distanceAfterEnter!).toBeLessThanOrEqual(result.distanceBeforeEnter! + 1e-6)
  expect(result.hasFallAfter).toBe(false)
  // 描く大きさも跳ばない
  expect(result.maxRadiusStep).toBeLessThan(1)
  expect(errorList).toEqual([])
})

test('画面の外にいる間に途中の場面で盤面から外れたタイルは、その後の場面でまた要っても元のタイルが戻らず、新しいタイルが出る', async ({
  page,
}) => {
  const errorList = collectError(page)
  await openBoard(page, '0.3s')
  const result = await page.evaluate(async engineUrl => {
    const engine: Engine = await import(engineUrl)
    const ROOT3 = Math.sqrt(3)
    const SCALE = 20
    const EMPTY = { alpha: 0, color: [255, 255, 255], stroke: 0 }
    const sceneAt = (center: number, hasOrigin: boolean) => ({
      camera: {
        scale: SCALE,
        tileRatio: 0.8,
        offsetX: innerWidth / 2,
        offsetY: innerHeight / 2 - ROOT3 * center * SCALE,
      },
      focus: [0, center] as [number, number],
      cell: (q: number, r: number) =>
        !hasOrigin && q === 0 && r === 0 ? EMPTY : { alpha: 1, color: [255, 255, 255], stroke: 0 },
      colored: () => false,
    })
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve))
    await engine.enter(sceneAt(0, true))
    for (let i = 0; i < 5; i++) await frame()
    const tile = engine.tileAt(0, 0)
    // 位置120へ移り、(0,0) を置かない場面、続けて (0,0) を置く場面へ。(0,0) はその間ずっと画面の外にいて、読まれない
    await engine.enter(sceneAt(120, false))
    await engine.enter(sceneAt(120, true))
    // 位置0へ戻る。(0,0) に見えてくるのは、位置120で置いた場面の新しいタイル
    let isDone = false
    engine.enter(sceneAt(0, true)).then(() => (isDone = true))
    let isNew = false
    while (!isDone) {
      await frame()
      const now = engine.tileAt(0, 0)
      if (now) {
        isNew = now !== tile
      }
    }
    return { hasTile: !!tile, isNew }
  }, ENGINE_URL)
  expect(result.hasTile).toBe(true)
  expect(result.isNew).toBe(true)
  expect(errorList).toEqual([])
})

test('切り替えが終わった時点でタイルのなかった座標は、その後に場面の中身が変わっても、元のタイルが戻らない', async ({
  page,
}) => {
  const errorList = collectError(page)
  await openBoard(page, '0.3s')
  const result = await page.evaluate(async engineUrl => {
    const engine: Engine & {
      addBeforeFrame(callback: () => boolean): () => void
      currentScene(): object | null
      transitionProgress(): number | null
    } = await import(engineUrl)
    const ROOT3 = Math.sqrt(3)
    const SCALE = 20
    const EMPTY = { alpha: 0, color: [255, 255, 255], stroke: 0 }
    const sceneAt = (center: number, hasOrigin: () => boolean) => ({
      camera: {
        scale: SCALE,
        tileRatio: 0.8,
        offsetX: innerWidth / 2,
        offsetY: innerHeight / 2 - ROOT3 * center * SCALE,
      },
      focus: [0, center] as [number, number],
      cell: (q: number, r: number) =>
        !hasOrigin() && q === 0 && r === 0
          ? EMPTY
          : { alpha: 1, color: [255, 255, 255], stroke: 0 },
      colored: () => false,
    })
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve))
    await engine.enter(sceneAt(0, () => true))
    for (let i = 0; i < 5; i++) await frame()
    const tile = engine.tileAt(0, 0)
    // 位置120の、(0,0) にタイルを置かない場面へ。切り替えが終わった直後のフレームの前の処理で、
    // (0,0) が画面の外にいる間に、その場面が (0,0) にタイルを置くよう中身を変える（スクロールで場面の中身が変わるのと同じ形）
    let hasOrigin = false
    const away = sceneAt(120, () => hasOrigin)
    const remove = engine.addBeforeFrame(() => {
      if (engine.currentScene() === away && engine.transitionProgress() === null) hasOrigin = true
      return false
    })
    await engine.enter(away)
    for (let i = 0; i < 5; i++) await frame()
    remove()
    await engine.enter(sceneAt(0, () => true))
    return { hasTile: !!tile, isNew: engine.tileAt(0, 0) !== tile }
  }, ENGINE_URL)
  expect(result.hasTile).toBe(true)
  expect(result.isNew).toBe(true)
  expect(errorList).toEqual([])
})

test('切り替えが終わって止まっている画面は、描き直し続けない', async ({ page }) => {
  const errorList = collectError(page)
  await openBoard(page, '0.3s')
  const renderCount = await page.evaluate(async engineUrl => {
    const engine: Engine & {
      boardOf(): { render(...rest: unknown[]): void }
    } = await import(engineUrl)
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve))
    const sceneAt = (offsetY: number) => ({
      camera: { scale: 20, tileRatio: 0.8, offsetX: innerWidth / 2, offsetY },
      focus: [0, 0] as [number, number],
      cell: () => ({ alpha: 1, color: [255, 255, 255], stroke: 0 }),
      colored: () => false,
    })
    // 画面の外にも記録を溜めてから切り替える
    for (let i = 0; i < 20; i++) await engine.enter(sceneAt(innerHeight / 2 - i * innerHeight))
    await engine.enter(sceneAt(innerHeight / 2))
    for (let i = 0; i < 10; i++) await frame()
    const board = engine.boardOf()
    const render = board.render.bind(board)
    let count = 0
    board.render = (...rest) => {
      count++
      render(...rest)
    }
    for (let i = 0; i < 60; i++) await frame()
    board.render = render
    return count
  }, ENGINE_URL)
  expect(renderCount).toBe(0)
  expect(errorList).toEqual([])
})

test('ホームから出る切り替えを打ち切ってホームへ戻るとき、ホームにいた長さで終わりの処理が増えず、画面の外のタイルも同じまま続く', async ({
  page,
}) => {
  const errorList = collectError(page)
  await openBoard(page, '0.6s')
  const result = await page.evaluate(async engineUrl => {
    const engine: Engine = await import(engineUrl)
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve))
    let calls = 0
    // ホームと同じく、どこにでもタイルを置き、毎フレーム描き直しを求める場面
    const homeAt = (offsetY: number) => ({
      isHome: true,
      tick: () => true,
      camera: { scale: 20, tileRatio: 0.8, offsetX: innerWidth / 2, offsetY },
      focus: [0, 0] as [number, number],
      cell: () => {
        if (new Error().stack?.includes('onComplete')) calls++
        return { alpha: 1, color: [255, 255, 255], stroke: 0 }
      },
      colored: () => false,
    })
    const other = {
      camera: { scale: 30, tileRatio: 0.8, offsetX: innerWidth / 2, offsetY: innerHeight / 2 },
      focus: [0, 0] as [number, number],
      cell: () => ({ alpha: 1, color: [255, 0, 0], stroke: 0 }),
      colored: () => false,
    }
    // ホームにいる間カメラを流し、steps 画面分の記録を溜めてから、ほかの画面への切り替えを途中で打ち切ってホームへ戻る
    const stay = async (steps: number) => {
      const home = homeAt(innerHeight / 2)
      await engine.enter(home)
      for (let i = 1; i <= steps; i++) {
        home.camera = { ...home.camera, offsetY: innerHeight / 2 - i * innerHeight }
        await frame()
      }
      const farTile = engine.tileAt(0, 0)
      engine.enter(other)
      for (let i = 0; i < 5; i++) await frame()
      calls = 0
      await engine.enter(homeAt(home.camera.offsetY))
      return { calls, isSame: engine.tileAt(0, 0) === farTile && !!farTile }
    }
    const short = await stay(5)
    const long = await stay(300)
    return { short, long }
  }, ENGINE_URL)
  // ホームにいた長さ（溜まった記録の数）が60倍になっても、終わりに調べる数はそれに比例して増えない。
  // 調べるのは打ち切るまでに切り替えで動かした座標で、カメラが遠くから寄る分だけ多少増える
  expect(result.long.calls).toBeLessThan(result.short.calls * 5)
  // ずっと画面の外にいたタイルも、同じタイルのまま続く
  expect(result.short.isSame).toBe(true)
  expect(result.long.isSame).toBe(true)
  expect(errorList).toEqual([])
})
