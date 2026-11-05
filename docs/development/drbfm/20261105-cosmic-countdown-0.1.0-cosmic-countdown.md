---
type: drbfm
repo: poko-tools
ticket_id: cosmic-countdown-0.1.0
change_title: コズミックカウントダウン: ぽこ作の星空カウントダウンを poko-tools に収録し、不具合修正・フォント同梱・固定ステージ化する
version_tier: minor
status: draft
created: 2026-11-05
updated: 2026-11-05
owner: devuser
canonical_path: docs/development/drbfm/20261105-cosmic-countdown-0.1.0-cosmic-countdown.md
tags: [drbfm, poko-tools, cosmic-countdown]
---

# DRBFM: cosmic-countdown-0.1.0 コズミックカウントダウンの収録

> スキーマ: SQA `schemas/drbfm.schema.yaml` / 生成方針: SQA `docs/features/drbfm-generation.md`
> 設計: 設計レビュー役(Fable)2026-11-05。owner の指示は `docs/development/dev-intent/cosmic-countdown-0.1.0.md` に残す。

## 1. 変更概要

- 背景 / 目的: 星乃ぽこが作った OBS 用の星空カウントダウン(`cosmic-countdown-handoff.zip`、1 ファイルの HTML)を `tools/cosmic-countdown/` に収録する。poko-tools の体裁(index.html・tool.json・MANUAL・CHANGELOG・CREDITS・フォント同梱)に合わせ、コードで確認した不具合を直し、0 秒通過の演出を足す。
- バージョン区分と根拠: **minor**(新しい道具、0.1.0)。memory「tool versioning」(新しい道具 = minor)と `docs/development/test-asset-lifecycle-policy.md` §3。
- 変更内容:
  - 受領物 `cosmic-countdown.html` → `index.html`。Google Fonts の `<link>` を外し、M PLUS Rounded 1c(500/800)と Orbitron(600/800、改名して CosmicDigits)を subset した woff2 を `fonts/` に同梱。
  - 画面: 1920x1080 固定ステージ + 右に操作パネル 400px。OBS ソースは 2320x1080、右 400px をクロップ(owner 決定 2026-11-05)。ページ全体はウィンドウに合わせて拡大縮小(conventions.md:18)。
  - 不具合修正: 年次の 2/29、毎分の全描画し直し(アニメの再起動)、星空 rAF の無条件ループ、tick 250ms、日時変更時の進捗開始点、storage イベントで入力中のエディタが作り直される、長押しのインターバルが止まらない、保存データの正規化なし、見出しの text-shadow、空メッセージが配信に映る。
  - 追加: `?id=`(保存キーを分ける)・`?bg=transparent`、旧キー `cosmicCountdown.v1` からの移行、0 秒通過の星の爆発と当日カードの光、reduced-motion、パネル最下部の版表示、対話の日本語入力の注意。
  - スコープ外: OBS ホットキー連動、カード内の配置・寸法の調整、配色の変更、表示名の確定(仮に「コズミックカウントダウン」)。
- 影響範囲候補: 画面(`tools/cosmic-countdown/` の新規ファイルのみ)、保存(localStorage の新キー)、配布物(`scripts/package-tool.sh` の zip に fonts/ が入るか)、権利表記(CREDITS・OFL 全文)、要件 docs(`docs/requirements/cosmic-countdown.md` 新規)。API / DB / 権限 / 既存の道具: なし。

## 2. DRBFM 表

| part | change_point | function | possible_risk | impact | detection | test_to_add | skip_reason | review_required | review_reason |
|---|---|---|---|---|---|---|---|---|---|
| logic | 年次の繰り越し(`resolve`)を月日保持+日クランプに | 毎年のカウント | 非閏年に 2/29 が無く 3/1 にずれ、その後も戻らない | 誕生日などの日付が配信でずれる | 2029-02-27 と 2032-02-27 の固定時刻で表示を見る | CC-T03 | | false | |
| logic | 24 時間の当日表示 → 翌年 / 終了 | 当日の扱い | 境界の 1 秒で当日と翌年が入れ替わらない | 当日なのに来年のカウントが出る | 固定時刻で 24h 経過前後 | CC-T01, CC-T02 | | false | |
| screen | 差分描画(`Map<id, element>`) | 毎分の並べ直し | 並び替えで要素を動かすと CSS アニメが再起動し、当日カードの pulse が毎分跳ねる | 配信で目立つ | `render()` 前後の要素同一性、MutationObserver で childList 変化 0 | CC-R02 | | false | |
| screen | 差分描画 | 削除 | 削除した項目の要素が残る | 幽霊カード | 追加・削除後の要素数 = items 数 | CC-R01 | | false | |
| screen | 星空 rAF の停止 / 再開(`syncAnim`) | 星空 ON/OFF・非表示 | 再開漏れで星が止まる / 停止漏れで CPU を使い続ける | 見た目・OBS の負荷 | rAF 呼び出し回数を数える | CC-A01, CC-A02 | | false | |
| logic | tick を秒境界の setTimeout(1 Hz)に | 残り時間表示 | 非表示から戻ったとき表示が古い / 0 秒通過の判定を落とす | 1 秒ずれ・演出が出ない | visibilitychange で即 tick、diff の符号変化で判定 | CC-T01, CC-C01 | | false | |
| logic | 日時変更で `created` を更新 | 進捗バーの開始点 | 長押し中に毎回更新される(最後の変更時刻になる。仕様として明記) | バーが 0% から | 変更直後 0%、半分進めて 50% | CC-T05 | | false | |
| screen | storage イベントでのエディタ再構築を保留 | 2 ソース・2 ウィンドウの同期 | フォーカスが外れず反映されない / 入力中の文字が消える | 別ソースの変更が見えない・入力が消える | 入力中に storage を起こして値とフォーカスが残る、blur 後に反映 | CC-S01, CC-S02 | | false | |
| screen | 長押しを Pointer Events に、`isConnected` で停止 | 長押しで連続変更 | ボタンが DOM から外れるとインターバルが止まらず、save/render が 14 回/秒続く | 値が勝手に進む・負荷 | 押下中に `renderEditors()` を強制してインターバル停止 | CC-E03 | | false | |
| logic | 保存データの正規化(`normalize`) | 起動 | 型の違う値(scale が文字列、title 欠落)で "undefined" 表示・文字連結・例外 | 起動不能・表示崩れ | 壊れた保存を投入して起動 | CC-L03 | | false | |
| logic | 旧キー `cosmicCountdown.v1` → `poko-cosmic-countdown-v1` 移行 | 既存利用者のデータ | 旧データが壊れていて起動不能 / 旧キーを消して戻せない | ぽこの登録が消える | 旧キーのみの状態で起動、旧キーが残る | CC-L02 | | true | business_risk_acceptance |
| logic | `?id=` で保存キーを分ける | 複数ソース | 不正文字でキー衝突・想定外の値 | 項目が混ざる | `?id=main` / `?id=bad!!` | CC-P01 | | false | |
| screen | 1920x1080 固定ステージ + パネル 400px、全体を拡大縮小 | 配信画面とクロップ | OBS ソース幅を 2320 以外にするとクロップ位置がずれ、パネルの端が映る / カードが切れる | 配信に操作パネルが映る | viewport 2320x1080 と 1160x540 で矩形を測る、OBS 実機 O-1 | CC-L04, CC-L05, O-1 | | false | |
| screen | 星空 canvas をステージの論理サイズで作る | 星空 | ウィンドウサイズで作り直す処理が残り、縮小時に星がにじむ・二重に縮む | 見た目 | 1160x540 のスクショ | CC-L05 | | false | |
| screen | 多数の項目 + 表示サイズ 300% | カード表示 | ステージの外(パネル側)にカードがはみ出す | 配信画面の右端が切れる | 12 件 + 300% で x≥1920 にカードが無い | CC-L06 | | false | |
| screen | 同梱フォント(subset woff2) | 文字の見た目 | file:// で読めない / subset 外の字で代替書体 / 外部へ読みに行く | 見た目が変わる・オフラインで崩れる | `document.fonts.check`、file:// 以外の要求 0 件、`𠮷` を表示 | CC-F01, CC-F02 | | false | |
| screen | 透過切替と `?bg=transparent` | 背景 | OBS 外で透明のまま白地で見えない / OBS 内で市松が出る | 設定できない・配信に市松 | OBS あり / なし × bg 指定あり / なし | CC-B01..B04 | | false | |
| screen | 空メッセージを OBS 内で出さない | 項目 0 件 | 「＋ から追加してね」が配信に映る | 配信の見た目 | `window.obsstudio` ありで非表示 | CC-B03 | | false | |
| screen | 0 秒通過の爆発・当日カードの光 | 演出 | 読み込み時に既に当日の項目で起動ごとに爆発 / 爆発がカードの外にはみ出す | 再読み込みのたびに演出 | ロード時に当日 → `.celebrate` なし、diff>0→≤0 で付き 4 秒で外れる | CC-C01, CC-C02 | | false | |
| screen | reduced-motion | 演出 | 動きを減らす設定でも動く | アクセシビリティ | `emulateMedia({reducedMotion:'reduce'})` で animationName none | CC-C03 | | false | |
| screen | 全トグルの組み合わせ | 設定 | 組み合わせで body class と保存値がずれる | 設定が効かない | 6 トグル 64 通り × 横 / 縦 | CC-E01 | | false | |
| screen | 日時ステッパー・削除 2 段階・絵文字候補 | 編集 | 月の wrap・月末クランプ・年の範囲外、確認なしで削除 | 誤登録・誤削除 | 境界・3 秒で戻る・候補の中身 | CC-E02, CC-E04, CC-E05 | | false | |
| security | 利用者文字列の描画 | タイトル・当日文字・見出し | localStorage / URL 由来の文字列を innerHTML へ入れて XSS | 任意スクリプト実行 | タイトルに `<img src=x onerror=…>`、`img` 要素 0 個 | CC-X01 | | false | |
| docs | 版表示(パネル最下部)と tool.json | 版の確認 | tool.json と表示がずれる | 問い合わせ時に版が分からない | 表示 = tool.json version | CC-V01 | | false | |
| docs | フォントの権利表記 | 再配布 | OFL 全文・出典・subset した旨が欠ける | ライセンス違反 | CREDITS と `fonts/OFL-*.txt` の存在 | (目視) | | false | |
| docs | 同梱フォントの名前(SR-001) | 再配布 | Orbitron は OFL の予約フォント名(RFN)付き。subset は改変版なので、同じ名前のまま配ると OFL 違反 | ライセンス違反 | subset の name テーブル(nameID 1/4/6/16)と `fonts/` のファイル名・index.html の `font-family` に「Orbitron」が無い(grep、fontTools) | (grep) | | false | |
| docs | 表示名(仮) | 名前 | 後で変えるときに書いた場所を取りこぼす | 名前が混在 | 名前は tool.json `displayName`・MANUAL 見出し・パネル見出しの 3 か所だけ(grep) | (grep) | | false | |

## 3. 追加する試験項目(全通り)

受け入れ条件は設計指示書(作業場 `design/01-review.md` §6.1 と `design/03-instructions.md` §2)の CC-* 一覧を正本とする。実行の仕組み(Playwright の置き場所・実行方法)は、全 tool・repo 共通の試験基盤の設計(別作業)が決まってから決める。決まったら test-case master `docs/development/test-cases/master/cosmic-countdown.yaml` に起こす。

| test_case_id | title | 由来(possible_risk) | 条件 |
|---|---|---|---|
| CC-L01..L06 | 起動・移行・正規化・固定ステージ | 正規化・移行・固定ステージ | 保存なし / 旧キー / 壊れた保存、viewport 2320x1080・1160x540 |
| CC-T01..T05 | 時刻と年次 | 2/29・24h・tick・進捗 | `page.clock` で固定時刻 |
| CC-R01, R02 | 差分描画 | 幽霊・アニメ再起動 | 追加・削除・60 秒 render |
| CC-A01, A02 | 星空の停止 / 再開 | rAF | 星空 ON/OFF |
| CC-B01..B04 | 背景 | 透過・市松・空メッセージ | OBS あり / なし × bg |
| CC-P01 | `?id=` | キー衝突 | 正しい id / 不正 id |
| CC-S01, S02 | 同期 | storage 保留 | 2 ページ・入力中 |
| CC-E01..E05 | 編集 | 組み合わせ・境界・長押し・削除・絵文字 | 総当たり |
| CC-C01..C03 | 演出 | 起動時の爆発・reduced-motion | 0 秒通過 / ロード時当日 |
| CC-F01, F02 | フォント | file://・subset 外 | |
| CC-X01 | XSS | innerHTML | |
| CC-V01 | 版表示 | | |
| O-1..O-8 | OBS 実機(ぽこ確認、手順書 HTML) | クロップ・対話・日本語入力・透過・シャットダウン・2 ソース・0 秒・クロップフィルタ | ソース 2320x1080、右 400px クロップ |

## 4. 要確認(review_required)

| 行 | review_reason | blocking_release | note |
|---|---|---|---|
| 旧キー移行(CC-L02) | business_risk_acceptance | false | ぽこの OBS に入っている受領物のデータを新キーへ写す。旧キーは消さないので戻せる。OBS のソースを index.html に差し替えたあとも登録が残るかは、実機で確かめる(手順書に入れる) |

## 5. メモ

- 省略した試験と理由:
  - OBS ホットキー連動・カード配置: スコープ外(owner 決定 2026-11-05)。
  - 配色の組み合わせ: 配色は変えない(owner 決定)。
- 残リスク:
  - OBS の対話では日本語を直接打てない(CEF の制約)。パネルに貼り付けの案内を出す。
  - サイト `/tools/` への掲載は wp-poko 側の別作業(表示名の確定待ち)。
- 既知事項(実装時に確認、仕様として受け入れる):
  - 同じ `id` の 2 ソースで同時にカードを編集すると、後から保存した側の内容で上書きされ、もう一方の編集が消えることがある。普段は OBS 側だけで編集するので頻度は低い。MANUAL どおり、ソースごとに `id` を分ければ起きない。
  - 別ソースから保存が届いたとき、パネルの作り直しは入力が終わるまで(フォーカスが外れるか 5 秒)待つ。入力を続けている間は 5 秒の待ちをやり直す。
  - 上の 5 秒の待ちの間に入力した内容は、作り直しのときに消えることがある(編集欄が差し替え前のデータを持ったまま保存するため。最終レビュー S-1)。OBS 実機手順 O-6 で挙動を記録する。直すなら `load()` を差し替えでなく id ごとのマージにする。
  - 日時を未来から過去に変えたときも、0 秒のお祝い演出が 1 回出る(「残りあり → 0 以下」の変化で出す仕様)。
- 表示名を変えるときに直す場所: tool.json `displayName`・MANUAL 1 行目・パネル見出し(index.html の h2)。ブラウザのタブ名 `<title>Cosmic Countdown</title>` と見出しの既定値「COSMIC COUNTDOWN」は受領物の英字名で、表示名とは別に扱う(変えるかは表示名を決めるときに一緒に決める)。
