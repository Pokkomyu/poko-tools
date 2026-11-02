# 試験結果ログ: dbd-perks-official-perk-bg

- 実行日: 2026-11-03
- 環境: X1C(Linux)、Playwright Chromium headless、file:// で `tools/dbd-perks/index.html` を 1920x1080 で開く(TC-PKT-022 は 1280x720)。zip 相当は icons/ と official/ を除いたコピー
- 判定スクリプトは段取り役の作業領域で実行(computed style・要素の位置・スクショのピクセルで判定)

## 画面の判定(semi_auto)

### TC-PKT-001: OK(2/2 判定)

- OK left -6px,-6px,-6px,-6px top -6px,-6px,-6px,-6px w 312px,312px,312px,312px h 312px,312px,312px,312px
- OK transform none shadow none border 0px bg t/tools/dbd-perks/official/perk-bg.png")

### TC-PKT-002: OK(6/6 判定)

- OK slot0-1 中心の L1 距離 314.0(300 以上で重ならない)
- OK slot0-2 中心の L1 距離 314.0(300 以上で重ならない)
- OK slot0-3 中心の L1 距離 314.0(300 以上で重ならない)
- OK slot1-2 中心の L1 距離 314.0(300 以上で重ならない)
- OK slot1-3 中心の L1 距離 314.0(300 以上で重ならない)
- OK slot2-3 中心の L1 距離 314.0(300 以上で重ならない)

### TC-PKT-003: OK(1/1 判定)

- OK k と s の ::before computed 一致: true

### TC-PKT-004: OK(1/1 判定)

- OK [[true,true,"rgba(0, 0, 0, 0)"],[true,true,"rgba(0, 0, 0, 0)"],[true,true,"rgba(0, 0, 0, 0)"],[true,true,"rgba(0, 0, 0, 0)"]]

### TC-PKT-005: OK(3/3 判定)

- OK stopped true anim slot-pop-flat 0.45s cubic-bezier(0.2, 1.6, 0.4, 1)
- OK ポップ途中の transform matrix(1.01526, 0, 0, 1.01526, 0, 0)(回転成分 0)
- OK 終了後 transform none

### TC-PKT-007: OK(24/24 判定)

- OK k#0 slot0 gap 4.0px
- OK k#0 slot1 gap 4.0px
- OK k#0 slot2 gap 4.0px
- OK k#0 slot3 gap 4.0px
- OK k#1 slot0 gap 4.0px
- OK k#1 slot1 gap 4.0px
- ほか 18 判定もすべて OK

### TC-PKT-008: OK(132/132 判定)

- OK k#0 name0 と diamond0 の L1 距離 154.0
- OK k#0 name0 と diamond1 の L1 距離 318.0
- OK k#0 name0 と diamond2 の L1 距離 318.0
- OK k#0 name0 と diamond3 の L1 距離 468.0
- OK k#0 name1 と diamond0 の L1 距離 435.5
- OK k#0 name1 と diamond1 の L1 距離 164.0
- ほか 126 判定もすべて OK

### TC-PKT-009: OK(2/2 判定)

- OK row: 名前非表示 true
- OK diamond: 名前非表示 true

### TC-PKT-010: OK(8/8 判定)

- OK row/name=true: ::before none filter drop-shadow(rgba(20, 12, 28, 0.9) 0px 0p
- OK row/name=true: 枠を戻して block 312px
- OK row/name=false: ::before none filter drop-shadow(rgba(20, 12, 28, 0.9) 0px 0p
- OK row/name=false: 枠を戻して block 312px
- OK diamond/name=true: ::before none filter drop-shadow(rgba(20, 12, 28, 0.9) 0px 0p
- OK diamond/name=true: 枠を戻して block 312px
- ほか 2 判定もすべて OK

### TC-PKT-013: OK(2/2 判定)

- OK k: bg rgb(255, 255, 255) border 7px tf matrix(0.707107, 0.707107, -0.707107, 0.707107, 0, 0) shadow rgb(255, 59, 71) 0px 0px 0px 6px inset img none anim slot-pop
- OK s: bg rgb(255, 255, 255) border 7px tf matrix(0.707107, 0.707107, -0.707107, 0.707107, 0, 0) shadow rgb(108, 184, 255) 0px 0px 0px 6px inset img none anim slot-pop

### TC-PKT-014: OK(2/2 判定)

- OK class "slots layout-row" optIcon disabled true bg rgb(255, 255, 255)
- OK perk-bg 要求 0 件、失敗 1 件(icons/ の試し読みのみ)

### TC-PKT-019: OK(1/1 判定)

- OK 要求 326 件、file:// 以外 0 件

### TC-PKT-022: OK(1/1 判定)

- OK 1280x720 でも stage 内 312px

### TC-PKT-023: OK(2/2 判定)

- OK 回転中 [[false,0],[false,0],[true,0],[false,0]]
- OK 停止直後 [[],[],["slot-pop-flat"],[]]

### TC-PKT-011: OK
- 背景 透過 / ピンク / グリーンで、4 枠の slot 四隅 48 点が背景色そのまま(市松の灰色 / #ffd0f5 / #00ff00)
- ひし形の内側 20 点(中心から L1 110px 以内)の背景間の最大差 3(基準 10 以下)
- 補足: 素材の石の縁は半透明(不透明度 8 割前後)。対策前はグリーン地で縁が (0, 51, 0) の暗い緑になった → TC-PKT-024 で対策

### TC-PKT-024: OK
- 重ね枚数: グリーン 3 枚(待機・回転中とも)、ピンク・透過 1 枚
- グリーン地の縁の帯(L1 125〜148px): 緑が勝つピクセル 0%、縁の平均色 (0, 2, 0)。対策前は 62〜100%、(0, 51, 0)

### TC-PKT-006: OK(目視、段取り役)
- 横並び・ひし形 × キラー・サバイバーのスクショ計 30 枚超で、パーク画像の線画が紫の内側に収まり石の縁に乗らないことを確認。owner の目視確認も求める(review_required)

### TC-PKT-012: 未実施(manual、OBS 実機)
- ぽこの配信 PC の OBS で確認してもらう(handoff の確認手順に記載)

### TC-PKT-017 / TC-PKT-020: 段取り役の自己点検 OK、owner 確認待ち(manual、review_required)
- CREDITS.md と docs/requirements/dbd-perks.md の差分を owner が読んで承認する

### TC-PKT-021: not_tested
- 321 / 321 パークに画像があり、画像なしのパークが画像ありモードに出る経路が今はない(DRBFM skip_reason)

## ファイル・zip・版・セキュリティ(semi_auto)

```text
== TC-PKT-002 枠の間のピクセル(ひし形並び)
0-1 (571, 461) (138, 138, 138) OK
0-2 (729, 461) (168, 168, 168) OK
1-3 (571, 619) (168, 168, 168) OK
2-3 (729, 619) (138, 138, 138) OK
== TC-PKT-015 zip の中身
['パークスロット/index.html', 'パークスロット/app.js', 'パークスロット/perks-data.js', 'パークスロット/style.css', 'パークスロット/CREDITS.md', 'パークスロット/CHANGELOG.md', 'パークスロット/使い方.txt', 'パークスロット/利用規約.txt']
official/icons/png: なし
== TC-PKT-016 素材の置き場と参照
合計 64
-rw-rw-r-- 1 codex codex 61456 11月  3 01:28 perk-bg.png
check-ignore exit=1 (1=無視されない)
      4 url("official/perk-bg.png")
== TC-PKT-018 版
  "version": "0.2.6",
  app.js: var VERSION = "0.2.6"(統合検証で 0.2.5 のままだったのを見つけて直した。画面右下の表示もこの値)
## 0.2.6 (2026-11-03)
- パークの画像を出しているとき、ひし形の背景をゲームと同じパークの背景(公式素材)にした。キラー赤 / サバイバー青の線はなくした(Web 版だけ。zip 版は今までどおり)
== TC-PKT-019 追加行の外部 URL・script
なし
PNG チャンク: ['IDAT', 'IEND', 'IHDR', 'iCCP', 'pHYs'] tEXt/iTXt/zTXt/eXIf: なし
```
