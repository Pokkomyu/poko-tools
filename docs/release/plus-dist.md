# 有償版 zip の受け渡し repo(2026-10-09 決定)

有償版(edition)の zip を、BOOTH に上げる人(星乃ぽこ)へ渡すための **private repo の Releases** の設計。
すべての有償版ツール(ルーレット、今後のツール B、C …)を 1 つの repo で扱う。

## 背景

- 有償版は BOOTH(星乃ぽこのアカウント)でだけ販売する。BOOTH への操作はぽこ本人が行い、スクリプトやブラウザ自動操作では触らない
- これまでは zip を X1C の `dist/` に作り、ぶらんちの Windows に scp → ぽこに Discord で送っていた。版が上がるたびに手で受け渡すのが面倒
- この repo(poko-tools)は public なので、有償版 zip を poko-tools の GitHub Release に上げてはいけない(`editions.md`)

## 方針

| 項目 | 決めたこと |
|---|---|
| repo | `Pokkomyu/poko-tools-plus`(**private**)。有償版 zip の Release と、ぽこ向けの README だけを置く。ソースは置かない(ソースは今までどおり public の poko-tools の edition ブランチ) |
| 対象 | `tool.json` に `edition` がある全ツール。ツールが増えても、edition 名が `plus` 以外になっても repo は増やさない |
| 見る人 | Pokkomyu の Owner(星乃ぽこ、brantechs)。Org Owner は private repo を招待なしで見られる。購入者向けの配布口ではない(購入者は BOOTH から) |
| タグ | `<tool>-<edition>-v<version>`(例 `roulette-plus-v0.4.4`)。zip 名(`package-tool.sh`)と同じ並び。ツールごとに独立して版を重ねられる |
| Release | タイトル `<displayName> v<version>`(ツール名が先頭に来るので一覧で見分けられる)、添付は zip 1 つ、本文は `CHANGELOG.md` のその版の節 + 作った元(poko-tools の edition ブランチとコミット)。`--target` は付けない(poko-tools-plus の既定ブランチの先頭に付く。poko-tools のコミットは渡せない) |
| 通知 | ぽこが repo を Watch →「Custom」→「Releases」にする。新しい Release が出ると `notifications@github.com` から(英語の)メールが届く |
| 一覧 | フェーズ 1 は Releases ページ(新しい順)と README の固定の案内で足りる。ツール別「最新版」の表を README に自動生成するのはツールが 3 つ以上になったらフェーズ 2 で(GitHub の「Latest」は repo に 1 つしか付かず、ツール別にはならないため) |

## 漏洩を防ぐ(最重要)

スクリプトは public の poko-tools の checkout で動く。gh は何も指定しないとカレントの repo(= public)を対象にするので、次の 3 重で止める。

1. スクリプトの冒頭で `export GH_REPO="$PLUS_DIST_REPO"` を固定する(全 gh コマンドの対象が poko-tools-plus になる。`-R` の付け忘れが起きない)
2. 上げる前に `gh repo view "$PLUS_DIST_REPO" --json nameWithOwner,visibility` で、**`visibility` が `PRIVATE`** かつ **`nameWithOwner` が poko-tools の origin と違う** ことを確認する。どちらかが NG なら止まる
3. poko-tools-plus を public にしない。Org の設定で repo の公開範囲の変更を Owner に限る(Member privileges →「Allow members to change repository visibilities」がオフ。2026-10-09 にオフであることを確認済み。オンに戻さない)。public にすると過去の Release もすべて見えてしまう

## スクリプト `scripts/release-edition.sh`(main に置く)

```
scripts/release-edition.sh <tool>           # zip を作り、作る Release の内容を表示するだけ
scripts/release-edition.sh <tool> --apply   # private repo に Release を作って zip を添付する
```

- main に置き、edition ブランチは main を merge して追従するので自動で入る(`editions.md` のルール)。ツール B の有償版が別の edition ブランチ(例 `edition/pro`)になっても、同じスクリプトがそのまま使える
- edition 名は `tool.json` の `edition` から取る(`plus` 固定にしない)。実行するブランチは `edition/<edition>` で、未コミットの変更が無く、`origin/edition/<edition>` と一致していること(push 済みのものだけを出す)
- ほかの確認: `app.js` の `VERSION` と `tool.json` の版が同じ / `CHANGELOG.md` にその版の節がある / 同じタグの Release がまだ無い(あれば何もしない = 何度実行してもよい)
- zip は `package-tool.sh` で作る(ツール単体。他のツールは混ざらない)
- 環境変数: `PLUS_DIST_REPO`(既定 `Pokkomyu/poko-tools-plus`)
- 既存の `deploy-plus.sh`(edition/plus にある)は `edition = plus` 固定。ツール B を別 edition で出す時に同じ直し方をする(今回は触らない)
- `deploy-plus.sh` と `release-edition.sh` がそれぞれ zip を作るので、2 つの zip は中身は同じだがファイルとしては別物(作った時刻が入る)。気になるようなら後で `--zip <path>` を受けるようにする

## poko-tools-plus の README(ぽこ向け・固定文)

```
# ぽこツール 有償版の zip 置き場

BOOTH に出す有償版の zip です。ここは非公開で、購入者には見せません。
GitHub にログインした状態で開いてください。

## 新しい版が出たら
1. 届いたメール(英語、notifications@github.com から)のリンクを開く
   (または右の「Releases」を開き、いちばん上のツール名と版を確認)
2. 「Assets」の .zip をクリックしてダウンロード
3. BOOTH の商品編集 → ダウンロードファイルを新しい zip に差し替えて保存

## ツールと BOOTH の商品
| ツール | BOOTH |
| ぽこルーレット カラー版 | https://hoshinopoko.booth.pm/items/... |
```

ツールを足した時だけ、表に 1 行を手で足す(スクリプトでは書き換えない)。

## 有償版を出す流れ(これから)

| 担当 | やること |
|---|---|
| codex | 修正 → bundle + run.sh |
| ぶらんち | `bash run.sh`: PR・マージ → 無料版 Release → `deploy-plus.sh`(ブラウザ版を本番に反映)→ **`release-edition.sh`(private Release)** → 最後に「ぽこに送る一言(Release URL 入り)」を表示するので Discord に貼る(通知が届かなかった時の保険) |
| ぽこ | 通知を開く → zip をダウンロード → BOOTH の商品編集でファイルを差し替える |

- Windows への scp はやめる(Release から取れるため)

## 最初に 1 回だけ

| 担当 | やること |
|---|---|
| ぶらんち | `gh repo create Pokkomyu/poko-tools-plus --private --add-readme --description "ぽこツール 有償版 zip の受け渡し(BOOTH 出品用)"`(`--add-readme` で最初のコミットができ、タグを付けられる)→ README を上の固定文に差し替え |
| ぶらんち | 既存の有償版(roulette の最新)を `release-edition.sh roulette --apply` で上げる |
| ぽこ | repo を開き、Watch →「Custom」→「Releases」にチェック。GitHub の通知メールが届く設定になっているか確認 |

## やらないこと

- 購入者への配布(BOOTH のまま)。repo を購入者に共有しない
- BOOTH への自動アップロード(星乃ぽこのアカウントは本人だけが操作する)
- 有償版 zip を poko-tools(public)の Release / Pages に置くこと。poko-tools-plus を public にすること
