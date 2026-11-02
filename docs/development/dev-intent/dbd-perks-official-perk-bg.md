---
type: dev_intent_log
repo: poko-tools
ticket_id: dbd-perks-official-perk-bg
status: draft
created: 2026-11-03
updated: 2026-11-03
owner: devuser
canonical_path: docs/development/dev-intent/dbd-perks-official-perk-bg.md
tags: [dev-intent, human-input, poko-tools]
---

# 開発意図ログ: dbd-perks-official-perk-bg パークの背景を公式素材にする

> 生成方針: `docs/development/test-asset-lifecycle-policy.md` §5

## 1. 人間入力の記録

| entry_id | 日時 | 入力(要旨。重要なものは原文を短く引用) | 種別 | 読み取った意図 | 反映先 |
|---|---|---|---|---|---|
| DI-dbd-perks-official-perk-bg-001 | 2026-11-03 | 「ランダムパークツールのパークの背景はこれを使ってください。星乃ぽこが DBD 公式から公認クリエイターとして Free to use で入手した素材です」(紫のひし形・石の縁の画像) | 指示 | 画像ありのひし形の地を、自作のグラデーションから公式提供のパークの背景に替える。requirements の「公式の枠画像は使わない」は、提供を受けた素材に限って owner が上書きした | docs/requirements/dbd-perks.md「枠の中身」/ DRBFM / test-case master |
| DI-dbd-perks-official-perk-bg-002 | 2026-11-03 | キラー赤 / サバイバー青の枠線は「色線を消す(素材そのまま)」 | 回答 | 画像ありでは素材の見た目を優先し、役割の色の見分けはなくてよい | style.css `.icons .slot::before` / requirements「枠の色」/ test-case master |
| DI-dbd-perks-official-perk-bg-003 | 2026-11-03 | 素材を使う範囲は「Pages 版だけ」 | 回答 | パークの画像と同じ扱い。zip 版には入れず、zip 版の見た目も変えない | official/ を zip 外に置く / CREDITS.md / test-case master |
| DI-dbd-perks-official-perk-bg-004 | 2026-11-03 | 「配布の形態が毎度異なるようなので都度考えます」 | 回答 | 公式素材の置き場・条件は毎回確かめる。今回の置き方を一般則にしない | requirements「枠の中身」の注記 |

## 2. 意図から導いた指針(このチケットで)

| guideline_id | 指針(1文) | 由来 entry_id | 一般化できるか | 影響する試験観点 |
|---|---|---|---|---|
| DG-dbd-perks-official-perk-bg-001 | 公式・第三者の素材は Pages 版にだけ置き、zip の中身に入らないことを毎回確かめる | DI-...-001, DI-...-003 | repo 全体(dbd-perks) | zip 同梱物 |
| DG-dbd-perks-official-perk-bg-002 | 素材を差し込むときは、素材なしの経路(zip 版)の見た目が変わらないことも確かめる | DI-...-003 | この機能のみ | 画像なしの表示 |

## 3. 試験の方向性への反映

- DRBFM: `docs/development/drbfm/20261103-dbd-perks-official-perk-bg-official-perk-background.md`
- 新設した test_case_id: `docs/development/test-cases/master/dbd-perks.yaml`(TC-PKT-001〜023)
- 試験観点台帳へ追加した観点 / 指針: なし(major 前の棚卸で扱う)
- 反映できなかった入力と理由: なし

## 4. 設計者への問い合わせ(該当時)

| entry_id | 問い合わせ内容 | 回答 | 回答者 / 日時 | 反映先 docs |
|---|---|---|---|---|
| DI-dbd-perks-official-perk-bg-002〜004 | 役割の色線 / 使う範囲 / 素材の置き場 | 上の表のとおり | devuser / 2026-11-03 | docs/requirements/dbd-perks.md |
