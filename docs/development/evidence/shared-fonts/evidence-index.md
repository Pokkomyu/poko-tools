---
type: evidence_index
repo: poko-tools
ticket_id: shared-fonts
status: draft
created: 2026-11-05
updated: 2026-11-05
owner: devuser
canonical_path: docs/development/evidence/shared-fonts/evidence-index.md
tags: [evidence, index, poko-tools]
---

# Evidence Index: shared-fonts

## 1. 証跡一覧

| evidence_id | test_case_id | 種別 | path / URL | 取得日 | 版数 / 環境 | 関連 |
|---|---|---|---|---|---|---|
| EV-001 | TC-FNT-001〜014 | log | test-results.md | 2026-11-05 | tracker 0.3.1 / fonts.py / Playwright Chromium headless, file:// | shared-fonts |
| EV-002 | — | security review | security-review.md | 2026-11-05 | ブランチ差分 | shared-fonts |
| EV-003 | — | qa-gate | qa-gate.md | 2026-11-05 | qa-gate.sh change | shared-fonts |

## 2. Fix確認(該当時)

なし。

## 3. not_tested(証跡なし)

| test_case_id | skip_reason | accepted_risk | review_required |
|---|---|---|---|
| (TC 外) OBS 実機でのフォント表示 | 配信 PC での確認は devuser / ぽこ。headless の TC-FNT-013 で代替 | OBS のキャッシュ更新漏れ(CHANGELOG に手順記載) | true |
| (TC 外) edition/plus との merge | devuser が rel-pr land 時に確認 | なし | true |

## 4. リンク

- test-case master: `docs/development/test-cases/master/shared-fonts.yaml`
- DRBFM: `docs/development/drbfm/20261105-shared-fonts-shared-font-store.md`
- 開発意図ログ: `docs/development/dev-intent/shared-fonts.md`
