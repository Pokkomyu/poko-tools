# 有償版(edition)の運用

無料版と有償版を同じ repo で扱うためのルール(2026-10-01 Discord で決定。「設定で切り替える」より「別物として分ける」方が使う人に分かりやすい)。

## 版の一覧

| 版 | ブランチ | tool.json | 配布 |
|---|---|---|---|
| 無料版 | `main` | `edition` なし | BOOTH 無料 + 開発支援版(中身同一) + GitHub Pages |
| カラー版 | `edition/plus` | `"edition": "plus"`、displayName「ぽこルーレット カラー版」 | BOOTH 有償のみ |

## ルール

- 有償版のブランチは **main にマージしない**。main は GitHub Pages で誰でも見られるので、main に入れた時点で無料公開になる
- 有償版のブランチは main から分岐し、main が進んだら **main を merge** して追従する(無料版の修正は有償版にも入る)。rebase はしない(push 済みのブランチなので force push が要る)。cherry-pick で 1 つずつ拾うのもやらない(拾い漏れが起きるし、どこまで取り込んだか追えなくなる)。有償版だけの変更は有償版のブランチにだけ入れる
- 無料版に入れたい機能は main に入れる。有償版のブランチから cherry-pick で逆流させない(差分が有償版の機能だけになるように保つ)
- 版の違いは `tools/<tool>/` の中と `packaging/LICENSE_<edition>_ja.md`、`scripts/package-tool.sh` の edition 対応だけに閉じる。docs は main で管理する
- バージョンは有償版のブランチ側で独自に上げる(無料版 0.3.x に対してカラー版は 0.4.0 から)。`CHANGELOG.md` の見出しに版名を付ける
- repo は public なので、ブランチ上のソースは誰でも読める。売っているのは「動く zip + 利用規約 + サポート」で、コードを隠すことではない(`.private/distribution-policy.md` の案 D 相当)

## main に追従する(無料版を更新したら必ずやる)

無料版の版を上げて main にマージしたら、同じ日に有償版へ取り込む。放置すると有償版だけ古いバグが残る。

```bash
cd <edition/plus の worktree>
git fetch origin
git merge origin/main        # 衝突したら tools/<tool>/ の中だけ見て解決する(docs は main の内容をそのまま取る)
scripts/package-tool.sh roulette   # zip を作り、解凍して動作確認(booth-checklist.md)
git push
```

- 追従したら有償版の `CHANGELOG.md` に「無料版 x.y.z の修正を取り込んだ」と 1 行書き、必要なら有償版の版も上げる
- どこまで取り込んだかは `git log --oneline edition/plus..main` で確認できる(空なら追従済み)
- 衝突を減らすために、有償版だけのコードはできるだけ別ファイルに寄せる(次の整理候補: `app.js` の配色部分を `plus.js`、配色タブの CSS を `plus.css` に分け、`app.js` と `index.html` には呼び出し口だけ残す)
- 自動化の選択肢: GitHub Actions で main への push をトリガーに `edition/plus` へ merge を試み、衝突した時だけ PR を作る。この repo は CI 無しで運用しているので、入れるかは別途判断

## zip を作る

```bash
git worktree add ../poko-tools-plus edition/plus
cd ../poko-tools-plus
scripts/package-tool.sh roulette   # dist/roulette-plus-v0.4.0.zip(利用規約は LICENSE_plus_ja.md)
```

- 出品前チェックは無料版と同じ(`booth-checklist.md`)
- ブランチ上の `tools/<tool>/MANUAL.md` と `CHANGELOG.md` は有償版の内容になっている(無料版の履歴も含む)
