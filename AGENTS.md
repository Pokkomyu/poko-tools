# AGENTS.md

コーディングエージェント向けの作業ルール。

## 必読
- `docs/development/conventions.md` (file:// 制約と OBS 前提)
- 対象ツールの `docs/requirements/<tool>.md` と `docs/ux/<tool>/`

## 守ること
- 配布物は **zip を解凍して index.html をダブルクリックで動く** こと。
  - `<script type="module">`、`fetch()`、CDN、外部フォント読み込みは使わない
  - 保存は `localStorage` のみ
- 1ツール = `tools/<tool>/` に閉じる。ツール間でファイルを参照しない(共通化は3ツール揃ってから)
- 素材(画像・音声・フォント)を追加したら `tools/<tool>/CREDITS.md` に出典と再配布可否を書く。再配布不可の素材は同梱しない
  - 例外: `dbd-perks` のパーク画像(`tools/dbd-perks/icons/`、Behaviour Interactive の素材)は GitHub Pages 版にだけ置き、zip には入れない(`docs/requirements/dbd-perks.md`)
- 変更したら `tools/<tool>/tool.json` の version と `CHANGELOG.md` を更新する
- 1 ticket = 1 branch = 1 commit

## 試験資産ライフサイクル(Testing)

`docs/development/test-asset-lifecycle-policy.md` に従う。

- 変更のバージョン区分(patch / minor / major)を先に決める。patch / minor は DRBFM(故障モード想定)→ 全通り試験 → 証跡、major は試験棚卸(思想・観点の蒸留 → 再構成)→ フルテスト。
- DRBFM と全通り試験の設計は高級モデル(Fable 等)が担当する。DRBFM なしで仕様変更を実装しない。
- 開発中に書いたテストは test-case master に登録して捨てない。既存テストの削除・skip 化は棚卸でのみ行う。
- 人間がプロンプトで与えた指示・判断・訂正・却下は `docs/development/dev-intent/<ticket-id>.md` に証跡として残し、読み取った意図を試験へ結ぶ。
- 既存の開発思想・設計原則と異なる観点が必要になったら STOP し、設計者(明記がなければ devuser)に問い合わせてから進める。
- 作業開始時に `scripts/install-githooks.sh` を1回実行する(pre-commit で `scripts/qa-gate.sh` が DRBFM・開発意図ログ・evidence・test-case master の有無とテスト削除なしを判定)。commit 前に `scripts/qa-gate.sh change --write` を通す。`--no-verify` は使わない。
- 手順・テンプレート・チェックリストは `brantechs/SQA`(`checklists/change-test-gate.md` / `checklists/pre-major-test-inventory.md`)。
