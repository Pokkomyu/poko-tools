---
type: drbfm
repo: poko-tools
ticket_id: shared-fonts
change_title: フォント共有置き場 shared/fonts の新設とトラッカーの keifont 移行(tracker 0.3.1)
version_tier: patch
status: draft
created: 2026-11-05
updated: 2026-11-05
owner: devuser
canonical_path: docs/development/drbfm/20261105-shared-fonts-shared-font-store.md
tags: [drbfm, poko-tools, fonts]
---

# DRBFM: shared-fonts フォント共有置き場

> 設計: design/02-fonts-review.md(§2 F1-F6, §4-A〜F)。owner の指示は `docs/development/dev-intent/shared-fonts.md`。

## 1. 変更概要

- 背景 / 目的: PokoCounter など複数ツールで同じフォントを使うため、正本 `shared/fonts/<id>/` とツールごとの同一コピー `tools/<tool>/assets/fonts/<id>/` の仕組みを作る。
- バージョン区分: **patch**(tracker 0.3.0 → 0.3.1)。見た目と操作は変えず、フォントの置き場所だけを移す。新しい仕組み(shared/fonts)は他ツールを変更しない。
- 変更内容: shared/fonts(6 書体+manifest+SHA256SUMS)、scripts/fonts.py(sync/check)、package-tool.sh と qa-gate.yml に check を追加、tracker の keifont を移動し参照を書き換え、AGENTS.md / conventions.md / CREDITS を更新。
- 影響範囲: tracker の 6 色 HTML と zip、配布 zip 作成手順、CI。roulette / deco-poko / dbd-perks / PokoCounter / wp-poko は変更しない。

## 2. DRBFM 表

| part | change_point | function | possible_risk | impact | detection | test_to_add | skip_reason | review_required | review_reason |
|---|---|---|---|---|---|---|---|---|---|
| asset | 取得したフォントを shared/fonts に置く | 正本 | 取り違え・改ざん・ライセンス原文の欠落 | 配布物の権利問題 | SHA256SUMS 照合、manifest と OFL の RFN 照合 | TC-FNT-001, 002, 005 | | false | |
| asset | ツールごとのコピー | zip 単体で動く | 正本との差、未登録フォルダの混入 | zip で文字化け・余計な同梱 | check の一致・一覧照合 | TC-FNT-003, 004, 014 | | false | |
| screen | tracker の @font-face 参照変更 | 6 色の見た目 | パス誤りでフォント未読込 | 配信に映る表示崩れ | Chromium で document.fonts 読込確認、旧パス 0 件 | TC-FNT-010, 013 | | false | |
| css | 参照規則(shared/ 禁止・外部 URL 禁止・family/weight 一致) | 規約の機械化 | zip 内で壊れる参照、外部通信 | OBS で読めない・外部依存 | fault injection で NG | TC-FNT-006, 007, 008 | | false | |
| build | package-tool.sh / qa-gate.yml に check | 配布前の関門 | check の誤検知で配布が止まる、他ツールへの影響 | 他ツールの zip | 4 ツールの zip 一覧が変更前後で同一 | TC-FNT-009, 011, 012 | | false | |
| docs | AGENTS.md / conventions.md / CREDITS | 規約の正本 | 古いパスの記述が残る | 混乱 | grep | TC-FNT-010 | | true | docs/requirements/tracker.md:28 が旧パスのまま(指示書外のため未変更) |

## 3. 試験の一覧

TC-FNT-001〜014(`docs/development/test-cases/master/shared-fonts.yaml`)。

## 4. review_required

- docs/requirements/tracker.md:28 の旧パス記述(別途の文書修正が必要か owner 判断)。
- Pages が shared/fonts(約 20MB)を配信することの是非。

## 5. 備考

- OBS 実機でのフォント表示は未確認(「現在のページのキャッシュを更新」が必要)。
