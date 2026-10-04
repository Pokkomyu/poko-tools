# CHANGELOG

## 0.1.0 (2026-10-04)
- `Pokkomyu/obs-work-tracker` から移植(ピンク / 赤 / 白 / 黒 / 紫 / クエスト画面風)
- 色ごとの HTML を `<色>.html` に改名(`tracker-tarkov.html` は `quest.html`)。`index.html` は色を選ぶページ
- 保存キーを `poko-tracker-<色>-v1` に変更(GitHub Pages で他のツールと同じ場所に置くため)。移植前の記録は引き継がない
- タスク名を HTML として解釈しないようにした(`<` などを含む名前がそのまま表示される)
- 操作欄に版を表示
- けいふぉんと版は Web 公開に含めない(フォントを同じ場所に置けないため)
