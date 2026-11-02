---
type: drbfm
repo: poko-tools
ticket_id: dbd-perks-official-perk-bg
change_title: パークスロット: 公式素材「パークの背景」をひし形の地にする(Pages 版のみ)
version_tier: patch
status: draft
created: 2026-11-03
updated: 2026-11-03
owner: devuser
canonical_path: docs/development/drbfm/20261103-dbd-perks-official-perk-bg-official-perk-background.md
tags: [drbfm, poko-tools, dbd-perks]
---

# DRBFM: dbd-perks-official-perk-bg パークスロット: 公式素材「パークの背景」をひし形の地にする

> スキーマ: SQA `schemas/drbfm.schema.yaml` / 生成方針: SQA `docs/features/drbfm-generation.md`
> 設計: 設計レビュー役(Fable)2026-11-03。owner の指示は `docs/development/dev-intent/dbd-perks-official-perk-bg.md` に残す。

## 1. 変更概要

- 背景 / 目的: 星乃ぽこ(DbD 公式の公認クリエイター)が公式から Free to Use で受け取った素材「パークの背景」(256×256 透過 PNG、紫のひし形+石のような黒い縁。ひし形は画像のほぼ全面 bbox 6..252、中央の不透明度 248/255)を、パーク画像を出しているときのひし形の地に使う。ゲーム画面と同じ見た目に寄せる。
- バージョン区分(patch / minor / major)と根拠: **patch**(0.2.5 → 0.2.6)。見た目の差し替えだけで、操作・保存形式・配布物(zip)の中身・外部 IF は変わらない。`docs/development/test-asset-lifecycle-policy.md` §3 と memory「tool versioning」(小さな調整・見た目 = patch)に合う。
- 変更内容:
  - 素材を `tools/dbd-perks/official/perk-bg.png` に置く(`scripts/package-tool.sh:20-31` は `*.html` / `*.js` / `style.css` / `CREDITS.md` / `CHANGELOG.md` / `assets/` / `MANUAL.md` だけを zip に入れるので `official/` は `icons/` と同じく zip に入らない)。
  - `tools/dbd-perks/style.css:140-141`(`.icons .slot::before` の紫 radial-gradient)を素材画像に置き換える。回転なし・枠線なし・影なしで、素材のひし形(画像の 96%、bbox 6..252)の対角線が `--slot`(300px)になるように敷く(`::before` を -2% / 104%)。`.stopped` のポップ(:88-89 `slot-pop` は `rotate(45deg)` 前提)は回転なしの別 keyframe にする。
  - キラー赤 / サバイバー青の色線(:85-86)は画像ありのときは出さない(役割の色の見分けはなくなる。owner 了承済み 2026-11-03)。
  - `.no-frame .slot::before { display: none }`(:157)はそのまま効かせる。
  - 画像なし(zip 版・「パークの画像」オフ)は今の白いひし形+名前のまま。
  - `CREDITS.md` に出典(公式の公認クリエイター向け Free to Use 素材)と zip 非同梱を書く。`tool.json` 0.2.6、`CHANGELOG.md` に 0.2.6。
- 影響範囲候補(画面 / API / DB / 帳票 / 外部IF / 権限): 画面(`tools/dbd-perks/style.css` のみ。`app.js` / `index.html` は変更しない想定)、配布物(zip: 変化なしを確認、GitHub Pages: main root 公開なので `official/` がそのまま配信される)、権利表記(`CREDITS.md`)、要件 docs(`docs/requirements/dbd-perks.md:19,33,34` の「枠は自作 / 公式の枠画像は使わない / キラー赤・サバイバー青」が owner 決定と矛盾するので同じ PR で更新する)。API / DB / 権限: なし。

## 2. DRBFM 表

| part | change_point | function | possible_risk | impact | detection | test_to_add | skip_reason | review_required | review_reason |
|---|---|---|---|---|---|---|---|---|---|
| screen | `.icons .slot::before` の background を素材 `url(official/perk-bg.png)` に置換 | 画像ありのときのひし形の地 | background-size / position / repeat 未指定で 256px のまま左上寄せ・タイル状に並ぶ。基底 `.slot::before`(:75-78)の left/top 14.6% ・70.7% を打ち消さず素材が縮んで中央からずれる。素材のひし形は画像の 96% なので 100% で敷くと今の枠より小さくなる | 枠が小さい・ずれる・繰り返し模様 | 待機状態のスクショ(先端が slot の辺の中央に来る)+ computed style(-6px / 312px、background-size contain、no-repeat、50% 50%) | TC-PKT-001, TC-PKT-002, TC-PKT-022 | | false | |
| screen | 基底 `.slot::before`(:79-83)の border 7px / border-radius 18px / inset box-shadow / `rotate(45deg)` の打ち消し | 素材そのまま(回転なし・枠線なし・影なし) | 打ち消し漏れで素材の周りに四角いインク色の線や角丸が出る、素材が 45° 回る、内側に四角い影の線が出る | 見た目の破綻(配信に映る) | computed style(border-width 0、box-shadow none、transform none、border-radius 0)+ スクショ | TC-PKT-001, TC-PKT-003 | | false | |
| screen | `.slot.k::before` / `.slot.s::before`(:85-86)の色線を画像ありでは出さない | 役割の色の見分け(廃止。owner 了承) | 詳細度・記述順の関係で色線が残り、紫のひし形に赤 / 青の四角い線が乗る。k と s で見た目が変わる | 意図と違う表示 | k / s を切り替えて `::before` の computed style が同一(box-shadow none) | TC-PKT-003 | | false | |
| screen | `.slot.spinning::before`(:87)/ `.icons .slot.spinning::before`(:141)の地色 | 回転中の地色 | 回転中だけ素材が消えてピンク `#fff3fa` や旧グラデに戻る(ちらつき)。画像の差し替え(renderSlot)で `::before` が再描画され素材がまたたく | 配信中に目立つ | spinning 中のスクショ + computed background-image が素材のまま | TC-PKT-004 | | false | |
| screen | `.stopped` の `slot-pop`(:88-89)が `rotate(45deg)` 前提 | 止まった時のポップ(scale .86 → 1) | 回転なしの素材に旧 keyframe が当たり 45° 回って戻る。別 keyframe にしても最終フレームと静止状態の transform が違って角度 / 大きさがジャンプする。`animation-name` だけ上書きして duration / easing が外れる | 演出の破綻 | アニメ途中(50%)で `getAnimations()` を止めて transform に rotate が無いこと + スクショ、終了後に transform none | TC-PKT-005, TC-PKT-023 | | false | |
| screen | パーク画像 `.slot-icon`(:129-138、13% / 74%)と素材の石の縁 | 画像がひし形の地の中に収まる | 素材のひし形は bbox 6..252(先端が約 7px 内側)で、今の 70.7% 回転枠より内側がやや狭い。大きいパーク画像の端が石の縁に乗る | 見た目(ゲーム画面と違う印象) | 不透明領域が大きいパーク 4 件を固定表示してスクショ、人の目で判断 | TC-PKT-006 | | true | visual_confirmation |
| screen | 名前 `.slot-in` の位置(:145-151)は変更しない | 名前はひし形の外(横並びは下、ひし形は上下左右) | 素材の敷き方(104%)がずれると先端が slot の辺から外れ、名前と枠の間隔が変わって 2 行の長い名前が石の縁に重なる / 離れすぎる。ひし形並びの左右で斜辺に重なる | 読みにくい | 横並び・ひし形並びで 2 行になる名前(「：」付き)のスクショ | TC-PKT-007, TC-PKT-008 | | false | |
| screen | `.no-name`(:154) | 名前を消す(画像ありのときだけ) | 素材 + 画像だけになる。名前領域の残骸や空の `？` が出ない | 軽微 | スクショ | TC-PKT-009 | | false | |
| screen | `.no-frame .slot::before { display: none }`(:157)と新 `.icons .slot::before` の優先順位 | 枠を出さない設定 | `.icons` 側に display を書く、または :157 より後ろに書いて no-frame が効かなくなる。逆に no-frame 解除後に素材が戻らない | 設定が効かない | no-frame で `::before` の display none、解除で素材に戻る | TC-PKT-010 | | false | |
| screen | 素材の透明部分(四隅)と中央の不透明度 248/255 | 背景(透過 / ピンク / グリーン)が四隅に通る | background-color の残りで四隅が白 / 黒で塗られる。中央 248/255 はピンク / グリーン背景でわずかに透ける(約 3%) | OBS で四角い影が出る / 中央の色味 | 透過(市松)/ ピンク / グリーンで slot の四隅と中央のピクセル値 | TC-PKT-011 | | false | |
| screen | OBS ブラウザソース(CEF)での表示 | 透過で配信に載せる | ブラウザでは出るが OBS でキャッシュ(旧 CSS)・パスの違いで素材が出ない。透過が抜けない。グリーン(クロマキー)で石の縁の半透明ピクセルに緑のフリンジ | 本番で崩れる | OBS 実機(キャッシュ更新後)でゲーム画面の上に重ねて確認 | TC-PKT-012 | | false | |
| screen | 画像オフ(Pages 版で「パークの画像」オフ)/ 画像なし | 今までどおり白いひし形 + 中に名前 + k 赤 / s 青 | `.icons` 外の CSS を触って白いひし形・色線・名前位置が崩れる(回帰) | zip 版と同じ見た目が壊れる | 画像オフで k / s のスクショ + computed style(白地・rotate 45deg・色線) | TC-PKT-013 | | false | |
| external_if | zip 版(`icons/` も `official/` も無い) | 名前だけで動く | CSS が `.icons` 外で `perk-bg.png` を参照して 404 が出る / 白い枠が消える | 配布物不良 | zip 相当のディレクトリで開いて requestfailed を監視 | TC-PKT-014 | | false | |
| external_if | `scripts/package-tool.sh:20-31` | zip に必要なものだけ入れる | `official/` が zip に混入(zip 非同梱の決定に反する)。将来 `assets/` に移されて混入 | 配布物に素材が入る | `unzip -l` で `official/` `icons/` が無い | TC-PKT-015 | | false | |
| external_if | GitHub Pages(main root をそのまま公開) | 素材が Pages で配信される | ファイル未 add、パスの大小文字違い(Pages は区別する)、`.gitignore` で Pages 上 404 → 地が消えて白い線画だけになる | Pages 版で地が消える | `git ls-files` に含まれる + `url()` の文字列がファイル名と一致 | TC-PKT-016 | | false | |
| batch | 週次 `.github/workflows/dbd-perks-update.yml`(`git add tools/dbd-perks`) | パーク情報の更新 | 更新スクリプトが `tools/dbd-perks` を掃除して `official/` が消える | Pages 版で地が消える | コード確認: `scripts/update-dbd-perks.py:30,169` は `icons/` だけを扱い、他ディレクトリを消さない。該当なし | | 更新スクリプトは `icons/` 以外を触らない(コード確認済み)。素材の有無は TC-PKT-016 で担保 | false | |
| report | `CREDITS.md` / `CHANGELOG.md` / `tool.json` | 権利表記と版 | 出典・利用条件・zip 非同梱の記載漏れ。版上げ忘れで Pages の表示とタグがずれる | 権利・運用 | 人の目(CREDITS)+ grep(0.2.6) | TC-PKT-017, TC-PKT-018 | | true | business_risk_acceptance |
| report | `docs/requirements/dbd-perks.md:19,33,34` | 要件の正本 | 「枠は自作 / 公式の枠画像は使わない / キラー赤・サバイバー青」が owner 決定(2026-11-03)と矛盾したまま残り、次の棚卸・実装で混乱する | docs の正本がずれる | 人の目 | TC-PKT-020 | | true | design_philosophy_deviation |
| auth | セキュリティ(外部読込・入力・secret) | — | 素材は相対パス `url(official/perk-bg.png)` のみ。外部 URL・inline script・ユーザー入力・secret の追加なし。PNG の付加チャンクは iCCP / pHYs のみ(tEXt 無し、個人情報なし)。injection / 認可 / パス操作は該当なし。残る確認は「外部 URL を足していない」こと | なし | `http(s)://` の grep + PNG チャンク一覧 | TC-PKT-019 | | false | |
| screen | 画像のないパーク(`icon` 無し)が画像ありモードに出る | 素材のひし形が空で名前は外 | 空のひし形だけが出て違和感 | 軽微 | 現状 321 / 321 に画像あり。再現に `perks-data.js` の改変が要る | TC-PKT-021 | 到達しない(321 / 321 画像あり)。週次更新で画像なしのパークが出た時に手動確認 | false | |
| screen | 1 枠だけまわす・固定枠 | 他の枠は動かない | 停止ポップが固定枠にも走る / 固定枠の素材が変わる | 軽微 | 1 枠だけまわしてスクショ | TC-PKT-023 | | false | |
| screen | 素材の石の縁が半透明(不透明度 8 割前後。実測で緑地 (0, 51, 0))| 背景「グリーン」でクロマキーで抜く | 縁が暗い緑になり、クロマキーで欠ける / 緑のにじみが残る(統合検証で発見) | 中(グリーン背景の利用者だけ) | 緑地のスクショで縁の帯の色を測る | TC-PKT-024 | | false | |

## 3. 追加する試験項目(全通り)

表示の組み合わせ: 役割 k/s × 並び row/diamond × 枠あり/なし × 名前あり/なし × 画像あり/なし × 状態(待機・回転中・停止直後) × 背景(透過 / ピンク / グリーン)。変更は `.icons`(画像あり)配下の CSS に閉じるので、画像ありを主軸に組み、画像なしは回帰として置く。省略は §5。

| test_case_id | title | 由来(possible_risk) | 条件 |
|---|---|---|---|
| TC-PKT-001 | 横並び・待機: 素材の位置と大きさ | 位置ずれ・タイル・打ち消し漏れ | k / 画像あり / 枠あり / 名前あり / 横並び / 待機 / 透過 |
| TC-PKT-002 | ひし形並び・待機: 素材の位置と大きさ | 位置ずれ・隣の枠との重なり | s / 画像あり / 枠あり / 名前あり / ひし形 / 待機 / 透過 |
| TC-PKT-003 | 役割 k / s で素材が同じ(色線なし) | 色線の残り | k と s / 画像あり / 枠あり / 横並び / 待機 |
| TC-PKT-004 | 回転中の地色が素材のまま | 回転中のちらつき | k / 画像あり / 枠あり / 横並び / 回転中 / ピンク |
| TC-PKT-005 | 停止直後のポップが回転なし | 旧 keyframe の rotate | s / 画像あり / 枠あり / ひし形 / 停止直後 / 透過 |
| TC-PKT-006 | パーク画像と石の縁の重なり | 画像の端が縁に乗る | k・s / 画像あり / 枠あり / 横並び・ひし形 / 待機(固定表示) |
| TC-PKT-007 | 名前の位置(横並び・2 行名) | 名前と縁の干渉 | k / 画像あり / 枠あり / 名前あり / 横並び / 待機 |
| TC-PKT-008 | 名前の位置(ひし形並び・上下左右) | 名前と斜辺・隣の枠の干渉 | k / 画像あり / 枠あり / 名前あり / ひし形 / 待機 |
| TC-PKT-009 | パーク名なし(画像だけ + 素材) | 名前領域の残骸 | s / 画像あり / 枠あり / 名前なし / 横並び・ひし形 / 待機 |
| TC-PKT-010 | 枠なし(no-frame)× 画像あり | no-frame が効かない | k / 画像あり / 枠なし / 名前あり・なし / 横並び・ひし形 / 待機 |
| TC-PKT-011 | 背景 透過 / ピンク / グリーンでの透明部分 | 四隅の塗りつぶし・中央の透け | k / 画像あり / 枠あり / 横並び / 待機 / 背景 3 種 |
| TC-PKT-012 | OBS 実機: 透過とクロマキー | OBS で出ない・透過しない・緑フリンジ | k / 画像あり / 枠あり / ひし形 / 待機〜停止 / 透過・グリーン |
| TC-PKT-013 | 画像オフで今までどおり(回帰) | `.icons` 外の崩れ | k・s / 画像オフ / 枠あり / 名前あり / 横並び・ひし形 / 待機・停止直後 |
| TC-PKT-014 | zip 相当で白いひし形・素材の要求なし | zip 版の壊れた参照 | k / 画像なし(icons/ official/ 無し)/ 枠あり / 横並び / 待機・停止直後 |
| TC-PKT-015 | zip の中身に official/ と icons/ が無い | 混入 | `scripts/package-tool.sh dbd-perks` |
| TC-PKT-016 | 素材が git 管理・参照パス一致 | Pages 上 404 | `git ls-files` / `url()` |
| TC-PKT-017 | CREDITS.md の出典・利用条件・zip 非同梱 | 権利表記漏れ | `tools/dbd-perks/CREDITS.md` |
| TC-PKT-018 | 版 0.2.6(tool.json / CHANGELOG) | 版上げ忘れ | `tool.json` / `CHANGELOG.md` |
| TC-PKT-019 | セキュリティ: 外部 URL 読込なし・PNG メタデータ | 外部読込・メタデータ | `style.css` / `app.js` / `index.html` / `perk-bg.png` |
| TC-PKT-020 | 要件 docs の枠の記述を owner 決定に合わせる | docs 正本のずれ | `docs/requirements/dbd-perks.md:19,33,34` |
| TC-PKT-021 | 画像のないパークが画像ありモードに出る | 空のひし形 | 到達しない(not_tested) |
| TC-PKT-022 | ブラウザ縮小表示(fitStage)での素材 | 縮小時のにじみ・継ぎ目 | k / 画像あり / 枠あり / 横並び / 待機 / 1280×720 |
| TC-PKT-023 | 1 枠だけまわす・固定枠 | 固定枠へのポップ波及 | k / 画像あり / 枠あり / 横並び / 停止直後 / 透過 |
| TC-PKT-024 | グリーン背景で石の縁が緑にならない(素材を 3 枚重ね) | 縁の半透明でクロマキーが欠ける | k / 画像あり / 枠あり / 横並び / 待機・回転中 / グリーン・ピンク・透過 |

→ test-case master `docs/development/test-cases/master/dbd-perks.yaml` へ反映済み。

## 4. 要確認(review_required)

| 行 | review_reason | blocking_release | note |
|---|---|---|---|
| パーク画像と石の縁の重なり(TC-PKT-006) | visual_confirmation | false | 素材の内側は今の枠よりやや狭い可能性。重なるなら `.icons .slot-icon` の 13% / 74% を 15% / 70% 程度に詰める(owner / ぽこの目で判断) |
| 権利表記(TC-PKT-017) | business_risk_acceptance | false | 「公式の公認クリエイター向け Free to Use 素材」の利用条件の原本(配布元・条件文)は owner が確認済み(2026-11-03)。Pages で誰でも見られる形で配信する前提の受容を CREDITS に明記する |
| 要件 docs の矛盾(TC-PKT-020) | design_philosophy_deviation | false | `docs/requirements/dbd-perks.md:19,33,34` の「枠は自作 / 公式の枠画像は使わない / 色線」は owner が 2026-11-03 に決定を変えたもの。同じ PR で要件を更新し、dev-intent に決定を残せば解消 |

## 5. メモ

- 省略した試験と理由:
  - 画像なし × 枠なし(名前だけ)/ 画像なし × 回転中 × 背景: 今回の CSS は `.icons` 配下に閉じるので変化なし。TC-PKT-013 / 014 の回帰で代表させる。
  - 画像なし × 名前なし: UI 上作れない(`app.js:280-282` で画像なしでは「パーク名」を押せない)。
  - 回転中 × 背景 3 種、停止直後 × 背景 3 種: 地色は背景と独立(TC-PKT-004 / 005 と TC-PKT-011 の直積は取らない)。
  - 役割 × 並びの全直積: 役割は TC-PKT-003 で `::before` が同一と確認するので、以降は k / s を試験ごとに振り分ける。
  - 週次更新 CI で `official/` が消える: `scripts/update-dbd-perks.py` は `icons/` 以外を触らない(コード確認)。
  - 画像のないパーク(TC-PKT-021): not_tested。321 / 321 に画像あり。
- 残リスク:
  - 中央の不透明度 248/255 による約 3% の透け(ピンク / グリーン背景で色味がごくわずかに変わる)。素材をそのまま使う決定なので受容。
  - 役割の色の見分けがなくなる(owner 了承済み)。配信画面でキラー / サバイバーの区別はパーク画像と名前で付く。
  - OBS のブラウザソースは CSS をキャッシュするので、Pages 反映後は「ソースのキャッシュを更新」が要る(TC-PKT-012 の手順に含める)。
- 実装の注意(構築役へ): 新しい CSS は `.icons .slot::before, .icons .slot.spinning::before` の 1 ブロックに `left/top: -2%; width/height: 104%; border: 0; border-radius: 0; box-shadow: none; transform: none; background: url("official/perk-bg.png") center / contain no-repeat;` をまとめて書く(spinning も同じ素材。:87 が勝たない)。`.icons .slot.stopped::before { animation-name: slot-pop-flat; }` と `@keyframes slot-pop-flat { 0% { transform: scale(.86); } 100% { transform: scale(1); } }` を足し、duration / easing は :88 を継ぐ。`.no-frame .slot::before`(:157)より前に書き、display は書かない。worktree の `style.css` 差分(2026-11-03 時点)はこの形になっている。
