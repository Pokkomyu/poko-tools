---
type: security_review
repo: rel-dbd-perks-official-perk-bg-wt
ticket_id: dbd-perks-official-perk-bg
status: reviewed
reviewed_at: 2026-11-03
reviewed_head: b573e1c
reviewed_code_digest: 98a559e5b61ec913d1354435212c2b99949a439b
reviewer: Claude Code(段取り役 Opus、SQA prompts/security-review.md の観点で差分を通読)
scope: origin/main..HEAD + 作業ツリー(未追跡の tools/dbd-perks/official/perk-bg.png を含む。digest は land でステージした後と同じ 4 ファイルで計算)
open_findings: 0
review_required: false
canonical_path: docs/development/evidence/dbd-perks-official-perk-bg/security-review.md
tags: [security-review, evidence, dbd-perks-official-perk-bg]
---

# Security Review: dbd-perks-official-perk-bg

> 雛形: SQA templates/security-review.md / 手順: SQA docs/development/test-asset-lifecycle-policy.md §4.2
> 所見を書いたら status: reviewed にする。未解消の所見が残るなら open_findings に件数、review_required: true(握りつぶし禁止)。

## 1. 対象と観点

- 差分: `tools/dbd-perks/style.css`(画像ありのひし形の地を素材に置換、グリーン時の 3 枚重ね、回転なしのポップ)、`tools/dbd-perks/tool.json` と `tools/dbd-perks/app.js`(版の定数のみ)、`tools/dbd-perks/official/perk-bg.png`(新規の画像)。docs(requirements / CREDITS / CHANGELOG / QA 成果物)は digest 対象外だが通読した
- 観点: 入力検証 / injection(CSS・パス)/ 外部呼び出し / secret・個人情報の露出 / 配布物への混入 / 第三者素材の取り扱い

## 2. 所見

| finding_id | severity(high/medium/low/info) | 箇所 | 内容 | 対応(fixed / accepted / open) | 対応先(DRBFM 行 / test_case_id / issue) |
|---|---|---|---|---|---|
| SR-001 | info | style.css `url("official/perk-bg.png")` | 参照は同じツール内の相対パスだけ。外部 URL・`@import`・ユーザー入力から組み立てる値はない。実行時の要求は file:// だけ(TC-PKT-019 で 0 件) | fixed(問題なし) | TC-PKT-019 |
| SR-002 | info | official/perk-bg.png | 外部(公式 → 星乃ぽこ → devuser の Windows)から受け取ったバイナリ。PNG のチャンクは IHDR / iCCP / pHYs / IDAT / IEND だけで、テキスト・EXIF などのメタデータなし(個人情報・パスの埋め込みなし)。ブラウザが CSS 背景として描くだけで、スクリプトからは読まない | fixed(問題なし) | TC-PKT-019 |
| SR-003 | info | scripts/package-tool.sh(変更なし) | 第三者素材が無料 zip に混入しないこと。`official/` は zip の対象外(TC-PKT-015 で zip の中身を確認) | fixed(問題なし) | TC-PKT-015 |

app.js は版の文字列 1 行だけ。HTML・workflow・スクリプトの変更なし。secret・token の追加なし。

## 3. DRBFM / 試験への反映

- DRBFM に追加した故障モード行: セキュリティ行(外部読込・入力・secret)は Fable の DRBFM に既存。追加なし
- 追加した回帰試験(test_case_id): TC-PKT-015, TC-PKT-019(既存項目で網羅)

## 4. 残リスク

- なし(素材の利用条件は権利面の確認で、TC-PKT-017 で owner が承認する)
