# shared/fonts — 共有フォントの正本

poko-tools の複数のツールで使うフォントの置き場。ここが正本で、各ツールは `tools/<tool>/assets/fonts/<id>/` に**同じ内容のコピー**を持つ(zip は `tools/<tool>/` だけを固めるため、ここを直接は読めない)。

- 一覧と台帳: `manifest.json`(family / weight / ライセンス / RFN / 取得元 / 取得日)。ライセンス種別と RFN の正本はこの台帳
- 改ざん検出: `SHA256SUMS`(`sha256sum -c SHA256SUMS` で確認。`scripts/fonts.py check` も確認する)
- 各フォルダ: フォント本体 + ライセンス文(OFL.txt など)。ライセンス文は必ずフォントと一緒に置く

## 使い方

1. フォントを足す: `shared/fonts/<id>/` にフォントとライセンス文を置き、`manifest.json` と `SHA256SUMS` に足す
2. ツールで使う: `tools/<tool>/tool.json` の `"fonts"` に `<id>` を足し、`python3 scripts/fonts.py sync` でコピーを作る
3. HTML / CSS からは `assets/fonts/<id>/<file>` だけを参照する(`../../shared/` は zip で壊れるので使わない)
4. `python3 scripts/fonts.py check` が通ること(CI の qa-gate と `package-tool.sh` でも実行される)

## 収録

| id | 表示名 | ライセンス | 取得元 |
|---|---|---|---|
| dela-gothic-one | Dela Gothic One | OFL-1.1 | google/fonts @ bbda725 |
| mochiy-pop-one | Mochiy Pop One | OFL-1.1 | google/fonts @ bbda725 |
| dotgothic16 | DotGothic16 | OFL-1.1 | google/fonts @ bbda725 |
| reggae-one | Reggae One | OFL-1.1 | google/fonts @ bbda725 |
| kaisei-decol | Kaisei Decol(700 のみ) | OFL-1.1 | google/fonts @ bbda725 |
| keifont | けいふぉんと! | Apache-2.0 | Do-Font(配布元 zip を無変換) |

OFL のフォントは Reserved Font Name なし(各 OFL.txt の著作権表示行に付記がない)。そのため無変換の TTF をそのまま同梱している。
