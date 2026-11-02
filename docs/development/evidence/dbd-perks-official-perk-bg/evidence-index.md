---
type: evidence_index
repo: poko-tools
ticket_id: dbd-perks-official-perk-bg
status: draft
created: 2026-11-03
updated: 2026-11-03
owner: devuser
canonical_path: docs/development/evidence/dbd-perks-official-perk-bg/evidence-index.md
tags: [evidence, index, poko-tools]
---

# Evidence Index: dbd-perks-official-perk-bg

## 1. 証跡一覧

| evidence_id | test_case_id | 種別 | path / URL | 取得日 | 版数 / 環境 | 関連(ticket/PR/release) |
|---|---|---|---|---|---|---|
| EV-001 | TC-PKT-001〜011, 013, 014, 019, 022〜024 | log | test-results.md | 2026-11-03 | dbd-perks 0.2.6 / Playwright Chromium headless, file:// | dbd-perks-official-perk-bg |
| EV-002 | TC-PKT-001, 006 | screenshot | screenshots/k-row.jpg | 2026-11-03 | 同上 1920x1080(配信領域 1300x1080 を縮小) | 同上 |
| EV-003 | TC-PKT-002, 006, 008 | screenshot | screenshots/s-diamond.jpg | 2026-11-03 | 同上 | 同上 |
| EV-004 | TC-PKT-004 | screenshot | screenshots/s-row-spin.jpg | 2026-11-03 | 同上 | 同上 |
| EV-005 | TC-PKT-010 | screenshot | screenshots/noframe-row.jpg | 2026-11-03 | 同上 | 同上 |
| EV-006 | TC-PKT-011, 024 | screenshot | screenshots/bg-green.jpg | 2026-11-03 | 同上 | 同上 |
| EV-007 | TC-PKT-013 | screenshot | screenshots/iconoff-k.jpg | 2026-11-03 | 同上 | 同上 |
| EV-008 | TC-PKT-014 | screenshot | screenshots/zip-row.jpg | 2026-11-03 | icons/ official/ を除いたコピー | 同上 |
| EV-009 | TC-PKT-022 | screenshot | screenshots/k-row-1280.jpg | 2026-11-03 | 1280x720 | 同上 |
| EV-010 | TC-PKT-015, 016, 018, 019 | log | test-results.md「ファイル・zip・版・セキュリティ」 | 2026-11-03 | scripts/package-tool.sh dbd-perks | 同上 |
| EV-011 | — | security review | security-review.md | 2026-11-03 | ブランチ差分 | 同上 |

## 2. Fix確認(該当時)

| issue | fixed_version | test_version | procedure | result(OK/NG/PEND) | frequency(例 0/5) | 環境 | evidence_id |
|---|---|---|---|---|---|---|---|
| グリーン背景で石の縁が暗い緑になる(統合検証で発見) | 0.2.6 | 0.2.6 | TC-PKT-024 | OK | 1/1 | headless | EV-001, EV-006 |

## 3. not_tested(証跡なし)

| test_case_id | skip_reason | accepted_risk | review_required |
|---|---|---|---|
| TC-PKT-012 | OBS 実機。配信 PC で ぽこ / devuser が確認する(handoff に手順) | 透過・クロマキーの見え方は headless の TC-PKT-011 / 024 で代替確認済み | true |
| TC-PKT-017, TC-PKT-020 | owner の文面承認待ち(段取り役の自己点検は OK) | なし | true |
| TC-PKT-021 | 321 / 321 パークに画像があり、到達経路がない | 新パーク追加時に画像が取れなかった場合だけ。空の紫のひし形が出る | false |

## 4. リンク

- test-case master: `docs/development/test-cases/master/dbd-perks.yaml`
- DRBFM: `docs/development/drbfm/20261103-dbd-perks-official-perk-bg-official-perk-background.md`
- 開発意図ログ: `docs/development/dev-intent/dbd-perks-official-perk-bg.md`
