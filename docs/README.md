# docs

| ディレクトリ | 内容 |
|---|---|
| `product/` | 商品ラインナップ・販売状況 |
| `requirements/<tool>.md` | ツールごとの仕様(実装の入力) |
| `ux/<tool>/` | ワイヤーフレーム画像 |
| `ux/uchuneko-colors.md` | 宇宙猫カラー(ぽこ指定の配色) |
| `development/` | 実装規約 |
| `architecture/` | 仕組みの設計(サーバーと連携する機能など。`deco-poko-collab.md` = デコポコの一緒にデコる、`deco-poko-obs-vts.md` = デコポコのスポイトと立ち絵に付ける) |
| `release/` | BOOTH 出品チェックリスト、GitHub Pages 公開、有償版(edition)の運用、有償版 zip の受け渡し repo(`plus-dist.md`) |

## Testing / QA(試験資産ライフサイクル)

- [試験資産ライフサイクル方針](development/test-asset-lifecycle-policy.md) — バージョン区分(patch/minor/major)別の必須試験、開発中テストの資産化、DRBFM→全通り試験、開発意図ログ(人間入力の証跡)、メジャー前棚卸(蒸留→再構成)→フルテスト、設計者問い合わせ。手順・テンプレートは `brantechs/SQA`
- [dev-intent/](development/dev-intent/README.md) — 開発意図ログ(チケット単位)
- [test-inventory/](development/test-inventory/README.md) — 試験観点台帳・棚卸報告
