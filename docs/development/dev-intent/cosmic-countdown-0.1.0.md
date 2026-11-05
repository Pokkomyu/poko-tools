---
type: dev_intent_log
repo: poko-tools
ticket_id: cosmic-countdown-0.1.0
status: draft
created: 2026-11-05
updated: 2026-11-05
owner: devuser
canonical_path: docs/development/dev-intent/cosmic-countdown-0.1.0.md
tags: [dev-intent, human-input, poko-tools]
---

# 開発意図ログ: cosmic-countdown-0.1.0 コズミックカウントダウンの収録

> 生成方針: `docs/development/test-asset-lifecycle-policy.md` §5

## 1. 人間入力の記録

| entry_id | 日時 | 入力(要旨。重要なものは原文を短く引用) | 種別 | 読み取った意図 | 反映先 |
|---|---|---|---|---|---|
| DI-cosmic-countdown-0.1.0-001 | 2026-11-05 | 「cosmic-countdown-handoff.zip をブラッシュアップしてほしい」。置き場所は poko-tools/tools/ | 指示 | ぽこ作の受領物を poko-tools の道具として収録する | tools/cosmic-countdown/ |
| DI-cosmic-countdown-0.1.0-002 | 2026-11-05 | 重視点: コード品質・不具合 / 見た目・演出 / poko-tools 体裁 / OBS 実機での確認 | 回答 | 不具合修正と演出の追加、体裁ファイル、OBS 手順書まで | DRBFM / MANUAL / 手順書 |
| DI-cosmic-countdown-0.1.0-003 | 2026-11-05 | ぽこ「ホットキーは別にいらないかなあ〜」(ホットキーの要望は PokoCounter のことだった) | 回答 | OBS ホットキー連動は入れない | 設計指示書 §4.3 |
| DI-cosmic-countdown-0.1.0-004 | 2026-11-05 | ぽこ「可愛くていい感じのフォントで」。devuser「フォントおまかせ」 | 委任 | フォントは設計レビュー役が選ぶ(M PLUS Rounded 1c + Orbitron を同梱) | fonts/ / CREDITS.md |
| DI-cosmic-countdown-0.1.0-005 | 2026-11-05 | ぽこ「カード内の配置が微妙」。devuser「レイアウト調整はあとで」 | 回答 | 今回はカードの配置・寸法を変えない | DRBFM §5 |
| DI-cosmic-countdown-0.1.0-006 | 2026-11-05 | 表示名「一旦コズミックカウントダウンですすめるけど、後で変更したい」 | 回答 | 名前は変えやすい場所(3 か所)だけに置く | tool.json / MANUAL / パネル |
| DI-cosmic-countdown-0.1.0-007 | 2026-11-05 | 配色は受領物のまま | 回答 | 色は変えない | — |
| DI-cosmic-countdown-0.1.0-008 | 2026-11-05 | 「固定画面にしてクロップでいいか？」→ 1920x1080 固定 + 右 400px クロップで「それで」 | 回答 | conventions の固定ステージに合わせる。OBS ソースは 2320x1080 | docs/requirements/cosmic-countdown.md / MANUAL / tool.json |
| DI-cosmic-countdown-0.1.0-009 | 2026-11-05 | 「playwright は他の tool や repo でも同じなのでしっかり設計しよう」「検証だと思うので先に設計を進めたい」 | 指示 | 試験の仕組みは全体共通で別に設計する。道具の設計・実装を先に進め、試験は後で合わせる | DRBFM §3 |

## 2. 意図から導いた指針(このチケットで)

| guideline_id | 指針(1文) | 由来 entry_id | 一般化できるか | 影響する試験観点 |
|---|---|---|---|---|
| DG-cosmic-countdown-0.1.0-001 | 受領物の見た目(配色・カード配置)は配信者が決めたものとして、明示の指示なしに変えない | DI-...-005, DI-...-007 | repo 全体(受領物の収録) | 見た目の回帰 |
| DG-cosmic-countdown-0.1.0-002 | 後で変える予定の名前は、置く場所を最小にして一覧にしておく | DI-...-006 | repo 全体 | 名前の grep |
