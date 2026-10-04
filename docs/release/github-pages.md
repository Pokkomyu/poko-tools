# GitHub Pages 公開

`main` ブランチのルートをそのまま GitHub Pages で公開する(2026-09-24 決定)。
**main にマージした時点で公開される** ので、未完成のものは main に入れない。

| 対象 | URL |
|---|---|
| 一覧 | https://pokkomyu.github.io/poko-tools/ |
| 名前ルーレット | https://pokkomyu.github.io/poko-tools/tools/roulette/ |
| 本日のチャレンジ | https://pokkomyu.github.io/poko-tools/tools/tracker/ (色ごとに `pink.html` などを OBS に貼る) |

- repo は 2026-10-02 に `brantechs/poko-tools` → `Pokkomyu/poko-tools`(ぽっこみゅ Organization)へ移管した。旧 `brantechs.github.io` / `hoshino-poko.github.io` の URL は 404 になるので、BOOTH や公式サイトに載せる URL は上の新 URL を使う
- 公開するのは無料版(`main`)だけ。有償版(`edition/plus`)は main に入れない(`editions.md`)

## 公式サイトからの案内(hoshino-poko.com/tools/)

視聴者向けの入口は公式サイトの案内ページにする(2026-10-01 決定。ツールが増えても `/tools/<tool>/` で並べられる)。

| ページ | URL | 中身 |
|---|---|---|
| ツール一覧 | https://hoshino-poko.com/tools/ | 各ツールへのリンク |
| 名前ルーレット | https://hoshino-poko.com/tools/roulette/ | 説明、「ブラウザで開く」(上の Pages URL)、BOOTH リンク、OBS の設定手順 |

- ページは別 repo `Pokkomyu/wp-poko` の `bin/update_tools_pages.sh` で作る(WordPress の固定ページ)。文面もそちらで管理する
- OBS に貼る URL は Pages のものをそのまま使う(案内ページは転送ではなくリンク)。ツールの URL を変えたら wp-poko 側の文面も更新する
- 告知は BOOTH 公開とは別日に行う(「ブラウザ版も出ました」として分ける)

## 初回設定(devuser)
1. repo を public にする(Settings → General → Danger Zone → Change visibility)
2. Settings → Pages → Build and deployment: Source = Deploy from a branch、Branch = `main` / `/ (root)`
3. 数分後に上の URL が開けることを確認

- ルートの `.nojekyll` は Jekyll 変換を止めて、ファイルをそのまま配信するためのもの。消さない
- 公開サイトは誰でも開ける。中身は BOOTH の無料配布版と同じ

## OBS に設定する(ぽこ向け)
1. ソースの「+」→「ブラウザ」
2. 「ローカルファイル」のチェックを **外して**、URL 欄に上のツールの URL を貼る
3. 幅 1920 / 高さ 1080。効果音を配信に乗せるなら「OBSを介して音声を制御する」をオン
4. 操作パネルのクロップと「対話」での操作はローカルファイル版と同じ(`tools/roulette/MANUAL.md`)

- 名前や設定の保存先は、URL 版とローカルファイル版で別々。切り替えた時は入れ直す
- 更新は OBS のソースを右クリック →「プロパティ」→「現在のページのキャッシュを更新」
