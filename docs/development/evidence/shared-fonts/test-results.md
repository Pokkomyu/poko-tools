# 試験結果ログ: shared-fonts

- 実行日: 2026-11-05
- 環境: X1C(Linux)、Python 標準ライブラリのみの scripts/fonts.py、Playwright Chromium headless(file://)

| TC | 結果 | 内容 |
|---|---|---|
| TC-FNT-001 | OK | `fonts.py check` OK(4 ツール)、`sha256sum -c SHA256SUMS` NG 0 件 |
| TC-FNT-002 | OK | manifest の全ファイルが存在、各フォルダにライセンス原文あり |
| TC-FNT-003 | OK | roulette に空フォルダ `assets/fonts/x` を作ると NG(rc=1)。削除後 OK |
| TC-FNT-004 | OK | コピーは shared とバイト一致 |
| TC-FNT-005 | OK | manifest の rfn を "X" にすると NG。復元後 OK(OFL 5 書体は RFN 宣言なし = null) |
| TC-FNT-006 | OK | red.html の family 変更・font-weight 700 でそれぞれ NG。復元済み |
| TC-FNT-007 | OK | `../../shared/fonts` 参照で NG。復元済み |
| TC-FNT-008 | OK | 外部 URL で NG。復元済み。dbd-perks perks-data.js 1 行目コメントの URL はコメント除去で通る |
| TC-FNT-009 | OK | dist/tracker-v0.3.1.zip 2,799,438 バイト、assets/fonts/keifont 5 ファイル、他の fonts なし、計 16 ファイル |
| TC-FNT-010 | OK | tracker 7 html で `assets/keifont` 0 件、6 色が `assets/fonts/keifont/keifont.ttf` を参照 |
| TC-FNT-011 | OK | origin/main と作業ツリーで roulette / deco-poko / dbd-perks の `unzip -l`(名前・大きさ)が同一 |
| TC-FNT-012 | OK | release-free.sh:57 / release-edition.sh:77 が package-tool.sh を呼ぶ(grep) |
| TC-FNT-013 | OK | 6 色すべて `document.fonts.check('12px けいふぉんと')` true、face status loaded |
| TC-FNT-014 | OK | コピー改ざんで check と package-tool.sh が rc=1。正本 OFL.txt 改ざんで SHA256SUMS 不一致 NG。復元後 OK |

## サイズ

- shared/fonts: 20,572,694 バイト(約 19.6MiB)
- tracker zip: 2,799,438 バイト(約 2.8MB)

## 取得物

- 取得元: google/fonts commit bbda7253fc363238b05d97515ca71f8ae49c4fa9(2026-11-05)。keifont は既存ファイルを移動(sha256 d5795bdff960)
