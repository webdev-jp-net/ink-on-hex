---
description: Technical spec
---

# 技術仕様

## 技術スタック

| 項目                  | 内容                                                                        |
| --------------------- | --------------------------------------------------------------------------- |
| 言語・ランタイム      | TypeScript 7（ブラウザ）                                                    |
| フレームワーク        | React 19、Vite 8                                                            |
| ライブラリ            | three.js 0.179.1、GSAP 3.13.0（Observer・InertiaPlugin）、jotai             |
| スタイル              | CSS Modules（SCSS、sass-embedded）                                          |
| パッケージマネージャ  | bun                                                                         |
| データストア・外部API | ブラウザのlocalStorage                                                      |
| ホスティング          | Vercel                                                                      |
| 開発ツール            | Oxlint（TypeScript・React Hooks）、stylelint、Prettier、textlint、Storybook |

バージョンは承認なしに変更しない（`_llm-rules/core_rules.md`）。

## ディレクトリ

| パス              | 役割                                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `index.html`      | ゲームの入口                                                                                                           |
| `maker.html`      | ステージメーカーの入口                                                                                                 |
| `src/app/`        | 画面の切り替えと全体の枠（`App.tsx`）、一覧を作り直す判定                                                              |
| `src/features/`   | 画面ごとの機能（ホーム・ミッション一覧・コレクション・プレイ）                                                         |
| `src/components/` | デザインの決まりを担うUIの部品（アイコン・ヘックス・ボタン・数の式・レシピ・手数の列・一覧画面の枠）と、そのストーリー |
| `src/hooks/`      | 画面で共有するフック（画面の出入りの段階・盤面の場面の切り替え・スクロール）                                           |
| `src/lib/`        | 盤面の描画と場面の管理（`board/`）、ミッションの盤面の配置、スクロールの動き                                           |
| `src/utils/`      | CSS変数から時間・イージング・色を読む、画面の大きさの判定、登場の出方（大きく出てから落ち着く・跳ねてから着地する）    |
| `src/game/`       | ルール・ミッション定義・色・保存（画面に依存しない）                                                                   |
| `src/state/`      | 画面をまたぐ状態（jotai）                                                                                              |
| `src/maker/`      | ステージメーカー                                                                                                       |
| `src/styles/`     | CSS変数と土台（`index.scss`）、mixin（`_variable/`）、デザインの基礎のストーリー                                       |
| `.storybook/`     | UIのカタログ（Storybook）の設定                                                                                        |
| `e2e/`            | 画面のテスト                                                                                                           |
| `public/`         | ファビコン・Apple用アイコン・OGP画像。ビルド時に`dist/`直下へコピー                                                    |
| `dist/`           | ビルドの出力（追跡しない）                                                                                             |

## 構成

- ゲームとステージメーカーは、Viteの別の入口（`index.html`・`maker.html`）にする
- ビルドに含めるのはゲームだけにし、ステージメーカーは開発サーバーでだけ開く
- ルールは`src/game/`に置き、ゲーム・ステージメーカー・テストで共有する
- 依存は`app/`→`features/`→共有の層（`components/`・`hooks/`・`lib/`・`utils/`・`game/`・`state/`・`styles/`）の一方向にし、画面の機能どうしはimportしない
- 置き場所は使う回数ではなく役割で決める。その画面だけの関心事はその画面のフォルダに、画面をまたぐ取り決め（盤面の座標など）や画面に依存しない仕組みは共有の層に置く
- デザインの決まり（`design.md`）を担うUIの部品は`components/`に置く
- `@`は`src/`の別名にする（Vite・TypeScript・SCSSで共通）

## 描画

- 盤面はthree.jsのWebGLで描く。Reactの外で命令的に扱い、canvasは画面より奥の層に1枚だけ置く
- タイルは`InstancedMesh`で、色・透明度・枠・光をインスタンスごとの属性で渡す
- すりガラスの表現は、背面をレンダーターゲットに描き、シェーダーでぼかして重ねる
- 盤面の色（背景・セル・線）は、`src/styles/index.scss`のCSS変数を正本にし、`src/utils/colorToken.ts`で読む
- 画面ごとに盤面の場面（`Scene`）を作り、`enter`で切り替える。セルの見え方は場面の`cell`が返す
- タップ位置は画面座標からaxial座標に変換して、セルを特定する

## アニメーション

- 毎フレームの描画は、GSAPの`ticker`で回す
- UIの演出はGSAPのtweenで行う
- 演出の時間とイージングは、`src/styles/index.scss`のCSS変数を正本にし、`src/utils/motionToken.ts`で読む
- スクロールはGSAPの`Observer`で入力を受け、慣性は`InertiaPlugin`に任せる。位置は盤面と同じフレームで反映する

## 画面

- 画面はホーム・ミッション一覧・コレクション・プレイ（ミッションとアトリエ）で、行き先はjotaiの`routeAtom`で持つ
- 切り替えでは、前の画面を消しながら次の画面を出し、盤面の場面の切り替えが終わったら前の画面を外す
- 画面に出す値はReactの状態で持ち、毎フレーム変わる値と進行中のゲームはrefで持つ
- PCレイアウトは幅900px以上かつ横長で判定する（SCSSの`mq-wide`とTypeScriptの`isWide()`）
- 画面の大きさが変わったら盤面の描画を合わせる。一覧画面は、列数かPCレイアウトかが変わったときだけ作り直す

## 保存

- localStorageに保存する

## テスト

- ルールのテストは`src/game/core.test.ts`で、`bun test`で実行する
- 画面のテストは`e2e/`で、Playwright Testを使う。WebGLはSwiftShaderで描く
- CSS Modulesでクラス名が変わるため、要素はrole・aria・`data-testid`で指定する
- UIの部品とデザインの基礎は、Storybook（`bun run storybook`）で部品ごとに確かめる
