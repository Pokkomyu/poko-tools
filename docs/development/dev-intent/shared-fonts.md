---
type: dev_intent_log
repo: poko-tools
ticket_id: shared-fonts
status: draft
created: 2026-11-05
updated: 2026-11-05
owner: devuser
canonical_path: docs/development/dev-intent/shared-fonts.md
tags: [dev-intent, human-input, poko-tools]
---

# 開発意図ログ: shared-fonts フォント共有置き場

## 1. 人間入力の記録

| entry_id | 日時 | 入力(要旨) | 種別 | 読み取った意図 | 反映先 |
|---|---|---|---|---|---|
| DI-shared-fonts-001 | 2026-11-05 | PokoCounter 用のフォント(ドット・レゲエ・かいせいなど)を各ツールが共通で使えるようにする(branch 1 = 置き場とトラッカーの移行) | 指示 | フォントの正本を 1 か所(shared/fonts)に置き、ツールごとに同一コピーを持たせて zip 単体で動くようにする | design/02-fonts-review.md §2 F1-F6, §4 |
| DI-shared-fonts-002 | 2026-11-05 | 外部 URL(Google Fonts 等)は使わない。ダウンロード物は信頼しないデータとして扱う | 制約 | 取得元 commit を固定し、SHA256SUMS と fonts.py check で改ざん・取り違えを検出する | scripts/fonts.py / manifest.json |

## 2. 意図から導いた指針

| guideline_id | 指針(1文) | 由来 entry_id | 一般化できるか | 影響する試験観点 |
|---|---|---|---|---|
| DG-shared-fonts-001 | 正本と各ツールのコピーはバイト一致、HTML/CSS は assets/fonts/<id>/ だけを参照する | DI-001 | repo 全体 | check / zip 同梱 |
| DG-shared-fonts-002 | 新しい取得物は commit 固定・sha256 台帳・ライセンス原文を同時に入れる | DI-002 | repo 全体 | 台帳照合 |

## 3. 試験の方向性への反映

- DRBFM: `docs/development/drbfm/20261105-shared-fonts-shared-font-store.md`
- 新設した test_case_id: `docs/development/test-cases/master/shared-fonts.yaml`(TC-FNT-001〜014)
- 反映できなかった入力と理由: なし

## 4. 設計者への問い合わせ(該当時)

なし(未確定点は構築報告の「要確認」に記載)。
