# BOOTH 出品前チェックリスト

- [ ] `tool.json` の version と `CHANGELOG.md` を更新した
- [ ] `scripts/package-tool.sh <tool>` で zip を作った
- [ ] (無料版)`scripts/release-free.sh <tool> --apply` で GitHub Release に同じ zip を上げた
- [ ] (有償版)edition ブランチで `scripts/release-edition.sh <tool> --apply` を実行し、private repo `Pokkomyu/poko-tools-plus` の Release に上げた(poko-tools の Release には上げない。`plus-dist.md`)
- [ ] zip を別フォルダに解凍し、index.html をダブルクリックで動作確認した(Chrome / Edge)
- [ ] OBS のブラウザソース(ローカルファイル)で動作確認した(背景透過・クロップ・対話操作・音)
- [ ] `CREDITS.md` の素材すべてが再配布可能
- [ ] `利用規約.txt` の内容を確認した
- [ ] 商品ページにスクリーンショット / 使い方GIF を載せた
