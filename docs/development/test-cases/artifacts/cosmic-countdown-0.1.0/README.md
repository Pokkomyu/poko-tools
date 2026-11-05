# test-case artifacts: cosmic-countdown-0.1.0

## master に登録していない理由

- 試験コード(Playwright)は全 tool・repo 共通の基盤を別に設計している最中で、置き場所と実行方法がまだ決まっていない(owner 決定 2026-11-05、dev-intent DI-cosmic-countdown-0.1.0-009)
- 基盤が決まったら `docs/development/test-cases/master/cosmic-countdown.yaml` に登録し、試験を実装する

## 受け入れ条件(確定済み)

- ケース表: 設計レビュー 01-review §6(CC-L01〜L03、T01〜T05、R01〜R02、A01〜A02、B01〜B04、P01、S01〜S02、E01〜E05、C01〜C03、F01〜F02、X01、V01)に、設計指示書 03-instructions §2 の CC-L04〜L06 と、変更後の CC-L01・O-1 を加える
- DRBFM の各行は、この CC-* と OBS 実機の O-1〜O-8 を検出手段にしている(`docs/development/drbfm/20261105-cosmic-countdown-0.1.0-cosmic-countdown.md`)

## 今回やった確認(試験の代わり)

- headless Chromium で 2320x1080 を撮影: ステージ 1920、パネルは x=1920・幅 400、数字は CosmicDigits で表示、版表示は v0.1.0
- `node --check`(script 部分)、grep(innerHTML の使い方、外部 URL なし、`Orbitron` が name テーブル・ファイル名・font-family にない)
- CC-T02(node で resolve を抜き出して 1 回): 毎年の項目は当日 20:00 から 23 時間 59 分後もお祝いのまま、24 時間後に翌年の同日へ進む
- CC-T03(同上): 2/29 の毎年の項目は、うるう年でない年は 2/28 になる(2025-02-28 20:00)
- CC-L03(同上): 保存データが壊れた JSON・`null` なら初期の 2 件に戻る。`items` が配列でなければ 0 件、null の項目は捨て、重複した id は振り直す。scale が数値でなければ 100
