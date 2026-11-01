# デコポコ「スポイト」と「立ち絵に付ける」設計(ドラフト)

状態: **ドラフト(承認前)**。2026-10-18 作成、同日 Fable レビュー(18 項目)を反映。

## 1. 目的と範囲

決まっていること(2026-10-18 ぶらんち):

| 項目 | 決定 |
|---|---|
| スポイト | **OBS の画面(立ち絵・配信画面)から色を拾う**。ボードに描いた色だけを拾うスポイトは作らない(「OBS から拾えないならスポイトの意味はない」) |
| パーツ追従 | **Live2D(VTube Studio)限定**。描いた絵を VTube Studio のアイテムにして、モデルのパーツ(ArtMesh)にピン留めする。追従は VTube Studio が行う |

どちらも、デコポコと同じ PC で動いている OBS / VTube Studio に `ws://localhost` でつなぐ。外部のサーバーには何も送らない。

範囲外(v1): 普通のブラウザで開いたボードから立ち絵に付けること(ボードの座標は OBS の 1920x1080 前提、§6.4)、3D モデル(VSeeFace / Warudo など)、VTube Studio の VNet コラボ相手のモデル、別の PC で動いている OBS / VTube Studio、iPhone 版 VTube Studio、プレビュー(スタジオモード)の画面から拾うこと、描きながら OBS の画面を下絵として常に表示すること(§12 未決 6)。

## 2. 全体構成

```text
OBS(同じ PC)
 ├ ブラウザソース: デコポコ(Pages 版 / プラス版 / ローカルファイル)…「対話」で描く
 │     │ ws://localhost:4455  obs-websocket v5(OBS 28 以降に標準搭載)
 │     │   GetCurrentProgramScene → GetSourceScreenshot(番組のシーン、PNG)
 │     │   → スポイト用の画像
 │     │
 │     │ ws://localhost:8001  VTube Studio Public API
 │     │   認証(VTS 側で許可)→ LoadCustomImagesAsItems の権限(VTS 側で許可)
 │     │   ItemLoadRequest(customDataBase64 = レイヤーを切り出した PNG)
 │     │   ModelClickedEvent(付ける場所を VTS の窓でクリック)→ ItemPinRequest
 │     ▼
 └ VTube Studio のキャプチャ(ゲームキャプチャ / Spout2 など)… 付けた絵はここに映る
```

付けた絵は **VTube Studio が描く**ので、デコポコのブラウザソースではなく VTube Studio のキャプチャに映る。デコポコ側ではそのレイヤーを表示しない(二重に映らないように)。

## 3. 共通の前提

### 3.1 どの版で動くか

- 無料版(Pages・zip)・プラス版のどちらにも入れる。`index.html` は無料/プラス共通の方針(§1.0.0)のままにする
- 一緒にデコるの部屋にいる間: スポイトは使える(自分の色を変えるだけ)。立ち絵に付けるは使えない(レイヤーが共有なので。ボタンを無効にし理由を出す)
- OBS の外(普通のブラウザ)で開いた場合も、同じ PC で OBS / VTube Studio が動いていれば使える

### 3.2 https のページから ws://localhost へ

Pages 版(`https://pokkomyu.github.io/...`)とプラス版(`https://hoshino-poko.com/...`)は https。Chromium は `localhost` / `127.0.0.1` を安全な宛先として扱うので混在コンテンツにはならない想定だが、次の 2 点は **段階 a で実機確認**する。

- OBS のブラウザソース(CEF)で、https のページから `ws://localhost:4455` / `ws://localhost:8001` に接続できるか
- Chrome の「ローカル ネットワーク アクセス」の許可ダイアログが出るか(出る版なら、普通のブラウザで開いたときの案内を書く)。OBS の CEF は Chrome より古いので出ない見込み

接続先は `localhost` 固定(ポートだけ変えられる)。CEF / Chrome が `localhost` を IPv6(`::1`)に解決し、IPv4 だけで待ち受けている OBS / VTS につながらないことがあるので、`ws://localhost` が失敗したら `ws://127.0.0.1` で試す(どちらも安全な宛先扱い)。別ホストへの接続は作らない(範囲外、かつ任意の宛先にパスワードを送る口を作らないため)。

### 3.3 保存

設定は既存の保存キー `LS_KEY` とは別のキーに入れる(絵のデータと混ぜない。`?id` ごとには分けない = 同じ PC の OBS は 1 つなので)。

| キー | 中身 |
|---|---|
| `poko-deco-link-v1:obs` | `{port, password?, save}`。`save=false` のときパスワードは保存しない(§4.3) |
| `poko-deco-link-v1:vts` | `{port, token}`。token は VTube Studio が発行するプラグイン用のトークン。VTS から見ると、同じ PC のデコポコは `?id` が違っても全部 **1 つのプラグイン**(認証は `pluginName` + `pluginDeveloper` 単位)なので、token も全ボードで共有する(§6.2) |
| `poko-deco-link-v1:obsmap` | 位置合わせ(§6.4)で選んだ VTS のソースとデコポコのソース |
| `LS_KEY` の中の `attached` / `pendingUnload` | 立ち絵に付けた絵の記録と、外し待ちのアイテム(§6.6)。絵と同じく `?id` ごと |

## 4. OBS との接続

### 4.1 OBS 側の準備(ぽこが 1 回だけ)

OBS の「ツール」→「WebSocket サーバー設定」で「WebSocket サーバーを有効にする」をオン。ポート 4455・認証ありのまま、「接続情報を表示」でパスワードをコピーする。

### 4.2 接続の流れ(obs-websocket v5)

1. `ws://localhost:<port>` に接続 → `Hello`(op 0)を受ける
2. `d.authentication` があれば `secret = base64(sha256(password + salt))`、`auth = base64(sha256(secret + challenge))` を `crypto.subtle` で計算し、`Identify`(op 1、`rpcVersion: 1`, `authentication`, `eventSubscriptions: 0`)を送る。イベントは使わないので 0
3. `Identified`(op 2)で接続完了。`GetVersion` の `supportedImageFormats` に `png` があることを確かめる
4. 失敗: 接続できない →「OBS の WebSocket サーバーがオンか確認してください」/ 認証失敗(close code 4009 `AuthenticationFailed`)→「パスワードが違います」と出して設定画面に戻す

接続はスポイトを使う時だけ張り、使い終わって 60 秒で閉じる(常時つないでおく理由がないため)。

### 4.3 パスワードの扱い

obs-websocket のパスワードがあれば OBS を丸ごと操作できる(シーンの切り替え・配信の開始停止のほか、`GetSourceScreenshot` で配信画面を盗み見ることもできる)。

- 保存する場合はそのブラウザ(OBS のブラウザソース)の localStorage に入れる。設定画面に「このパソコンに保存する」(既定オン)を置き、オフなら OBS を起動するたびに入れ直す
- 画面・コンソール・URL には出さない。URL パラメータでは受け取らない(OBS のソース設定や配信画面に映る恐れがあるため)
- 一緒にデコるの送信データ・保存データ(絵の JSON)には入れない
- リスク: Pages 版の origin(`pokkomyu.github.io`)は Pokkomyu の **全 repo の Pages** で共有される。プラス版は hoshino-poko.com(WordPress と同じ origin)。どちらも、その origin で悪意のあるスクリプトが OBS のブラウザソースの中で動けば読める。ローカルファイル版(file://)がいちばん狭い
- 対策: **OBS 側のパスワードはデコポコ専用にしてほかで使い回さない**こと、気になる場合はローカルファイル版で使うことを手順書に書く(§12 未決 3)

## 5. スポイト

### 5.1 操作

1. パネルの「色」の行に **スポイト**ボタン(ペンの色の隣)。OBS とまだつないでいなければ接続設定(ポート・パスワード)を開く
2. 押すと、番組のシーン(`GetCurrentProgramScene` の `sceneUuid`)を `GetSourceScreenshot`(`imageFormat: "png"`, `imageWidth/Height` = ボードの大きさ W×H)で撮り、ボードの上の**別の要素**(`view` より上、パネルより下)に表示する。`imageData` は文書では「Base64」だが、実際の obs-websocket 5 は `data:image/png;base64,…` の data URI で返すので両方受け付ける
3. 画像の上でポインターを動かすと、ルーペ(周りの 9×9 px を拡大)と色見本を出す。クリック / タップでその点の色をペンの色にする(`setColor`)。履歴には入れない(履歴は描いた色だけ、の既存仕様のまま)
4. 右クリック / 「やめる」ボタン / もう一度スポイトボタンで何もせず閉じる。右クリックはその表示要素で受けて `preventDefault` し、`view` の右クリック(小パレット)には渡さない。Tab でパネルを隠している間は使えない(ボタンがパネルの中にあるので自然にそうなる)
5. 縁取りの「自由」フチ色のピッカーを開いている時は、拾った色をフチの色にする(`setPickerColor` と同じ振り分け)

キーボード操作は足さない(既存の決定: キーは Tab のみ)。

### 5.2 座標

- デコポコのブラウザソースはシーン全体(OBS のキャンバス)に重ねて置く前提(MANUAL の推奨 1920x1080)。拾うのは「表示した画像の色」なので、ソースの位置がずれていても拾う色は正しい
- `imageWidth/Height` は「内側に収める」指定で縦横比を保つ(文書)。ボードとキャンバスの縦横比が違う時(普通のブラウザで開いた時など)は、返った画像を縦横比のまま中央に置き(余白は暗くする)、引き伸ばさない
- 画像はボードの座標に描くので、一緒にデコるの `stage`(1920x1080 固定の拡大縮小)中もそのまま使える
- 撮った画像にはデコポコ自身(描いた線)も写る。描いた線の色も拾える(ボードの色を拾う用途もこれで足りる)

### 5.3 重さ

- 1920x1080 の PNG は数 MB の base64 になる。撮るのはボタンを押した 1 回だけ。段階 a で `imageCompressionQuality` を -1(既定)と 100(PNG では無圧縮 = 速いが大きい)で所要時間を測り速い方にする。1 秒を超えるなら `imageFormat: "jpg"`(品質 100)に切り替える(JPEG は色がわずかにずれるので PNG を優先)
- 撮影中は「撮影中…」を出し、2 回押しは無視する。10 秒で応答がなければ失敗として閉じる

## 6. 立ち絵に付ける(VTube Studio)

### 6.1 VTube Studio 側の準備(ぽこが 1 回だけ)

VTube Studio の設定で「API を開始(Start API)」をオン(ポート 8001)。初回接続時に VTube Studio にプラグインの許可ダイアログと、画像を読み込む権限(`LoadCustomImagesAsItems`)のダイアログが出るので「許可」を押す。

### 6.2 接続の流れ

1. `ws://localhost:<port>` に接続(失敗したら `127.0.0.1`、§3.2)
2. token がなければ `AuthenticationTokenRequest`(`pluginName: "Deco-Poko"`, `pluginDeveloper: "Pokkomyu"`, `pluginIcon` = 128x128 の PNG)→ VTS 側で許可されると `authenticationToken` が返る(拒否 = errorID 50 →「VTube Studio で許可されませんでした」)
   - 複数のボード(`?id`)が同時に token を取りに行くと、VTS に許可ダイアログが何枚も出る。`poko-deco-link-v1:vts` に「取得中(時刻)」を書いてから取りに行き、ほかのボードは `storage` イベントで token が入るのを待つ(60 秒で取得中の印は無効)
3. `AuthenticationRequest` で認証。`authenticated: false` なら token を捨てて 2 から(VTS 側で取り消された場合)。認証後のどのリクエストでも errorID 50 が返ったら同じく token を捨てて 2 から(共通処理)
4. `PermissionRequest`(`requestedPermission: "LoadCustomImagesAsItems"`)。許可済みなら即返る
5. `CurrentModelRequest` で `modelLoaded` / `modelID` を確認。モデルがなければ「モデルを読み込んでください」
6. `EventSubscriptionRequest` で `ModelLoadedEvent`(モデルの切り替え・外し)と、付ける操作の間だけ `ModelClickedEvent`(`config.onlyClicksOnModel: true`)

付けたものがある間は接続を張ったままにし、切れたら 5 秒おきにつなぎ直す(VTS を後から起動した場合も含む)。

VTS から見て全ボードが 1 つのプラグインなので、`ItemUnloadRequest` の `unloadAllLoadedByThisPlugin` は使わない(ほかのボードの絵まで消える)。後始末は必ず `instanceIDs` を指定する。「設定を消す」で token を消すと全ボードの VTS 連携が切れる旨を確認画面に出す。

### 6.3 付ける操作

付けるのは **レイヤーに今ある絵**。付けると絵はボードから VTS へ移る(ボードのそのレイヤーは空になり、また描ける)。1 回付けるごとに VTS のアイテムが 1 つ増える(1 ボードで最大 10 個、§12 未決 2)。

1. パネルのレイヤーの行に「立ち絵に付ける」ボタン(一緒にデコるの部屋にいる間は無効)。押すと、そのレイヤーの絵がある範囲(透明でない画素の外接矩形 + 余白 4 px)を求める。空なら「このレイヤーには何も描かれていません」
2. 画面に「**VTube Studio の窓で、絵を付けたい場所(頭など)をクリックしてください**」と出し、`ModelClickedEvent` を待つ(60 秒で取り消し。モデルの外をクリックしてもイベントは来ないので、待っている間は「モデルの上をクリックしてください」を出し続ける)。デコポコの画面にはクリック待ちの間、絵の範囲を点線で示す
3. クリックが来たら、`artMeshHits` のうち `artMeshOrder: 0`(一番上のパーツ。VTS の窓で手でアイテムを落とした時と同じパーツ)を付け先にする
4. クリック位置(`clickPosition`、VTS 座標)をボードの座標に換算し(§6.4)、そこを**中心**にした PNG を作る: 絵の範囲とクリック位置を両方含み、クリック位置が画像の中心に来るよう透明で広げる
   - 辺が 2048 px を超えるなら縮め、縮小率 `k` を記録する(§6.5 の大きさに掛ける)。クリック位置が絵から遠く、縮小率が 1/2 を下回る(線がぼける)なら「絵の近くをクリックしてください」と出して 2 に戻る
   - 64 px 未満なら 64 px に広げる。5 MB を超えたら「絵が大きすぎます」
5. `ItemLoadRequest`: `fileName` = `deco-<8 桁の英数>.png`(8〜32 文字の規則)、`customDataBase64`、`customDataAskUserFirst: true`, `customDataSkipAskingUserIfWhitelisted: true`, `customDataAskTimer: 0`、`positionX/Y` = クリック位置、`size` = §6.5、`rotation: 0`、`fadeTime: 0`(フェード中のピン留めを避ける)、`order` は指定しない(空いている順番を VTS が選ぶ)、`unloadWhenPluginDisconnects: false`、`locked: true`(VTS の窓で誤ってつかまないように)。VTS で画像読み込みの確認が出る。確認の間は応答が返らないので、応答待ちに時間制限は付けず「VTube Studio で許可してください」を出す
6. `ItemPinRequest`: `pin: true`, `angleRelativeTo: "RelativeToCurrentItemRotation"`, `sizeRelativeTo: "RelativeToCurrentItemSize"`、`vertexPinType: "Provided"`、`pinInfo` = 3 の `hitInfo` の `modelID` / `artMeshID` / `vertexID1..3` / `vertexWeight1..3` に `angle: 0`, `size: 0`(今の角度・大きさのまま)
7. 成功したら(§6.6)
   - **戻す / やり直すの履歴をここで確定する**: 全レイヤーの op を base に焼き込み、`ops` / `redoOps` を空にする(`undo()` は全レイヤー共通の末尾から外すので、一部のレイヤーだけ戻せない状態を作らないため)。そのうえでそのレイヤーを空にする
   - `attached` に記録し、パネルに「付けている絵」の一覧(小さな見本・外す)を出す

ピン留めの点 = アイテムの中心、になる前提。この前提と、ピン留め後に絵がずれないか・頭の動きに付いてくるかは段階 a で確認する。

### 6.4 座標の換算(ボード ↔ VTube Studio)

VTS の座標は窓の左端 x=-1・右端 x=+1、下端 y=-1・上端 y=+1(VTS の座標系の図)。窓の画素の大きさは `ModelClickedEvent` の `windowSize`(`StatisticsRequest` の `windowWidth/Height` でも可)。縦横比が 16:9 でない窓で y の ±1 が窓の上下端か(x と同じ縮尺ではないか)は段階 a で確かめる。

**OBS とつないでいない場合**: デコポコのソースと VTube Studio のキャプチャが、どちらも OBS のキャンバス全体に同じ縦横比で置かれている前提で換算する。
- ボード (bx, by) → VTS: `x = bx / W * 2 - 1`、`y = 1 - by / H * 2`

**OBS とつないでいる場合(位置合わせ)**: 連携の設定で「VTube Studio を映しているソース」と「デコポコのソース」を番組のシーンのソース一覧(`GetSceneItemList`)から選ぶ(名前に `VTube` / `VTS` / `deco` を含むものを最初から選んでおく)。付けるたびに両方の `GetSceneItemTransform` を取り、ボード → OBS のキャンバス → VTS の窓の画素 → VTS 座標、と換算する。
- transform のフィールド一覧は文書の表にないので、段階 a で実物(位置・拡大率・切り取り・回転・バウンディングボックス)を確かめて式を決める。v1 は回転・バウンディングボックスありの配置は「前提どおりに置いてください」と断る
- シーンの中のグループ / 入れ子のシーンの中にあるソースは選べない(番組のシーンの直下だけ)

ボードの座標は OBS の 1920x1080 前提。普通のブラウザで開いたボード(大きさが違う)からは付けない(§1 範囲外。ボタンを無効にする)。

### 6.5 大きさの換算

`ItemLoadRequest` の `size` は 0〜1(0.32 が手で読み込んだ時の標準)で、画素との関係は文書にない。**段階 a で実測**して式を決める(画像の画素数・縦横比・VTS の窓の大きさ・モデルの拡大率のどれに依るか)。式には §6.3 の縮小率 `k`(縮めた画像を元の大きさで見せるため 1/k 倍)を入れる。実測で式が決まらない場合は、付けた後に OBS で番組のシーンを撮って絵の大きさを測り、`ItemMoveRequest` で `size` を直す方式を検討する(§12 未決 4)。

### 6.6 付けた絵の記録と整合

`LS_KEY` の保存データに次を足す。

- `attached: [{id, img(付けた PNG の dataURL), k, modelID, artMeshID, vertex, weight, fileName, instanceID}]`。VTS で作り直す時はこの `img` から作る(ボードのレイヤーや一緒にデコるの部屋の絵には依存しない)
- `pendingUnload: [instanceID]`: 外したが VTS につながっていなくて消せなかったアイテム

状態ごとの扱い:

- **外す**: `ItemUnloadRequest`(`instanceIDs`)→ 成功したら `attached` から消し、`img` を元の位置で**今選んでいるレイヤー**に戻す(戻した絵は戻すボタンで取り消せる 1 つの op にはせず base に焼き込む。一緒にデコるの部屋にいる間は外せない)。VTS とつながっていない時は `pendingUnload` に入れてから絵をボードに戻し、次の接続時に先に `ItemUnloadRequest` を送ってから消す(二重に映る時間を作らないよう、つながっていない時は「VTube Studio を起動してから外してください」を先に出し、それでも外すかを選ばせる)
- **ボードを読み込み直した / VTS を再起動した**(作ったアイテムは VTS の再起動で消える): 接続時に `ItemListRequest`(`includeItemInstancesInScene: true`)で今のアイテムを取り、`attached` の `instanceID` がなければ `img` から読み込み直してピン留めし直す(`instanceID` を更新)。再起動後に許可済みの画像の記録(SHA256 の whitelist)が残るか = 確認ダイアログがまた出るかは段階 a で確かめる
- **モデルを切り替えた**(`ModelLoadedEvent` で別の `modelID`)/ **モデルを外した**(`modelLoaded: false`): その間 `attached` は保留(VTS にアイテムが残っていても触らない)。パネルの一覧に「別のモデルに付けた絵」と出す。元のモデルに戻ったら、残っていなければ付け直す。モデルを外した時にピン留めのアイテムがどうなるか(残る / 消える / 外れて残る)は段階 a で確かめ、ここを直す
- **一緒にデコるの部屋**: `attached` は VTS 側にあるのでボードの描画とは関係しない(render から除く処理は要らない)。部屋の間は付ける / 外すを無効にするだけ
- 「全部消す」は `attached` には効かない(ボードのレイヤーだけ)

### 6.7 使わないもの

- `ArtMeshAtPositionRequest`(座標からパーツを引く)は public beta 限定なので使わない。付け先は VTS の窓のクリック(`ModelClickedEvent`)で決める
- 顔の向きの値(FaceAngleX など)で絵を動かす方式は使わない(ピン留めならパーツの変形にそのまま付いていくため)

## 7. 画面

| 場所 | 追加するもの |
|---|---|
| 色の行 | スポイトボタン |
| レイヤーの行 | 立ち絵に付ける |
| パネル(付けた絵があるときだけ) | 付けている絵の一覧(小さな見本・外す・「別のモデルに付けた絵」の表示) |
| パネル下部 | 「連携」ボタン → OBS(ポート・パスワード・保存する・接続テスト・位置合わせのソース選択)/ VTube Studio(ポート・接続・許可の状態)/ 両方の「設定を消す」 |

状態の表示は既存のトースト(短いメッセージ)に合わせる。文言は実装時に yomiyasu で整える。

## 8. 一緒にデコる・保存データとの関係

- スポイトはローカルの色を変えるだけで、op には何も足さない
- `attached` は自分の保存データにだけ入れる。付けた絵はボードのレイヤーから抜けているので、一緒にデコるの部屋(プラス版の WS 方式・§12 の P2P 方式とも)の絵には最初から含まれない。部屋の間も VTS の絵は付けたまま(§12 未決 5)
- 保存データの形が変わる(`attached` / `pendingUnload` を足す)。古い版で開いても無視されるだけで壊れない(その場合、付けた絵は VTS にだけ残り、古い版からは外せない。VTS 側で消してもらう)

## 9. プライバシー・規約

- 通信先は `localhost` の OBS / VTube Studio だけ。外部への送信はない。プライバシーポリシーの変更は不要(段階 c で、ツールのページと MANUAL に「同じパソコンの OBS / VTube Studio とだけ通信する」と書く)
- 撮った OBS の画面は保存しない(スポイトを閉じたら捨てる)

## 10. 試験

- 単体(既存の画素テスト方式、scratchpad の cdp_run.py): 偽の obs-websocket / VTS サーバー(Python の websockets、`/home/codex/pokonya-venv`)を立て、認証の計算、`imageData` の data URI / 素の Base64、縦横比の違う画像の置き方と拾った色、PNG の切り出し(中心・2048 の縮小と `k`・1/2 未満の拒否・64 の拡大)、付けた時の履歴の確定とレイヤーを空にすること、`attached` の保存、外す(つながっている / いない → `pendingUnload`)、作り直し、モデル切り替え / 外し、許可ダイアログ待ちで応答が遅れる `ItemLoadRequest`、errorID 50 での token 取り直し、複数ボードの token 取得の順番を確かめる
- 実機(段階 a・b): §11

## 11. 段階

| 段階 | 内容 | 誰が |
|---|---|---|
| a | 実験ページ(scratchpad、本体とは別)で確認: §3.2 の https → localhost(OBS の CEF と Chrome、`::1` / `127.0.0.1`)、スクリーンショットの所要時間、`GetSceneItemTransform` の中身、VTS の座標系(16:9 以外の窓)と `size` の換算、ピン留めの点 = アイテムの中心か、ピン留め後に頭の動きに付いてくるか、`locked: true` のアイテムを API でピン留めできるか、前に付けた絵の上をクリックしても `ModelClickedEvent` が来るか、VTS 再起動後に確認ダイアログがまた出るか、モデルの切り替え / 外しでのアイテムの残り方 | ぶらんち(VTS のある PC)。結果で §6.4・§6.5 を直す |
| b | スポイト(OBS 連携)を実装 → 無料版 / プラス版のマイナー更新 | codex → ぽこが OBS で確認 |
| c | 立ち絵に付ける(VTS 連携)を実装、MANUAL・ツールのページ更新 | codex → ぽこが VTS + OBS で確認 |

スポイトだけ先に出せるように b と c を分ける。

## 12. 未決事項(推奨付き)

1. **段階 a の VTS 実機**: ぽこの PC で行うか、ぶらんちの PC に VTube Studio(無料版で可)を入れるか。推奨: ぶらんちの PC(ぽこの配信環境を触らずに済む)
2. **付けられる数**: 1 回付けるごとに 1 アイテム。部位ごと(頭と肩など)に分けたい時は、片方を描いて付けてから次を描く。上限は 1 ボード 10 個(VTS の例の `totalItemsAllowedCount` は 60)。推奨: 10 個
3. **OBS のパスワード保存の既定**: (a) 既定は「保存する」+ 手順書に「デコポコ専用のパスワードにする」「気になるならローカルファイル版」/ (b) 既定は「保存しない」(OBS を起動するたびに入れる)。推奨: (a)(ぽこが毎回入れるのは現実的でない。漏れても使えるのはその PC の OBS に localhost からつなげる場合だけ)
4. **位置合わせ(§6.4、OBS の transform を使う)と大きさの補正(§6.5)を v1 に入れるか**: 推奨: 入れる(OBS とつないでいる時だけ)。ただし段階 a で transform の中身と size の式を見てから最終決定
5. **一緒にデコるの部屋を開いた時、VTS に付けた絵をどうするか**: 推奨: 付けたまま(部屋の絵には含めない。部屋の間は付ける / 外すを無効)
6. **下絵の表示**: OBS の対話ウィンドウにはデコポコしか映らず、立ち絵の位置を見ながら描けない。スポイトと同じスクリーンショットを「下絵」として薄く表示する機能(撮るのはボタンを押した時、または数秒おき)。推奨: 段階 c の後に別に検討(撮った画像にデコポコ自身も写るので、自分の線が二重に見える問題の扱いが要る)
7. **3D モデル**: 範囲外のまま。要望が出たら別の設計にする
