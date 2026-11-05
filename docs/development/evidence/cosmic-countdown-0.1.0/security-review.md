---
type: security_review
repo: rel-cosmic-countdown-wt
ticket_id: cosmic-countdown-0.1.0
status: reviewed
reviewed_at: 2026-11-05
reviewed_head: 181a24e
reviewed_code_digest: ffa9acfbcf12197e7d518b9d2f627e8db6e96143
reviewer: Claude Code(段取り役 Opus、SQA prompts/security-review.md の観点で差分を通読)
scope: origin/main..HEAD + 作業ツリー(未追跡の tools/cosmic-countdown/ 一式。digest は land でステージした後と同じ内容を一時 index に入れて --staged で計算)
open_findings: 0
review_required: false
canonical_path: docs/development/evidence/cosmic-countdown-0.1.0/security-review.md
tags: [security-review, evidence, cosmic-countdown-0.1.0]
---

# Security Review: cosmic-countdown-0.1.0

> 雛形: SQA templates/security-review.md / 手順: SQA docs/development/test-asset-lifecycle-policy.md §4.2
> 所見を書いたら status: reviewed にする。未解消の所見が残るなら open_findings に件数、review_required: true(握りつぶし禁止)。

## 1. 対象と観点

- 差分: `tools/cosmic-countdown/index.html`(新規。受領物 `cosmic-countdown.html` を整えたもの)、`tool.json`、`fonts/`(woff2 4 本と OFL 全文 2 本)。docs(MANUAL / CHANGELOG / CREDITS / requirements / DRBFM / dev-intent)は digest 対象外だが通読した
- 観点: 入力検証 / injection(HTML・URL パラメータ)/ 保存値の改ざん / 外部呼び出し / secret・個人情報の露出 / 第三者素材(フォント)のライセンス

## 2. 所見

| finding_id | severity(high/medium/low/info) | 箇所 | 内容 | 対応(fixed / accepted / open) | 対応先(DRBFM 行 / test_case_id / issue) |
|---|---|---|---|---|---|
| SR-001 | low | fonts/(Orbitron の subset) | Orbitron は OFL の予約フォント名(RFN)「Orbitron」付き。subset は改変版なので、同じ名前のまま配ると OFL 違反。name テーブル(nameID 1/3/4/6/16/17)とファイル名を「CosmicDigits」に変え、index.html の参照と CREDITS・CHANGELOG・requirements を直した。著作権表記と OFL 全文は残す | fixed | DRBFM「同梱フォントの名前(SR-001)」行 |
| SR-002 | info | index.html:303, 366, 424, 580 | innerHTML は固定のひな形・数値と固定文字だけ・中身の消去だけ。利用者の文字列(タイトル・当日の文字・見出し・絵文字)はすべて textContent / value で入れる(326, 327, 353, 367, 438, 562) | fixed(問題なし) | CC-X01 |
| SR-003 | info | index.html:200-206 | URL の `id` は `^[A-Za-z0-9_-]{1,32}$` に合うときだけ保存キー(`poko-cosmic-countdown-v1:<id>`)に使う。合わなければ無視。`bg` は `transparent` との一致比較だけ | fixed(問題なし) | CC-X01 |
| SR-004 | info | index.html:262-277(readState / normalize) | localStorage の値は try 内で JSON.parse し、normalize で型・範囲を直す(表示サイズ 40〜300、並べ方は 2 値、日時は形式と往復一致、id の重複除去)。壊れた値は既定に戻る | fixed(問題なし) | CC-X01 |
| SR-005 | info | index.html 全体 | fetch / eval / new Function / 外部 URL の読込なし。Google Fonts の `<link>` は削除し、フォントは同梱の相対パスだけ。secret・token・個人情報の追加なし | fixed(問題なし) | (grep) |

## 3. DRBFM / 試験への反映

- DRBFM に追加した故障モード行: 「同梱フォントの名前(SR-001)」
- 追加した回帰試験(test_case_id): CC-X01(既存)。SR-001 は grep(`Orbitron` が fonts のファイル名・index.html に無い)と name テーブルの確認で見る

## 4. 残リスク

- 保存先は OBS / ブラウザの localStorage で、同じオリジン(file://)の他のページから読める。中身は配信の予定(タイトルと日時)だけで、秘密情報は入らない
