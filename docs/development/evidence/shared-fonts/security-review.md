---
type: security_review
repo: poko-tools
ticket_id: shared-fonts
status: reviewed
reviewed_at: 2026-11-05
reviewed_head: 181a24e
reviewed_code_digest: 4bdc20965cf6a5cdf90b05235667b3c833d85fe1
reviewer: claude-code (構築役 Sonnet)
scope: feat/shared-fonts の差分(shared/fonts, scripts/fonts.py, package-tool.sh, qa-gate.yml, tools/tracker)
open_findings: 0
review_required: false
canonical_path: docs/development/evidence/shared-fonts/security-review.md
tags: [security-review, evidence, shared-fonts]
---

# セキュリティレビュー: shared-fonts

## 1. 所見

| id | 重大度 | 内容 | 判断 |
|---|---|---|---|
| SR-001 | info | 外部から取得したバイナリ(TTF)を同梱。取得元 commit 固定、SHA256SUMS、ライセンス原文同梱、downloads は dl/ の空ディレクトリで `file` と大きさを確認してから配置 | 受容(台帳で改ざん検出) |
| SR-002 | info | fonts.py はファイルの読み取りとコピーのみ。標準ライブラリのみ、ネットワーク・サブプロセス・eval なし。sync は削除しない | 問題なし |
| SR-003 | info | html/css/js の外部 URL を check で禁止(コメント除外)。新規 http(s) の追加なし(dbd-perks の既存コメントのみ) | 問題なし |
| SR-004 | info | CI に `python3 scripts/fonts.py check` を追加。secret・権限の変更なし | 問題なし |
| SR-005 | info | 再レビュー(段取り役): `.gitattributes` 追加(フォント置き場を `-text -whitespace`、ライセンス原文の CRLF・行末空白を保つため)と docs/requirements/tracker.md:28 のパス修正。実行コード・権限・外部通信の変更なし | 問題なし |
| SR-006 | info | 再レビュー(段取り役): tracker 7 画面の版表示を `v0.3.0` → `v0.3.1` に(tool.json と一致させる)。表示文字列のみで、実行コード・権限・外部通信の変更なし | 問題なし |

## 2. 未解決の所見

なし。

## 3. 残余リスク

- TTF 自体の解析器脆弱性はブラウザ側の問題で、出所(google/fonts 公開物・作者配布)と sha256 で緩和。
