# デコポコ「一緒にデコる」設計(ドラフト)

状態: **承認済み**(2026-10-15 ぶらんち。§10 は推奨どおり)。§11(3 人以上)は 2026-10-16 追加、同日承認(§11.9 は推奨どおり、人数は計 4 人)。2026-10-15 作成、同日 Fable レビューを反映。実装は下の「段階分け」の順に別チケットで行う。§12(無料版の一緒にデコる、WebRTC・ホスト中心・Cloudflare TURN)は 2026-10-17 追加、同日 **承認**(§12.15 の未決は推奨どおり、規約は FAQ を根拠に進める)。

## 1. 目的と範囲

配信中に、ぽこ(ホスト)とコラボ相手(ゲスト)の 2 人が同じデコポコの画面に同時に描けるようにする。有償版だけの機能。

決まっていること(2026-10-15):

| 項目 | 決定 |
|---|---|
| 提供範囲 | **Web 版だけ**(hoshino-poko.com の有償版配信 `/tools/plus/deco-poko/` と OBS 用 URL)。単体版(BOOTH の zip / ローカルファイル)には入れない |
| 同期サーバー | **ぽこにゃー(pokonya-api)に同居**。新しいコンテナは立てない |
| 人数 | **2 人の部屋方式**(ホスト 1 + ゲスト 1) |

範囲外(v1): 3 人以上、視聴者参加、描いた絵のサーバー保存、pokonya 再起動をまたいだ絵の復元、相手のカーソル表示、録画・リプレイ、無料版での同期。

## 2. 全体構成

```text
ホスト(ぽこ)                                   ゲスト(コラボ相手)
ブラウザ /tools/plus/deco-poko/(cookie)           OBS / ブラウザ
  … 部屋を開く・招待 URL を出す・閉じる              /tools/plus/guest/<招待トークン>/deco-poko/
OBS /tools/plus/obs/<OBSトークン>/deco-poko/
  … 開いている部屋に参加して描く
        │  静的ファイル: nginx が auth_request で可否を聞いてから配信(既存の仕組み)
        │  同期: wss://hoshino-poko.com/api/members/deco/ws
        │  部屋の操作: POST/DELETE /api/members/deco/room(cookie + Origin 検証)
        ▼
cnh-vps nginx ──(Upgrade 付きで proxy)──▶ pokonya-api:29985
                                            members/deco/(新規): 部屋・招待・中継・メモリ上の op 記録
```

- WebSocket の口は `/api/members/deco/ws`。nginx では `location = /api/members/deco/ws` を足す(完全一致なので既存の `location ^~ /api/members/` より優先される)。cookie(`poko_session`、host-only、SameSite=Lax)は同一オリジンなので届く
- 部屋の状態は pokonya のプロセス内メモリに置く。pokonya は uvicorn 1 プロセス(`Dockerfile:22`、`--workers` 無し)で、members もすでに 1 プロセス前提(`members/db.py:1`、`router.py:25` の `_reverify_hits`)。**`--workers` を増やすと壊れる** ことを pokonya の docs にも書く
- 描いた絵はサーバーに保存しない(メモリ上だけ。部屋が閉じる / pokonya が再起動すると消える)

## 3. 参加者と認証

### 3.1 ホスト

- 条件: deco-poko の有償版権利。`db.tool_by_dir("deco-poko")` でツール行を取り、`entitlement.tool_access(entitlement, tool_row)` の `web`(cookie 接続)/ `obs`(OBS トークン接続)
- **部屋の操作(開く・招待をやり直す・閉じる)はブラウザ版(cookie)だけ**。REST で `require_same_origin` 付き:
  - `POST /api/members/deco/room` … 部屋を開く(開いていればそのまま)。招待 URL を返す(全文はこの時だけ)
  - `POST /api/members/deco/room/invite` … 招待をやり直す(古い招待は即失効、ゲスト接続を切断)
  - `DELETE /api/members/deco/room` … 部屋を閉じる(全接続を切断、招待失効)
- OBS トークン経由の接続は **参加して描くだけ**(部屋の操作はできない)。OBS 用 URL が漏れたときの被害を限定するため。ぽこは OBS の対話で描き、部屋の操作はブラウザで行う
- 1 人のホストが同時に持てる部屋は 1 つ。ホストの接続は 3 本まで(OBS + ブラウザなど)

### 3.2 ゲスト

- **権利は要らない**(コラボ相手はメンバーでないことが多い。未決事項 1)。招待トークンだけで入れる
- 招待トークン: `secrets.token_urlsafe(32)`。SQLite の `deco_invites`(`token_hash`、`prefix`、`host_uid`、`tool`、`created_at`、`expires_at`、`revoked_at`)にハッシュだけ持つ。有効期限は 24 時間、または部屋を閉じる / やり直すまで
- ゲスト用ページは `/tools/plus/guest/<招待トークン>/deco-poko/`。nginx の `auth_request` で pokonya に可否を聞いてから配信する(OBS 用 URL と同じ形)。**招待なしで有償版を開ける抜け道にしない** ため
  - `service.authorize_path` に `guest/` の分岐を足す。`obs_tokens.authorize`(`obs_tokens.py:78-96`)と同じ形で、**招待の `tool` と URL のツールのディレクトリが一致すること** を必須にする(`/tools/plus/guest/<tok>/roulette/` は 403)。ホストの権利が切れていれば招待も 403
  - 予約語 `guest` を足す場所は 3 つ: `service.RESERVED_PLUS_SEGMENTS`、`obs_tokens.issue` 内のハードコード(`obs_tokens.py:33`)、nginx のブラウザ版 location の否定先読み(`tools-plus.conf.example` の `(?!obs/|files/|api/)` と末尾スラッシュ補完の `(?!obs$|expired$|files$|api$)`)
- ゲスト用 URL は OBS にもブラウザにもそのまま貼れる。ゲストの接続も 3 本まで
- 招待トークンは OBS トークンと同じく、静的ページの URL パスとして nginx のアクセスログに残る(既存と同じ運用。WebSocket 側で隠しても効果は限定的)

### 3.3 WebSocket の認証手順

1. ハンドシェイク: `Origin` が `MEMBERS_SITE_ORIGIN` と一致し、Host / `X-Forwarded-Host` がサイトのホストであることを確認する(`require_members` / `require_same_origin` と同じ判定。ただし HTTP 用の `MembersError` ハンドラ(`router.py:221`)は WebSocket では効かないので、`accept()` してから検証し、失敗は close コードで返す)。nginx の WS location にも `X-Forwarded-Host` を付ける
2. 接続後 5 秒以内に、クライアントが最初のメッセージ `auth` を送る。トークンは URL のクエリに載せない

```json
{"t": "auth", "v": 1, "via": "cookie"}
{"t": "auth", "v": 1, "via": "obs",   "path": "/tools/plus/obs/<token>/deco-poko/"}
{"t": "auth", "v": 1, "via": "guest", "path": "/tools/plus/guest/<token>/deco-poko/"}
```

   - `path` はページ自身の `location.pathname`。サーバーは既存の `OBS_PATH_RE` と新しい `GUEST_PATH_RE` で取り出し、静的ファイルの判定と同じ関数で検証する
3. 通れば `welcome`。通らなければ close(`4401` 未認証 / `4403` 権利なし・失効 / `4404` 部屋なし / `4409` 接続数超過 / `4429` 上限超過)
4. **接続中も 10 分ごとに再検証** する。DB の照合だけ(`resolve_session` のセッション期限、`current_entitlement`、OBS トークン行、招待行)で、Discord API は叩かない。招待のやり直し・部屋を閉じる操作は、この再検証を待たずにその場で該当接続を切る

## 4. 描画データのモデル(クライアントの作り直し)

今のデコポコは「レイヤー画像のスナップショット」で戻す / やり直すをしている。2 人で描くと「自分の線だけ戻す」ができないので、**操作ログ(op)から描き直す方式** に変える。

```text
op = 線   {id, seq, seat, layer, tool(brush|outline|eraser|neon|marker。neon・marker はプラス 0.5.0 から), color, alpha, size, edge(auto|white|black|#rrggbb), osize, pts[[x,y],...], undone}
   | 消去 {id, seq, seat, layer|all, scope(mine|all), undone}
レイヤーの画像 = そのレイヤーの op を seq 順に描いたもの(undone は飛ばす)
```

- **id と seq はサーバーが振る**。`welcome` で接続ごとの `conn` 番号を配り、クライアントは描きかけの線に仮 id `<conn>-<n>` を付ける。サーバーは `s.end` で確定するときに部屋内の通し番号 `seq` を振り、`id = seq` として全員に流す(OBS の再読込やホストの 2 画面でも衝突しない)
- **戻す / やり直すはサーバーが対象を選ぶ**。クライアントは `undo` / `redo` だけ送り、サーバーが「その席の最後の取り消していない op」/「その席の最後に取り消した op」を選んで `undone` を切り替え、全員に流す。ホストの OBS とブラウザで同時に押しても順番は 1 つに決まる
  - その席が新しい op を確定したら、その席のやり直し候補は消える
  - **消去(all またはそのレイヤー)より前の op は戻す対象にしない**(戻しても見た目が変わらず分かりにくいため)。消去そのものは戻せる(戻すと消えていた線が描き直しで戻る)
- 消去の範囲: ホストの「全部消す / このレイヤーを消す」は全員の線、ゲストのは **自分の線だけ**(`scope: mine`。未決事項 2)
- 手元の表示: 自分の線は描いている間から手元に出す(返事を待たない)。`s.end` の確定で seq が付いたら、その位置に並べ直し、順番が変わったレイヤーだけ描き直す(独立した線なら見た目は変わらない。消しゴムが絡むときだけ差が出る)
- **座標とサイズは 1920x1080 の論理座標**(`size` / `osize` も論理 px)。一緒にデコる中は画面を 1920x1080 のステージにし、描画は `ctx.setTransform(scale…)` 1 つで拡大縮小する(devicePixelRatio も含める)。1 人で使うときは今まで通りウィンドウの px
- 一緒にデコるを始めると、手元のキャンバスは部屋の内容(`welcome` の op)に置き換わる。1 人で描いていた絵は持ち込まない(1 人用の保存はそのまま残り、部屋を出ると戻る)
- 描き直しの負荷: 上限(下の 7)の範囲なら 1 レイヤー数百本で、1 フレームで終わる
- 小数は 1 桁に丸める(データ量を減らす)

この作り直し(op ログ方式、戻す / やり直す / 消去の扱い)は **無料版にも先に入れる**(段階 0)。見た目と操作は変えない。有償版は main を merge して追従するルール(`docs/release/editions.md`)なので、土台を main で作っておくと衝突が減る。

## 5. 通信プロトコル(v1)

JSON テキストフレーム。`t` が種類、`v` が版。**C→S の 1 メッセージは 32KB まで**(S→C の `welcome` は大きくなりうる)。

| 向き | t | 中身 | 説明 |
|---|---|---|---|
| C→S | `auth` | 3.3 | 最初の 1 通 |
| S→C | `welcome` | `seat`(host/guest)、`conn`、`ops`(全 op。`undone` 含む)、`peer`(相手がいるか)、`limits` | 途中参加・再接続でもこれで全体を受け取る |
| C→S→他の接続 | `s.begin` | `tmp`(仮 id)、`layer, tool, color, alpha, size, edge, osize, pt` | 描き始め。相手側は描きかけとして表示 |
| C→S→他の接続 | `s.pts` | `tmp, pts` | 30ms ごとにまとめて送る |
| C→S→全員 | `s.end` → `op` | `tmp` → 確定した op(`id`、`seq`、全点) | 確定。送り主にも返して仮 id と対応付ける |
| C→S→全員 | `clear` → `op` | `layer\|all, scope` | 消去 op |
| C→S→全員 | `undo` / `redo` → `undone` | → `id, undone` | 対象はサーバーが選ぶ |
| S→C | `peer` | `joined` / `left` | 相手(席)の出入り。名前は出さない |
| S→C | `closed` | 理由 | 部屋が閉じた・招待が失効した |
| 両方 | `ping` / `pong` | | 25 秒ごと(nginx のタイムアウト対策) |

- **描きかけの線はサーバーが接続ごとに 1 本だけ一時保持** する(`s.begin` 〜 `s.pts` の点を溜め、`s.end` で確定)。点が 4000 を超えたらそこで確定する。切断されたら捨て、相手側にも捨てるよう流す
- サーバーは確定した op を **受け取った JSON の文字列のまま** 保持し、`welcome` は文字列の連結で作る(Python のリストに展開しない。メモリとイベントループの両方のため)。`undone` は op とは別の集合で持ち、`welcome` に添える
- pokonya が再起動したら部屋と絵は消える。招待は SQLite にあるので、ホストが再接続すると **同じ招待のまま空の部屋が作り直され**、ゲストの URL もそのまま使える(絵の復元はしない。範囲外)

## 6. 部屋の寿命

```text
ホストがブラウザ版で「一緒にデコる」を押す → 部屋を作成 + 招待 URL(パネルに表示・コピー)
ぽこは OBS 用 URL のソースを対話で開く → 部屋に参加(OBS 側は自動で部屋を探して入る)
ゲストが招待 URL を開く → 参加
誰も接続していない状態が 2 時間続く → 部屋を破棄(招待は期限まで有効。ホスト再接続で空の部屋が復活)
ホストが「部屋を閉じる」 → 全員切断、招待失効
```

## 7. 上限(荒らし・メモリ対策)

| 項目 | 上限 | 超えたら |
|---|---|---|
| 同時に開いている部屋 | 5 | 新しい部屋を作れない(「混んでいます」) |
| 1 部屋の op の合計 | 2MB(受信した JSON の大きさ) | 新しい線を受け付けない。「全部消す」を促す |
| 全部屋の op の合計 | 10MB | 同上 |
| 1 本の線の点数 | 4000 | そこで確定 |
| C→S の 1 メッセージ | 32KB | 切断 |
| メッセージ数 | 1 接続あたり 60 通/秒(`s.pts` は約 33 通/秒) | 超えた分を捨て、続けば切断 |
| 接続数 | ホスト 3 + ゲスト 3 / 部屋、全体 30(認証前の接続を含む) | `4409` / `4429` で拒否。nginx でも `limit_conn` を掛ける |

メモリの見積もり: op を文字列で持つので、上限いっぱいでも op は 10MB、描きかけ(接続あたり最大 4000 点 × 約 120B ≒ 0.5MB)が 30 接続で 15MB、合わせて 30MB 弱。普段(部屋 1 つ)は数 MB。cnh-vps は空きが少ない(2026-10-15 実測: available 760Mi、swap 1.5Gi 使用)ので、**着手前に mc-bedrock-proxy のプロセス溜まり(別セッションで調査中)を片付けて余裕を作る**。

CPU とイベントループ: 中継と小さな JSON の読み書きだけ。描き直しはクライアント側で、サーバーは画像を扱わない。pokonya は Discord Bot と同じイベントループなので、大きな JSON の一括変換をしない(上の文字列保持)。SQLite は同期呼び出しなので、WebSocket の中で使うのは接続時と 10 分ごとの再検証だけにする。

## 8. 変更が要る場所

### pokonya(`Pokkomyu/pokonya`)

- `members/deco/`(新規): 部屋(メモリ)、`deco_invites` テーブルと発行・失効、REST(`/api/members/deco/room`)、WebSocket(`/api/members/deco/ws`)、再検証タスク、上限
- `service.authorize_path` に `guest/` の分岐(ツール一致の照合込み)、予約語 `guest`(3.2 の 3 か所)
- `requirements.txt`: `websockets` を追加し、**`uvicorn` と一緒に版を固定** する(今の image の uvicorn には WebSocket の実装が入っていない。`websockets` の新しい版で uvicorn 側の実装が切り替わるため組み合わせで固定)
- ログ: 部屋の作成・参加・切断・失効だけを `db.audit` / logger に残す。ゲストの出来事はホストの uid で記録する(`audit` の uid は必須)。描いた内容とトークンはログに出さない(`members-api.md` の方針)
- テスト: 部屋のロジック(席・conn 番号・seq・undo / redo の対象選び・消去をまたがない・上限・再検証で切断・招待のツール照合)を pytest、WebSocket は Starlette の TestClient で
- docs: `docs/architecture/members-api.md` に deco の API と「1 プロセス前提」

### wp-poko(`Pokkomyu/wp-poko`)

- `deploy/prod/nginx/tools-plus.conf.example`:
  - `location = /api/members/deco/ws`(`proxy_http_version 1.1`、`Upgrade $http_upgrade`、`Connection "upgrade"`、`Host` / `X-Forwarded-Host` / `X-Forwarded-Proto`、`proxy_read_timeout 3600s`、`limit_conn`)
  - `location ~ "^/tools/plus/guest/[A-Za-z0-9_-]{32,}/(?<plus_rel>[a-z0-9-]+/.*)$"`(OBS 用と同じ形。401/403 は透明ページ `/tools/plus/expired`)
  - ブラウザ版の正規表現と末尾スラッシュ補完に `guest` を足す
- `docs/architecture/members-service.md` に上の 2 つ
- `/tools/plus/` の画面の変更は要らない(招待はツールのパネルの中で出す)

### poko-tools(`Pokkomyu/poko-tools`)

- 段階 0(`main`): op ログ方式への作り直し(見た目・操作は同じ、0.2.0)
- 段階 2(`edition/plus`): `tools/deco-poko/` に一緒にデコる。パネルに「一緒にデコる」「招待 URL をコピー」「招待をやり直す」「部屋を閉じる」(ブラウザ版だけ)、相手の出入りと接続状態の表示。同期のコードは `collab.js` に分ける(main からの merge で衝突しないように)
- 一緒にデコるの表示は `location.host` が hoshino-poko.com のときだけ(BOOTH の zip 版・ローカルファイルでは出さない)

## 9. 段階分け

| 段階 | repo | 内容 | 前提 |
|---|---|---|---|
| 前提 | cnh-vps | mc-bedrock-proxy のプロセス溜まりを直してメモリを空ける | 別セッションで調査中 |
| 0 | poko-tools main | op ログ方式に作り直し(無料版 0.2.0)。headless Chrome で 戻す / やり直す / 消去の戻し / 保存と復元 | この設計の承認 |
| 1 | pokonya | `members/deco/`、招待、`_auth` の guest 分岐、`websockets` / `uvicorn` 固定、pytest | 承認 |
| 2 | poko-tools edition/plus | 有償版デコポコ + `collab.js`。2 つの headless Chrome で同時描画・undo・再接続・招待やり直しを確認 | 0, 1 |
| 3 | wp-poko + 本番 | nginx conf、`bin/pokonya tools add deco-poko`、`update_plus_files.sh` で配置、ぽこ + ゲスト役で実機確認 | 1, 2 |

段階 3 の手順書はぽこ / ぶらんちの分担入り HTML にする(ぽこ: ブラウザで部屋を開く・OBS に貼る・ゲストに URL を渡す・描いて確かめる / ぶらんち: run.sh で反映)。

## 10. 決定事項(2026-10-15 承認時、すべて推奨どおり)

1. **ゲストに権利を求めない**。招待トークンだけで入れる
2. **ゲストの「全部消す / このレイヤーを消す」は自分の線だけ**。ホストのは全員の線
3. **部屋の操作(開く・招待をやり直す・閉じる)はブラウザ版だけ**。OBS の対話では参加して描くだけ
4. 上限は §7 のまま(部屋 5、1 部屋 2MB、全体 10MB、接続 30)。運用してから見直す
5. 有償版デコポコの BOOTH zip 版を出すかは **後で決める**(出す場合も一緒にデコるは入らない、と説明に書く)

既知の前提: cnh-vps の mc-bedrock-proxy のプロセス溜まりは 2026-10-15 に対策済み(PIDS 1831 → 1、available 約 200Mi 増)。

## 11. 3 人以上(人ごとの席)— 承認済み(2026-10-16)

2026-10-16 ぶらんち「これは 2 人までしかだめ?」から。v1(§1〜§10)は承認・本番反映済みで、この節は追加の設計。承認後に別チケットで実装する。2026-10-16 Fable レビューを反映。

### 11.1 今の問題

席は `host` と `guest` の 2 つだけ。招待 URL を複数人に渡すと全員が `guest` 席に入り(席あたり 3 接続まで)、戻す / やり直す / 「自分の線だけ消す」をその人たちで共有してしまう(ゲスト A の「戻す」でゲスト B の線が消える)。

### 11.2 方針

| 項目 | 案(推奨) |
|---|---|
| 人数 | ホスト 1 + **ゲスト 3 人まで**(計 4 人)。上限は設定値 |
| 招待 | **今の 1 本の招待 URL を共有**する。人ごとの招待は作らない(ぽこの手間を増やさない) |
| 人の見分け方 | v2 のゲスト画面は最初の参加で **席キー** を受け取り、localStorage に持つ。再接続・再読み込みでも同じ席 |
| 同じ人の 2 画面 | パネルに「自分の OBS 用リンク」= 招待 URL + `#seat=<席キー>` を出す。これを OBS に貼れば、ブラウザと OBS が同じ席になる(`#` 以降はサーバーにもアクセスログにも送られない) |
| 席の名前 | サーバーが `g1` / `g2` / `g3` … を振る(部屋の中で番号を使い回さない)。画面の表示は「ゲスト 1」など。名前は出さない |
| 今の版(v1)のゲスト画面 | **今どおり共有の `guest` 席 1 つ**に入れ、人数 1 として数える(v1 の動きをそのまま保つ。読み込み直せば v2 になる) |
| ホストの操作 | 今どおり(全員の線を消す / 招待をやり直す = 全ゲストを切る / 部屋を閉じる)。特定のゲストだけ切る機能は作らない(必要になったら) |

### 11.3 席キーと席の割り当て(pokonya)

- 席キー: `secrets.token_urlsafe(16)`(128 bit)。部屋のメモリに **ハッシュ → 席 ID** の対応だけを持つ(SQLite には書かない)。席キーは認証ではない(認証は今どおり招待)。他人の席キーを知らなければ他人の席には入れない
  - 「自分の OBS 用リンク」は招待トークンと席キーを OBS のシーン設定に平文で残す。漏れた場合の影響は「その人の席に入れる(その人の線を戻す / 消す)」だけで、招待そのものと同じ扱いで許容する
- 参加(`join`)時の判定(この順):
  1. v1 の `auth`(`v: 1`)のゲスト → 共有席 `guest`
  2. v2 で席キーがあり、対応がある → その席(ただし、その席が人数から外れていて満員なら `4410`。ゲスト 3 人までを守る)
  3. v2 で席キーが無い・知らない → **人数に空きがあるときだけ** 新しい席 ID と席キーを発行し、`welcome` で返す。空きが無ければ席を発行せずに close `4410`(人数がいっぱい)
- 人数の数え方: 「接続のある席」+「切れてから 10 分以内で、線を 1 本以上描いた席」。画面に出す人数(`people`)も同じ数え方。招待をやり直す前の席は数えない。**線を描いていない席は切断した時点で破棄**(10 分待たない。localStorage が使えない環境で再読み込みを繰り返しても人数を食い潰さない)
- 発行済みの席は部屋あたり 50 まで(超えたら `4410`)。席キーの対応表が際限なく増えないようにする
- 10 分以上つながっていない席は人数から外す。ID とキーの対応は部屋がある間は残す(同じ人が戻れば同じ席。その人の線は ID で残っているので、戻す / 自分の線だけ消すが続けて使える)
- 招待をやり直す / 部屋を閉じる / pokonya の再起動 / 2 時間放置で部屋を捨てる、のどれでも席の対応はすべて無効(全員が新しい席になる)
- 戻す / やり直す / 消去(scope=mine)は今のロジックのまま席 ID 単位で動く(`_covers`・`undo_target`・`_clear` の `seat != "host"` → mine は `g1` でもそのまま正しい)。`Room.redo` を固定の `{host, guest}` から席 ID ごとの辞書(`setdefault`)に変える

### 11.4 プロトコル v2(v1 と混在できる)

| 向き | t | 変更 |
|---|---|---|
| C→S | `auth` | `v: 2`。`via: "guest"` のときだけ任意で `seat_key` |
| S→C | `welcome` | `v: 2`。`seat` は `host` / `g1` …。新しく席を作ったときだけ `seat_key`。`people`: いま参加している人数(自分を含む)。`peer`(bool、自分以外がいるか)は v1 と同じく残す |
| S→C | `peer` | v2 宛て: `{"t":"peer","seat":"g2","peer":"joined"/"left","people":3}`。v1 宛て: 今どおり `{"t":"peer","peer":...}` で、「自分以外の席が 0→1 で joined / 1→0 で left」に変換して送る(席単位で送ると、g2 が抜けただけで v1 ホストが「相手: まだ」になるため) |
| S→C | close | **`4410` 人数がいっぱい**(新設)。4409(席あたりの接続数超過)は今のまま |

- **混在の前提と公開の順番**: 今のサーバーは `v != 1` の `auth` を 4401 で断り、v1 の画面は 4401 でつなぎ直しをやめる。だから **必ず pokonya(v1 と v2 の両方を受ける)を先に出し、そのあとでデコポコ プラス(v2)を配置する。逆の順番は不可**。配置後も、開いたままの画面(OBS など)は読み込み直すまで v1 のまま動く
- 接続を受け付ける前の拒否(人数がいっぱいなど)でも理由を送れるよう、router の `join` 拒否の経路で `Close.reason` があれば `{"t":"closed","reason":...}` を送ってから閉じる(今は接続確立後の `_writer` だけが理由を送っている)
- v1 の画面は 4410 を知らないので、通信エラーと同じく間隔を空けてつなぎ直す(最大 30 秒)。被害は小さい
- サーバーは接続ごとに版(`v`)を持ち、`peer` を版に合わせて送る

### 11.5 クライアント(デコポコ プラス)

- 席キーは localStorage `poko-deco-seat:<招待トークンの先頭 6 文字>` に持つ。保存するときに、ほかの `poko-deco-seat:*` は消す(招待ごとに溜まらないように)。localStorage が使えないときは sessionStorage → メモリの順に逃がす
- ページの URL に `#seat=<キー>` があれば、それを優先して保存し、`#` は `history.replaceState` で消す(画面に残さない)
- 4410 は「人数がいっぱいです(ホスト + 3 人まで)」と出して 30 秒ごとに再試行
- パネル: 「参加: 3 人」、自分の席(「ゲスト 2 で参加中」)、ゲストだけ「自分の OBS 用リンク」(コピー)
- 消去・戻す・やり直すの UI は変えない(対象はサーバーが席 ID で選ぶ)

### 11.6 上限とメモリ

- 1 部屋 2MB / 全体 10MB / 部屋 5 は据え置き。4 人で描くと早く満杯になりうるので、運用を見て 1 部屋の上限を見直す(cnh-vps の空きは 2026-10-15 の対策後 available 約 800Mi)
- 接続: 席あたり 3 は据え置き。**全体は 30 → 60** に上げる(満員の部屋は ホスト 3 + ゲスト 3×3 = 12 接続になり、30 だと 2〜3 部屋で頭打ちになる。v1 でも 5 部屋 × 6 = 30 でぎりぎりだった)。nginx に `limit_conn` を掛ける場合も 60 に合わせる
- メッセージ 60 通/秒は接続ごとなので変えない。席の対応表は部屋あたり 50 まで

### 11.7 変更が要る場所

- pokonya:
  - `members/deco/hub.py`: 席の割り当て(11.3 の判定順)・人数上限と `4410`・線の無い席の即破棄・席の対応の破棄、接続ごとの版と `peer` の変換、`_switch_invite` は `host` 以外を切る、`conns_total` 60
  - `members/deco/room.py`: `redo` を席ごとの辞書に、`welcome` に `people` / `seat_key`
  - `members/deco/router.py`: auth v1 / v2、`join` 拒否の経路で理由を送る、REST の `_room_body`(今は `("host", "guest")` 固定)を席の一覧 / 人数に
  - テスト: 3 人の席・戻すの分離・人数上限で席が増えない・`closed` の理由が届く・v1 ゲストは共有席・線の無い席の即破棄・v1 宛ての `peer` 変換・席キーの再送で同じ席・招待やり直しで全席無効
  - `docs/architecture/members-api.md`: `welcome`(`people` / `seat_key`)、`peer.seat`、REST の席、close `4410`
- poko-tools edition/plus: `tools/deco-poko/collab.js`(席キー、`#seat=`、4410、表示)、MANUAL / CHANGELOG
- wp-poko / nginx: 変更なし(`limit_conn` を掛けるなら 60)

### 11.8 段階(この順番を守る)

| 段階 | 内容 |
|---|---|
| 4a | pokonya: 席の割り当てと v2(v1 も受ける)。pytest(11.7 の項目) |
| 4b | デコポコ プラス: collab.js v2。検証サーバーで 5 画面(ホスト + ゲスト 3 + 4 人目は断られる)、`#seat=` で同じ席、v1 の画面と v2 の画面の混在 |
| 4c-1 | 本番 pokonya: image 作り直し(v1 の画面はそのまま動くことを確認) |
| 4c-2 | 本番 デコポコ プラス: deploy-plus(**必ず 4c-1 のあと**)。開いている画面は読み込み直すまで v1 |

### 11.9 決定事項(2026-10-16 承認時、すべて推奨どおり)

1. **招待 1 本を共有**する。人ごとの招待は作らない
2. **ゲスト 3 人まで**(計 4 人)。席キーの対応表の上限 50 は人数ではない(つなぎ直しが多くても表が増え続けないための上限)
3. **同じ人の 2 画面は「自分の OBS 用リンク(#席キー)」で同じ席**にする。リンクを使わなければ別の人として数える
4. **特定のゲストだけ切る / その人の線だけ消す機能は作らない**(必要になったら追加)。無料版(§12)はキック(特定の人を外す)を付ける(2026-10-17)。プラス版はこのまま
5. 線を描いた人が切れてから人数に数えなくなるまでの時間は **10 分**

## 12. 無料版の一緒にデコる(WebRTC・ホスト中心・Cloudflare TURN)— 承認済み(2026-10-17)

2026-10-17 追加。§1〜§11(プラス版の WebSocket 中継方式。本番で動いている)を正本として、無料版で何を流用し何を変えるかを書く。2026-10-17 承認、実装は 12.14 の段階の順に別チケットで行う。同日 Fable レビュー(2 回)を反映。同日、ぶらんちの判断で「TURN なし」から「**Cloudflare Realtime TURN で全員 relay**」に書き直した(参加者どうしに IP を伝えないため)。

### 12.1 決まっていること(2026-10-17 ぶらんち)

| 項目 | 決定 |
|---|---|
| 公開範囲 | **無料版(main、GitHub Pages)で一緒にデコるを出す**。通常版を一緒にデコる以外の全機能で出す話(2026-10-16 ぽこ決定)とは別で、この節は一緒にデコるだけ |
| 方式 | **WebRTC DataChannel**。**ホストのブラウザが中心(スター型)**。ゲストはホストとだけつながる |
| サーバー | pokonya は **つなぎ役(シグナリング)と TURN の認証情報の発行だけ**。線は通さない・持たない・描かない |
| 中継 | **Cloudflare Realtime TURN を全員が使い、relay だけでつなぐ**(`iceTransportPolicy: "relay"`)。参加者どうしには Cloudflare の中継アドレスしか見えず、**互いの IP は伝わらない**。最初の案(TURN なし・つながらない人は諦める)は取りやめ |
| 診断 | 参加前に **TURN に届くか** をチェックする(12.6。NAT の種類は relay なら関係ない) |
| ホスト | **ブラウザ**(ぶらんちの回答) |
| 荒らし対策 | **キック(この人を外す)** と **参加の承認制** を付ける(ぶらんちの回答) |
| 規約 | **privacy / terms を更新** する(ぶらんちの回答。Cloudflare に IP が渡ることを書く) |

理由: 今の中継方式は 4 人で 12 接続、受信約 1,400 通/秒、CPU 約 27%(§11、X1C の i7-8550U 1 コアでの実測。cnh-vps では未測で、もっと重い)。無料で誰でも部屋を開けるようにすると、cnh-vps(1 コア、空き約 800Mi、Discord Bot と同じプロセス)では持たない。WebRTC なら pokonya の仕事は接続を張るときの数十通だけになり、線の中継は Cloudflare が受け持つ。

### 12.2 流用するもの・変えるもの

| §1〜§11 | 無料版(§12) |
|---|---|
| §2 全体構成(WS で pokonya が中継) | **変える**。線は DataChannel(Cloudflare TURN 経由)でホストのブラウザが中継。pokonya はシグナリングの WS と TURN の認証情報だけ(12.3) |
| §3 認証(Discord ログイン、OBS トークン、招待は SQLite) | **置き換える**。ログインなし。ホスト鍵・OBS 鍵はブラウザ、招待はサーバーのメモリだけ(12.4)。SQLite は使わない |
| §4 描画データのモデル(op、seq、undo の対象選び、1920x1080 の論理座標) | **そのまま流用**。ただし「サーバーが振る / 選ぶ」は「ホストのブラウザが振る / 選ぶ」に読み替える |
| §5 プロトコル v1、§11.4 v2、pokonya `members-api.md` で足した `s.abort` / `error` | **メッセージはそのまま流用**(DataChannel の上で同じ JSON)。`auth` は `hello` に、close コードは `closed` メッセージに置き換え、`welcome` は分割して送る(12.7) |
| §6 部屋の寿命(pokonya のメモリ、2 時間放置で破棄) | **変える**。部屋はホストの画面が開いている間だけ(12.8) |
| §7 上限(1 部屋 2MB、1 本 4000 点、60 通/秒) | **値は流用**。検査するのはホストのブラウザ。サーバー側は別の上限(12.9) |
| §11 人ごとの席(席キー、`#seat=`、ゲスト 3 人、10 分) | **席の割り当て・人数・10 分は流用**(割り当てはホストのブラウザ)。**席あたりの接続は 3 → 2**(12.10)。§11.9.4「特定のゲストだけ切る機能は作らない」は無料版では見直し、キックを付ける |
| pokonya `members/deco/room.py`(op の検証・seq・undo の対象選び・消去・満杯) | **JS に移植** してホストのブラウザで動かす(12.7)。Python 側はプラス版用にそのまま残す |
| pokonya `members/deco/hub.py`(席の割り当て・人数・`peer` の通知・メッセージ数) | 席と人数・`peer`(v2 の形だけ)・60 通/秒を **JS に移植**。接続数・認証・再検証・v1 宛ての `peer` 変換は移植しない |

### 12.3 全体構成

```text
ホスト(ぽこ)のブラウザ  https://pokkomyu.github.io/poko-tools/tools/deco-poko/
  … 部屋を開く・招待 URL を出す・参加を承認する。op ログを持ち、全員の線を検証して中継する(= 今の pokonya の Room の役)
     ▲  ▲  ▲   DataChannel(線・戻す・消去。§5 / §11.4 の JSON)
     │  │  │   どの線も Cloudflare TURN を通る(ホスト側の中継アドレス ⇔ ゲスト側の中継アドレス)
     │  │  └─ ホストの OBS(…/deco-poko/#obs=<OBS 鍵>)… 同じ PC。ホスト席で描く
     │  └──── ゲスト B のブラウザ / OBS(…/deco-poko/#join=<招待>&seat=<席キー>)
     └─────── ゲスト A のブラウザ / OBS
        ┆ 接続を張るときだけ(offer / answer / ICE 候補、TURN の認証情報)
        ▼
wss://hoshino-poko.com/api/deco/signal ── nginx ──▶ pokonya-api(新規 deco_signal/)
                                                     部屋の対応表(メモリ)・中継・TURN 認証情報の発行と失効
                                                        │ HTTPS(TURN キーは pokonya の .env だけ)
                                                        ▼
                                          rtc.live.cloudflare.com(認証情報の発行 / 失効 API)
TURN: turn.cloudflare.com(UDP 3478 / 443、TCP 3478 / 80、TLS 5349 / 443)
```

- ゲスト同士はつながらない(スター型)。relay だけなので、NAT の種類・ファイアウォール(外向きの 443 が通れば足りる)・同じ PC かどうかに関係なくつながる
- 参加者どうしに見えるのは Cloudflare の中継アドレスだけ。参加者の IP を知るのは **Cloudflare(TURN の運用に必要なメタデータとして処理)と pokonya(シグナリングの接続元)** だけ
- ホストの画面は配信中ずっと開いておく(ブラウザのタブ)。閉じると部屋が止まる(12.8)
- 無料版の部屋とプラス版(WS)の部屋は別物。互いの招待では入れない(12.12)

### 12.4 シグナリング API と認証(ログインなし)

口は 1 つ: `wss://hoshino-poko.com/api/deco/signal`(WebSocket。members の外で、`MEMBERS_ENABLED` に依存しない。専用の `DECO_SIGNAL_ENABLED` で口を閉じられる)。JSON テキスト、`v: 1`。

**鍵と招待**(すべて `crypto.getRandomValues` の 128 bit を base64url。サーバーはハッシュだけをメモリに持つ):

| 名前 | 作る人 | 持ち方 | 用途 |
|---|---|---|---|
| ホスト鍵 | ホストのブラウザ(初回) | localStorage `poko-deco-p2p-host:<?id>` | 部屋を開く。部屋 = ホスト鍵のハッシュ。サーバーに保存はしない |
| OBS 鍵 | ホストのブラウザ(初回) | 同上。「自分の OBS 用リンク」`#obs=<OBS 鍵>` | ホストの OBS がホスト席で入る(承認は要らない)。部屋を開く・閉じる・招待のやり直し・承認はできない(§10.3 と同じ考え) |
| 招待 | サーバー(部屋を開くたび) | ホストの画面にだけ全文。URL は `#join=<招待>` | ゲストが入る(ホストの承認が要る)。やり直すと即失効 |
| 席キー | ホストのブラウザ(§11.3 と同じ) | ゲストの localStorage、`&seat=` | 同じ人の 2 画面を同じ席に。承認済みの席キーで戻った人は聞き直さない |

- ホスト鍵と OBS 鍵は同じブラウザでは使い回す(OBS に貼ったリンクを毎回貼り直さなくてよい)。パネルに「OBS 用リンクを作り直す」(OBS 鍵だけ新しくする)と「鍵を全部作り直す」(ホスト鍵も新しくする。開いている部屋は閉じる)。漏れたときに使うことを MANUAL に書く
- `#` 以降は GitHub Pages にもサーバーのアクセスログにも送られない。招待と鍵は WS のメッセージでだけサーバーに渡す。ゲストのページは読み込み後に `#join` を sessionStorage に移して `history.replaceState` で消す(配信画面に映さない)。OBS は URL がソースの設定に残るので消さない
- `https://pokkomyu.github.io` は Pokkomyu の全リポジトリ(Pages)で同じ origin なので、どれかのツールに XSS があれば localStorage の鍵に届く。鍵名の prefix を固定し、ほかのツールで同じ prefix を使わない。各ツールのページに外部スクリプトを入れない(今どおり)

**秘密情報の扱い**(無料版は zip で配り、repo も public。2026-10-17 ぶらんち「鍵情報などの扱いには十分注意」):

| 情報 | 置いてよい場所 | 置いてはいけない場所 |
|---|---|---|
| Cloudflare の TURN キー ID・API トークン(**その TURN キー専用** のトークン。アカウントの API トークンではない)、使用量を読む Analytics 用トークン | pokonya の本番 `.env` / 開発用 `.env.dev` だけ | クライアントのコード・zip・Pages・poko-tools / pokonya の repo(`.env.example` は名前だけ)・docs・ログ・PR・手順書・run.sh |
| TURN の短命な認証情報(username / credential) | 受け取った画面のメモリだけ(`RTCPeerConnection` に渡す) | localStorage / sessionStorage / IndexedDB / URL / 画面表示 / console / pokonya のログ |
| ホスト鍵・OBS 鍵・席キー | その人のブラウザの localStorage、OBS のソース設定(`#obs=` / `&seat=`) | zip・Pages の既定値(初回にブラウザで作る。配るファイルに鍵を入れない)、サーバーのログ(ハッシュだけメモリに持つ) |
| 招待 | ホストの画面、ゲストに渡す URL の `#` 以降 | サーバーのログ・URL のクエリ |

- **配るファイルに入るのは、シグナリングの URL(`wss://hoshino-poko.com/api/deco/signal`)だけ**。zip の中身・Pages のソースを全部読まれても TURN キーは出てこない。ただし認証情報そのものは pokonya から取れる: **ゲスト分はホストの承認が要るが、ホスト分は部屋を開けば(非ブラウザでも)誰でも受け取れる**。だから悪用(汎用の TURN として使われる)は承認ではなく、12.9 の上限と 12.6 の実測の監視・全失効で止める
- 承認されたゲストも、部屋の間は認証情報(= 汎用の中継)を持つ。MANUAL に「知らない人を入れない」理由として書く
- `scripts/package-tool.sh` に、zip に `rtc.live.cloudflare.com`・`Bearer `・`DECO_TURN_`・`DECO_CF_` の文字列が入っていたら止める確認を足す(長い英数の塊は画像や minify した JS で誤検知するので見ない)。pokonya に pre-commit / CI に相当するものは無いので、`.env.dev` を含む `.env*` が `.gitignore` にあることを **キーを入れる前(段階 0)** に確かめる
- 漏れたとき: TURN キーをダッシュボードで消して作り直し、`.env` を差し替える(12.13 の Cloudflare 欄)
- zip(file://)では一緒にデコるを出さない(12.11)ので、zip の利用者のブラウザにホスト鍵ができることもない

**流れ**(TURN の認証情報 `ice` は 12.5。認証情報は「主体」= ホスト鍵 / OBS 鍵 / 席キー ごとに 1 つ):

```text
■ ホスト
ホスト  → {"t":"open","v":1,"app":"0.6.0","key":<ホスト鍵>,"obs":<OBS 鍵>}
       ← {"t":"opened","invite":<招待 全文 or null>,"ice":<ホスト用の認証情報>,"expires_in":43200}
          同じホスト鍵の部屋がホスト不在(12.8 の 10 分)で残っていれば、同じ招待のまま戻る(invite は null。ホストは招待の全文を localStorage に持っている)
          同じホスト鍵のホストがまだつながっていれば、古い方に closed:replaced を送って切り、新しい方に引き継ぐ(再読み込み・別の画面で開いた用)
          → ホストは接続チェック(12.6)をしてから招待 URL を表示する

■ ホストの OBS(承認は要らない。サーバーが判定する)
OBS    → {"t":"join","v":1,"app":...,"obs":<OBS 鍵>}
       ← 部屋がまだ無い・ホスト不在: {"t":"waiting"}(ホストが open したら次へ)
       ← {"t":"joined","peer":"p3","ice":<OBS 用の認証情報>}   ホストには {"t":"peer","peer":"p3","via":"obs"}

■ ゲスト(ホストの承認が要る)
ゲスト → {"t":"join","v":1,"app":"0.6.0","invite":<招待>,"seat_key"?:<席キー>}
       ← 招待が知らない・失効: closed:no_room(4404)
          部屋はあるがホスト不在: {"t":"waiting"}
       ← {"t":"pending","code":"4831"}   承認待ち。ゲストの画面に 4 桁の合言葉と「ホストの承認を待っています」を出す
ホスト ← {"t":"knock","peer":"p7","code":"4831","seat_key_hash":<先頭 8 文字 or null>,"app":"0.6.0"}
          パネルの承認待ち一覧に合言葉を並べる(ゲストは口頭や Discord で合言葉を伝える。名前欄は作らない — 配信に映る・なりすましできる)
          承認済みの席キー(ホストだけが知っている)なら、ホストが聞かずに approve する。キックした席キーなら deny する
ホスト → {"t":"approve","peer":"p7"} / {"t":"deny","peer":"p7"}   「入れる / 断る」(断ると closed:denied)。期限切れの peer への approve は無視
ゲスト ← {"t":"joined","peer":"p7","ice":<ゲスト用の認証情報>}   承認されてから初めて TURN の認証情報を渡す

■ 接続を張る(OBS とゲスト共通)
ゲスト → {"t":"signal","to":"host","data":{"sdp":{"type":"offer",...}}} → ホストへ {"t":"signal","from":"p7","data":...}
ホスト → {"t":"signal","to":"p7","data":{"sdp":{"type":"answer",...}}|{"cand":{...}}}   trickle ICE。offer は参加する側が出す
ホスト → {"t":"connected","peer":"p7"}   DataChannel が開いた(サーバーは参加待ちの数から外す)

■ 部屋の操作(ホストだけ)
ホスト → {"t":"kick","peer":"p7"}   その主体の認証情報を失効させる(キー・招待のやり直し・満員・キック)。相手には DataChannel で closed を送って pc.close() 済み
ホスト → {"t":"reinvite"} ← {"t":"invited","invite":<新しい招待>}   古い招待は即失効、承認待ち・待機中のゲストに closed:invite_revoked
ホスト → {"t":"extend"}   部屋の最長時間を 1 回だけ 12 時間延ばす(認証情報は配り直さない。12.5)
ホスト → {"t":"close"}   部屋を閉じる。全員に closed:room_closed、部屋の認証情報をすべて失効
ホスト ← {"t":"left","peer":"p7","reason":"join_timeout"|"gone"}   承認待ち・参加待ちが時間切れ、またはシグナリングが切れた
両方   → {"t":"ping"} ← {"t":"pong"}   25 秒ごと(nginx のタイムアウト対策)
```

- **シグナリングは全員が部屋の間ずっと開いたまま** にする(ゲストも OBS も)。キック・失効・招待のやり直し・部屋を閉じるの通知と、つなぎ直しの対応付けをシグナリングで一本化するため。ping 25 秒なので負荷は無視できる(上限は 12.9)
- **ゲストは `to:"host"` にしか送れない**。ホストは自分の部屋の承認済みの `peer` にだけ送れる。それ以外の宛先は捨てる(開いた中継にしない)。`signal.data` は 8KB まで・`sdp` か `cand` のどちらか 1 つだけ、をサーバーで確かめる
- **IP を載せない**: pokonya は `signal` を中継する前に、`cand.candidate` の `typ relay` 以外を捨て、relay 候補の `raddr … rport …`(関連アドレス = 本人の外向き IP が入りうる)を `0.0.0.0 0` に書き換え、`sdp` の中の `a=candidate` 行も同じ扱いにする。Chrome は relay だけのとき関連アドレスを伏せるが、ほかのブラウザや手を加えたクライアントでも相手の IP を守れるよう、サーバーで必ずやる。ホストも受け取ったものを同じ基準で確かめる
- **認証情報は主体ごと**: pokonya は username と `customIdentifier`(部屋のハッシュの先頭)を「部屋 + 主体(ホスト鍵 / OBS 鍵 / 席キーのハッシュ)」に結びつけて持つ。同じ主体の再 `join`(再読み込み・OBS の読み込み直し)には、失効していない限り同じ `ice` を返す。席キーの無いゲスト(初回)は、ホストが DataChannel の `welcome` で席キーを渡した後、ホストが `{"t":"seat","peer":"p7","seat_key_hash":...}` でサーバーに対応を知らせる
- ホストは受け取った `signal.data` の形を確かめてから使う(`sdp.type` は参加する側からは `offer` だけ、`cand` は RTCIceCandidateInit の形)。`setRemoteDescription` / `addIceCandidate` は try/catch で囲み、失敗はその相手だけ捨てる
- **版の不一致**: Pages を更新した直後はホストとゲストで JS の版が混ざる。`app`(tool.json の版)の **メジャー.マイナー** が違えば、ゲストに「ページを読み込み直してください」を出してつながない(ホストは `knock.app` で、ゲストは DataChannel の `welcome.app` で判定)
- **close コード**(§3.3 / members-api.md と同じ意味で使う。`replaced`・`denied`・`kicked`・`4408` は無料版だけ):

| コード | 理由(先に送る `closed.reason`) |
|---|---|
| `4401` | 最初のメッセージが 5 秒以内に来ない・形が違う |
| `4403` | Origin・Host 違い(理由なし)/ `replaced`(別の画面がホストになった)/ `invite_revoked` / `denied`(承認されなかった)/ `kicked` |
| `4404` | `no_room`(招待が知らない・失効)/ `room_closed` / `expired`(最長時間) |
| `4408` | `join_timeout`(承認待ち・参加待ちの時間切れ。12.9) |
| `4429` | `busy`(部屋数・接続数・IP ごとの上限、TURN の予算・緊急停止)/ `rate`(通数) |

  4409・4410 は使わない(ホスト接続の取り合いは `replaced` で置き換え、人数は DataChannel の上でホストが断る。12.7)
- **Origin と Host**: Origin は `https://pokkomyu.github.io` と `https://hoshino-poko.com` だけ(開発用の `http://localhost:*` は env で dev のときだけ)。`null` と `file://`(file:// のページの WebSocket は `Origin: file://` を送る)は受けない(12.11)。Host / `X-Forwarded-Host` が hoshino-poko.com であることも、今の `_handshake_close` と同じ考えで確かめる。Origin は非ブラウザなら偽れるので、荒らし・課金対策の本体は 12.9 の上限と 12.6 の予算
- `replaced` で切られた画面には「別の画面で部屋が開かれました」と出す(気づけるように)。ホスト鍵を知る人なら誰でもホストを奪えるが、鍵は WSS と localStorage にしか無い(漏れるのは XSS か PC の共用)。同じ IP からだけに絞ると、Wi-Fi ↔ モバイルの切り替えで正規のホストが戻れなくなるので絞らない

### 12.5 Cloudflare Realtime TURN の使い方

**認証情報の発行**(pokonya だけが行う。TURN キーはブラウザに渡さない):

```text
POST https://rtc.live.cloudflare.com/v1/turn/keys/<TURN キー ID>/credentials/generate-ice-servers
Authorization: Bearer <TURN キーの API トークン>
{"ttl": <秒>}
→ 201 {"iceServers": [{"urls": ["stun:stun.cloudflare.com:3478"]},
                       {"urls": ["turn:turn.cloudflare.com:3478?transport=udp", ... "turns:turn.cloudflare.com:443?transport=tcp"],
                        "username": "...", "credential": "..."}]}
失効: POST .../credentials/<username>/revoke → 204
```

- TURN キー ID と API トークンは pokonya の `.env`(`DECO_TURN_KEY_ID` / `DECO_TURN_KEY_API_TOKEN`)。使用量を読む Analytics 用のトークンは別に(`DECO_CF_ACCOUNT_ID` / `DECO_CF_ANALYTICS_TOKEN`、Account Analytics の読み取りだけ)。ぶらんちが Cloudflare のダッシュボードで作って入れる(`.env.example` には名前だけ)。ログ・応答・監査に出さない
- **主体(ホスト鍵 / OBS 鍵 / 席キー)ごとに 1 つ** 発行する(`opened` / `joined` のとき)。`customIdentifier` に部屋のハッシュの先頭を入れ、使用量を部屋ごとに見られるようにする(暴走した部屋だけ止められる)
- **TTL は 24.5 時間**(部屋の最長 12 時間 + 延長 1 回 12 時間 + 余裕 30 分。Cloudflare の上限 48 時間の内)。認証情報は途中で配り直さない: 差し替えるには `restartIce`(offer / answer のやり直し)が要り、TTL が切れると Cloudflare はその allocation を切る(FAQ)。だから延長は 1 回まで、`extend` はサーバーの期限を延ばすだけ。長い TTL の悪用は 12.6 の実測の監視で止める
- **失効させるとき**: キック・断る・招待のやり直し(古い招待で入った人の分)・部屋を閉じる・部屋の破棄(ホスト不在 10 分、最長時間)。失効の API 呼び出しは非同期で、失敗したら 3 回まで再試行し、それでも駄目なら TTL 切れに任せる(ログに件数だけ)。失効 API が張っている最中の allocation をすぐ止めるかは文書に無い(確認点 7、段階 a で確かめる)。キックの効き目は「ホストが `pc.close()` する」で足りていて、失効は「その認証情報で別の中継をさせない」ためのもの
- **緊急停止**: pokonya に「発行済みの認証情報を全部失効 + 新しい発行を止める」運用コマンドを用意する(`stats` と同じ並び)。さらに、ダッシュボードで TURN キーを消せばそのキーで出した認証情報が全部無効になるか(確認点 8)。効くならそれが最後の止め方
- クライアントは `iceServers` のうち **`turn:` / `turns:` のホストが `turn.cloudflare.com` のものだけ** 使う。`stun:` は relay だけなら要らないので捨てる。`:53` の URL も捨てる(ブラウザが塞ぐことが知られている、と Cloudflare の文書にある。今の応答には無い)
- `RTCPeerConnection({ iceServers, iceTransportPolicy: "relay" })`。host / srflx の候補は作られないので、SDP にも ICE 候補にもローカル IP は載らない。relay 候補の関連アドレス(`raddr`)には本人の外向き IP が入りうるので、12.4 のとおり pokonya が中継前に伏せる
- 発行 API の呼び出しはイベントループを止めないよう `httpx.AsyncClient`(既存の依存)で、タイムアウト 5 秒。失敗したら `closed:busy`(「混んでいます」)

**無料枠と課金(2026-10-17 時点の Cloudflare の文書)**:

| 項目 | 内容 |
|---|---|
| 料金 | Cloudflare の edge から TURN クライアントへ送ったデータ(egress)に **$0.05/GB**。TURN のヘッダなどの上乗せも含めて数える。クライアントから Cloudflare への ingress は無料 |
| 無料枠 | **毎月 1,000 GB**。Realtime SFU と共有(SFU は使わないので全部 TURN に使える) |
| SFU と併用 | SFU と一緒に使うと TURN は無料、とあるが、この設計は SFU を使わない |
| 上限 | 1 allocation あたり 50〜100 Mbps・5〜10 kpps を続けて超えるとパケットを落とすことがある。認証情報の発行は 500 回/秒から。TTL は 48 時間まで。IPv6 の中継アドレスは出ない |
| STUN | `stun.cloudflare.com` は無料・無制限(relay だけなら使わない) |
| 使用量 | ダッシュボードの分析に 30 秒以内に出る。GraphQL の `callsTurnUsageAdaptiveGroups`(egressBytes など。keyId / customIdentifier / username ごと)でも取れる |

**使用量の見積もり**(線 1 本の送信 `s.pts` は 30ms ごと・約 90B、SCTP・DTLS・UDP/IP・TURN の上乗せで 1 通約 200B → 描いている 1 人あたり約 6.5KB/s。数えるのは各画面が受け取る量。自分の線の確定の返事 `op` は少ないので数えていない):

| 場面 | 受け取る画面 | 受け取る量 | 1 時間 |
|---|---|---|---|
| 4 人がずっと描き続ける(最悪) | ホスト 3 人分 + ホストの OBS 4 + ゲスト 3 × 3 + ゲストの OBS 3 × 4 = 28 人分 | 約 180KB/s | 約 0.65GB |
| 2 人で配信 1 回(描くのは 2 割の時間) | 4 画面 × 1 人分 × 0.2 | 約 5KB/s | 約 0.02GB |
| `welcome`(参加・OBS の読み込み直し・タブの復帰のたび) | 最大 2MB × 回数 | — | 1 配信で数十回でも 0.1GB 程度 |

1,000 GB は「4 人がずっと描き続ける部屋」で約 1,500 時間/月(毎日 50 時間)に当たる。普通の使い方では無料枠に届かない。危ないのは **認証情報の悪用**(発行された認証情報で、一緒にデコると無関係な通信を中継される。1 本 50〜100 Mbps 流せる)で、12.6 の実測の監視と 12.9 の上限で止める。

**課金と規約の確認点**(2026-10-17 に Cloudflare の公開文書で調べた結果。「文書で確定」は調べて決着、「段階 0 / a で確認」は文書に書かれていない):

| # | 確認点 | 文書で分かったこと | 残る作業 |
|---|---|---|---|
| 1 | 支払い方法の登録が要るか | 製品ページは「クレジットカード不要で始められる」。セルフサーブの支払いはクレジットカード(TURN FAQ)。**カード無しで無料枠を超えたときに止まるのか請求されるのかは書かれていない** | 段階 0: ダッシュボードで TURN キーを作るときに支払い方法を求められるか見る。カード無しで作れて、超えたら止まるなら、それが一番安全な上限になる |
| 2 | 使いすぎの上限を掛けられるか | **文書で確定: 掛けられない**。Budget alerts(Manage Account > Billing > Billable Usage)はメールで知らせるだけで、止めはしない。使用量の集計は日次なので通知は翌日。Pay-as-you-go のアカウントだけで、既定で $10 の通知が入る | 段階 0: 通知を $1 程度に下げる。止めるのは pokonya 側の監視(12.6)だけが頼り、を前提にする |
| 3 | 無料枠 1,000 GB | **文書で確定**: 毎月 1,000 GB 無料、SFU と共有、請求は SFU と TURN で 1 行 | 段階 0: ダッシュボードの表示を見る(念のため) |
| 4 | 両方が relay のときの数え方 | 課金は「Cloudflare の edge から TURN クライアントへ送ったデータ」、ingress は無料。FAQ の図も client 向きだけが課金。**TURN どうしの中継について明記は無い** | 段階 a: 10MB 送って分析の egress が 10MB 強(期待)か 20MB 強かを見る |
| 5 | 使用量を API で取れるか | **文書で確定: 取れる**。GraphQL `https://api.cloudflare.com/client/v4/graphql` の `callsTurnUsageAdaptiveGroups`(`egressBytes` / `ingressBytes` / `concurrentConnections`)、時間は `datetimeMinute` / `datetimeFiveMinutes` など、`keyId` / `customIdentifier` / `username` で絞れる。トークンの権限は **Account Analytics**。分析には 30 秒以内に出る(FAQ) | 段階 0: Account Analytics だけのトークンを作る |
| 6 | 規約で使ってよいか | Service-Specific Terms(2026-09-28 版)の Realtime の節: 許される使い方は **「自分の Internet Properties で video call の機能を提供する」**。禁止は電話網につなぐ通信サービス、違法・有害な内容。Cloudflare は同時通話数を一時的に制限できる。**お絵かきのデータだけを中継する使い方は文言上「video call」に当たらず、グレー**(FAQ ではロボットの遠隔操作など映像以外も「合う使い方」に挙げている)。また github.io の Pages が「自分の Internet Properties」に当たるかも明記は無い | 未決 13 |
| 7 | 失効 API の効き目 | 失効 API(`POST …/credentials/<username>/revoke` → 204)はある。**張っている最中の allocation を止めるかは書かれていない**。TTL が途中で切れた場合は「課金と記録をすぐ止め、少し後に切断する」と FAQ にある | 段階 a: allocation を張ったまま失効させ、切れるか・分析の egress が止まるかを見る |
| 8 | TURN キーを消すと認証情報が全部無効になるか | キーの削除 API(`DELETE /accounts/{account_id}/calls/turn_keys/{key_id}`、Calls Write 権限)はある。**張っている allocation への効き目は書かれていない** | 段階 a: 開発用のキーで確かめる(本番のキーでは試さない) |
| 9 | TTL 24.5 時間 | **文書で確定**: 認証情報の期限は 48 時間先まで設定できる。allocation の長さに上限は無いが、有効な認証情報で更新し続ける必要があり、48 時間を超えるなら認証情報の更新が要る | 段階 a: `restartIce` なしで 12 時間以上つながり続けるか(長時間試験) |
| 10 | `customIdentifier` の付け方 | GraphQL の dimension にはあるが、**認証情報の発行 API の文書に付け方が載っていない**(本文は `ttl` だけ) | 付けられなければ、pokonya が持つ「username → 部屋」の対応で GraphQL を `username` で絞る(12.6 の部屋ごとの停止はこれで足りる) |

そのほか文書で分かったこと: 認証情報の発行は 500 回/秒から(上限の定めは無い)。中継アドレスは IPv4 だけ。`turn.cloudflare.com` の IP は変わることがある(許可リストに IP を書く運用はしない)。WebRTC で使う場合、中継される中身は DTLS で暗号化されていて Cloudflare は読めず、扱うのはクライアントの IP・ポート・時間などのメタデータだけ(FAQ)。privacy に書くときの根拠にする。

### 12.6 参加前の接続チェックと予算

**接続チェック**(ホストは部屋を開いた直後・招待 URL を出す前、ゲストは承認後の参加の前に自動で。最大 8 秒):

```js
const pc = new RTCPeerConnection({ iceServers: ice, iceTransportPolicy: 'relay' });
pc.createDataChannel('probe');
pc.onicecandidate = (e) => { /* relay の候補が来たか。経路(udp / tcp / tls)は candidate.relayProtocol、無ければ getStats() の local-candidate.relayProtocol、それも無ければ「不明」(○ 扱い) */ };
await pc.setLocalDescription(await pc.createOffer());
// relay 候補が 1 つ来たら OK で打ち切る。icegatheringstatechange が complete か 8 秒で打ち切り、pc.close()
```

- 認証情報が要るので、チェックはシグナリングで `ice` を受け取ってから行う(ゲストは承認された後)。チェックだけのために認証情報を配らない
- relay の候補が UDP で取れれば ◎、TCP / TLS(443)だけなら ○(つながるが少し遅れることがある)、何も取れなければ ×(会社・学校のネットワークなどで外向きの通信が絞られている)
- relay だけなので、NAT の種類・同じ PC・ファイアウォールの受信設定・VPN は判定に関係ない。2 つの STUN で対称 NAT を見る判定は **やめる**
- DataChannel が 15 秒で開かなければ「つながりませんでした」と出し、ヒント(「VPN・セキュリティソフトを切って試す」「別の回線で試す」)を添える

**画面の出し方**(パネルの中。IP やポートは出さない):

- 自分の結果は「回線: 良好(UDP)/ ふつう(443 経由)/ つながりません」の 3 段階と、× のときのヒント。「もう一度調べる」ボタン
- ホストにはパネルの参加者一覧に各ゲストの結果を出す(ゲストが DataChannel の `hello` で送る)
- OBS(`window.obsstudio` あり)では結果を出さず、つながらないときだけ小さく「つながっていません」(配信に映るため)

**予算と悪用の監視**(pokonya の `deco_signal/`。2 つは別の仕組み):

| 仕組み | 目的 | 判定 | 超えたら |
|---|---|---|---|
| 悪用の検知 | 認証情報を汎用の中継に使われるのを止める | **実測**: 1 分ごとに GraphQL で直近 5 分の egress を取る。正規の最悪(4 人がずっと描く部屋 1 つ = 約 180KB/s)の 10 倍(約 1.8MB/s ≈ 5 分で 540MB)を超えたら | `customIdentifier` で多い部屋が分かればその部屋だけ、分からなければ **全部** の認証情報を失効 + 新しい発行を止める + ぶらんちに Discord で通知。再開は運用コマンドで |
| 月の総量 | 正規の使い方で無料枠を超えない | **実測**: 当月の egress 合計 | 600 GB で新しい部屋を止める(`closed:busy`、「今月は混んでいます」。開いている部屋はそのまま)、800 GB で通知。値は env |

- GraphQL が取れないとき(API の障害)は、発行した認証情報ごとに「発行からの時間 × 1 画面 20KB/s」の **見積もり** で月の総量だけ判定する(保険。悪用の検知はできないので、30 分取れなければ新しい発行を止めて通知)
- 月の積み上げは `data/` の小さな JSON に 1 分ごとに書く(SQLite は使わない方針。再起動で失わないため)
- 1 部屋に同時に出す認証情報は主体の数: ホスト 1 + OBS 鍵 1 + 席キー 3(ゲスト 3 人。同じ人のブラウザと OBS は同じ席キーなので同じ認証情報)= 5 まで。承認前は出さない

### 12.7 ホストの中継

今の pokonya の Room の役をホストのブラウザが行う。

- `members/deco/room.py` を JS に移植する(`stroke_header` の検証、`tmp` の形、seq の採番、`_commit` の 4000 点・満杯、`_clear` のゲストは mine に強制・満杯時の全部消すで reset、`undo_target` の消去をまたがない、`redo` の席ごと)。hub.py からは席の割り当て(§11.3)・人数・v2 の `peer` の通知・60 通/秒だけ。room.py の pytest の主な場合を JS のテストに移して同じ答えになることを確かめる
  - **移植しないもの**: `Budget`(全部屋の合計 10MB)と `FULL_RELEASE_BYTES`(ほかの部屋が空いたら戻す)— 1 部屋しか無いので 1 部屋 2MB だけ見る。監査、v1 宛ての `peer` 変換、接続数・認証・再検証
  - 席キーはホストのブラウザでは平文で持ってよい(サーバーと違い、ハッシュにして守る相手がいない)
- ホスト自身の線も同じ Room を通す(自分宛ての「接続」として扱う)。手元の表示は今どおり返事を待たない
- DataChannel は 1 本(`deco`、順序あり・再送あり。既定のまま)。中身は §5 / §11.4 の JSON を変えずに使う。ゲストの最初のメッセージは `auth` の代わりに `{"t":"hello","v":3,"app":"0.6.0","seat_key"?,"check":"udp"|"tls"}`(`v: 3` = DataChannel 版)。OBS 鍵で入った相手はホスト席
- **断るとき**(人数がいっぱい・席の接続数・版違い・キック): DataChannel には close コードが無いので、`{"t":"closed","reason":"people_full"|"seat_full"|"version"|"kicked"}` を送ってから `pc.close()` し、サーバーには `kick` で失効を頼む(断る理由が人数・席・版なら失効はしない。席が空けば同じ認証情報で入り直せる)。ゲストは `people_full` / `seat_full` なら 30 秒後に参加し直す(§11.5 と同じ表示)
- **キック(この人を外す)**: パネルの参加者一覧の各席に「外す」。その席の全画面(ブラウザと OBS)を切り、その席キーの認証情報を失効する。外した席の席キーは部屋がある間は拒否する(再読み込みで戻ってこないように)。席キーを消して入り直す人は、承認制で断るか招待のやり直しで止める。外した人の線は残す(消したければホストの「全部消す」)
- **つなぎ直しで古い接続が席を食わないように**: 同じ席キー(ホスト席は OBS 鍵)の `hello` が来たら、その席の接続のうち `connectionState` が `disconnected` / `failed` のものを先に閉じてから数える
- `welcome` は最大 2MB になり、DataChannel の 1 メッセージ(Chrome は 256KiB)を超えるので、`welcome`(op 抜き)→ `ops`(64KB ごと)→ `welcome.end` に分けて送る(64KB なら Firefox / Safari 混在でも安全)。ゲストは `welcome.end` まで描けないようにする
- 遅い相手: `bufferedAmount` が 4MB を超えたらその相手を切る(今の `MAX_QUEUE_BYTES` と同じ)。`welcome` を分けて送っている途中も同じ判定を掛ける(`send()` は内部の上限を超えると例外を投げるので try/catch で囲み、例外ならその相手を切る)
- **切れたとき**: `connectionstatechange` が `disconnected` になって 10 秒戻らなければ `failed` と同じ扱いにする。ゲストは PC を捨てて、開いたままのシグナリングで参加し直す(席キーで同じ席に戻る。承認済みなら聞き直さない。認証情報は同じものを使う)。ホストはその PC を捨てる。`restartIce` は使わない(スマホの Wi-Fi ↔ モバイルの切り替えもこの経路)
- 中継はメッセージを受けたその場で行い、タイマーに頼らない(タブが裏に回ると Chrome はタイマーを 1 秒単位に間引く。開いた WebRTC 接続があるページは 1 分単位の強い間引きの対象外なので、25 秒の `ping` は問題ない)
- **本当の危険はタブの破棄とスリープ**: Chrome の省メモリ(Memory Saver)が裏のタブを捨てる、PC がスリープする。対策: ホストの画面は別のウィンドウで開くよう案内、`chrome://settings/performance` で `pokkomyu.github.io` を「常にアクティブ」に入れる案内、`document.wasDiscarded` なら「部屋が止まっていました」と出す(12.8 の復元に進む)。段階 a で Memory Saver を入れたまま 30 分以上試す

### 12.8 部屋の寿命とホストが離れたとき

```text
ホストが「一緒にデコる」→ 部屋を開く(シグナリング open、認証情報)→ 接続チェック → 招待 URL を表示・コピー
ホストの OBS(#obs=)は待機中 → 部屋が開くと自動でつながる(§6 の「OBS は自動で部屋を探して入る」と同じ)
ゲストが招待 URL を開く → 承認待ち → ホストが「入れる」→ 接続チェック → 参加 → welcome で全体を受け取る
ホストが「部屋を閉じる」→ 全員に closed、招待と認証情報を失効
```

- **ホストが離れたとき**(タブを閉じた・再読み込み・回線が切れた・タブが破棄された): DataChannel が切れた全員の線はそこで止まる。ゲストの画面は **絵をそのまま残し**「ホストが抜けました。戻るまで待っています」と出し、描けないようにする。シグナリングは部屋の対応(招待)と発行済みの認証情報を **10 分だけ残す**。この間にゲスト・OBS が `join` すると `waiting` を返す
  - ホストが同じブラウザで 10 分以内に戻れば(同じホスト鍵で `open`)、**同じ招待のまま** 部屋が戻り、待っていたゲストと OBS は(承認済みの席キーなら聞き直さずに)つなぎ直して `welcome` を受け取る。招待の全文はホストの localStorage(ホスト鍵と同じ扱い)に持っているので、戻ったホストも招待 URL を表示・コピーできる(招待のやり直し・部屋を閉じるで消す)
  - **ホストは部屋の状態を描くたびに IndexedDB(使えなければ sessionStorage)に保存** し、戻ったときに読み込む。保存するのは `ops`、`next_seq`、`undone`、`redo`(席ごと)、`seat_keys`(席キー → 席)、承認済み・キック済みの席キー、`next_guest`、`away`、`next_conn`、招待のハッシュ(どの招待の部屋か)。これが無いと、戻ったあとゲストの席キーが「知らない」扱いになり全員が新しい席(g4 …)になって、自分の線を戻す・消すができなくなる。招待のやり直し(`seat_keys`・承認・`away` を消す。§11.3 と同じ)と部屋を閉じる(全部消す)で保存も消す
  - 読み込めなかったら空の部屋で始める(§5 の「再起動で絵は消える」と同じ扱い)
  - 10 分を過ぎたら招待と認証情報は失効し、ゲストには「部屋が終わりました」。ゲストの手元の絵は 1 人用には持ち込まない(§4 と同じ)
- **ほかの人をホストにする(ホストの引き継ぎ)はしない**。op ログはゲストの手元にもあるが、誰が正しいかの調停が要り、複雑さに見合わない
- 部屋を開いている間、ホストのタブを閉じようとしたら `beforeunload` で確認を出す
- 部屋は最長 12 時間。残り 10 分でホストに「あと 10 分で部屋が終わります」と出し、「延長」(同じ招待のまま 12 時間延ばす。`extend`。**1 回まで**。認証情報の TTL 24.5 時間に収めるため。12.5)を押せるようにする(配信中に突然切れないように)

### 12.9 荒らし・負荷対策(シグナリング)

pokonya は線を通さないので、守るのは「部屋の数」「接続の数」「シグナリングの通数」と「TURN の認証情報」。

| 項目 | 上限 | 超えたら |
|---|---|---|
| 同時に開いている部屋(ホスト不在の 10 分を含む) | 50 | `4429 busy`(「混んでいます」) |
| 1 つの IP が開ける部屋 | 5 | `4429 busy` |
| 同時接続(全体、認証前を含む。シグナリングは全員開いたままなので 1 部屋最大 9 本) | 500 | `4429 busy`。nginx でも `limit_conn` |
| 1 つの IP の同時接続 | 30(IPv6 は /64 で数える) | `4429 busy` |
| 1 つの IP の新しい接続 | 30 回 / 分 | `4429 busy`。nginx の `limit_req` でも |
| 1 つの IP への認証情報の発行 | 20 回 / 時 | `4429 busy` |
| 1 部屋の承認待ち + 参加待ち | 8 | 新しい `join` を `4429 busy` |
| 承認待ち・参加待ちの時間 | `pending` から **5 分**(配信中のホストがすぐ押せないため。認証情報は未発行なので費用はかからない)、`joined` から 60 秒 | `4408 join_timeout` で切り、ホストに `left`。`joined` 後なら認証情報も失効 |
| 最初のメッセージまで | 5 秒 | `4401` |
| 1 メッセージ | 16KB(SDP は数 KB) | 切断(`1009`) |
| メッセージ数 | 1 接続 20 通/秒、1 つの相手との `signal` は 200 通まで | 超えた分は捨て、続けば `4429 rate` |
| 部屋の寿命 | ホスト接続中 + 離れて 10 分、最長 12 時間(延長 1 回で 24 時間) | 破棄、認証情報を失効 |
| 1 部屋の認証情報 | 主体 5(ホスト・OBS 鍵・席キー 3) | 発行しない |
| TURN の悪用の検知 | 直近 5 分の egress 約 540MB(実測、12.6) | 全失効 + 新しい発行を止める + 通知 |
| TURN の月の総量 | 実測 600 GB(12.6) | 新しい部屋を `4429 busy` |

- IP: hoshino-poko.com は Cloudflare などを通さず cnh-vps の nginx に直接届く(2026-10-17 確認: `Server: nginx`、A レコードは cnh-vps)。nginx が `$remote_addr` を `X-Real-IP` に入れ、pokonya はそれだけを見る(pokonya は nginx の内側からしか来ない)。前段に CDN を入れるときは `real_ip_header` の設定が要る(入れないと全員が同じ IP になる)
- 1 IP の上限は、モバイル回線の CGNAT や学校・会社の共有 IP で正規の人を弾かないよう緩めにして、全体の上限(部屋 50・接続 300)と予算で守る
- IP は数えるためだけにメモリに持ち、ログに出さない
- 待機中の OBS 鍵・招待の `waiting` / `pending` は接続に結びつけて持ち、切断したらすぐ消す
- メモリ: 部屋 1 つは数百バイト(ハッシュ 3 つ、接続の表、認証情報の username)。上限いっぱいでも 1MB 未満。CPU は接続を張るときの数十通と Cloudflare API の呼び出しだけ
- 監査・ログ: 部屋を開いた・閉じた・参加・承認・キック・認証情報の発行と失効の数を件数だけ。鍵・招待・SDP・ICE 候補・IP・TURN の username / credential は残さない(SQLite の `audit_log` は uid 必須なので使わない。logger だけ)。部屋数・接続数・待機数・上限で弾いた件数・今月の見積もり使用量は `stats()` で見られるようにし(今の `hub.stats()` と同じ)、段階 d の確認項目にする
- 招待が漏れて知らない人が来たとき: 承認制で「断る」、入れてしまったら「外す」(キック)、まとめて止めるなら「招待をやり直す」
- 荒らしの描画はホストが §7 の上限で止める(60 通/秒、1 本 4000 点、1 部屋 2MB)。ホストの「全部消す」は全員の線(§10.2 と同じ)

### 12.10 OBS ブラウザソースが参加者になるとき

- **OBS は 1 つの参加者**(1 本の PeerConnection。認証情報は主体ごとなので、ホストの OBS は OBS 鍵の分、ゲストの OBS はその人の席キーの分 = ブラウザと同じもの)。席は「ホストの OBS = `#obs=` でホスト席(承認は要らない)」「ゲストの OBS = `#join=…&seat=` でその人の席(承認済みの席キーなので聞き直さない)」(§11 の「自分の OBS 用リンク」をそのまま)
- **席あたりの接続は 2**(PeerConnection の本数。ブラウザ + OBS で足りる。§11 の 3 から下げてホストの負荷と認証情報の数を減らす)。**ホストの画面そのものは数えない**ので、ホスト席はホストの画面 + OBS など 2 本まで。ホストが持つ PeerConnection は最大 2 + ゲスト 3 人 × 2 = 8 本
- **同じ PC のホストのブラウザとホストの OBS** も Cloudflare を経由してつながる(relay だけなので、mDNS・ファイアウォールの受信設定・ヘアピン NAT は関係ない)。遅れは Cloudflare の最寄りの拠点との往復ぶん(国内なら数十 ms)。段階 a でぽこの PC で遅れが気にならないか確かめる
- OBS の CEF は OBS 31 以降が Chromium 127 系、30 は 103 系(要確認)。どちらも `RTCPeerConnection` と DataChannel、TURN(UDP / TCP / TLS)を持つ。無ければ一緒にデコるは出さない
- 「シーンがアクティブになったときにブラウザの表示を更新」「表示されていないときにソースをシャットダウン」で OBS が読み込み直すと、つなぎ直して `welcome` を受け取る(今の WS 方式と同じ動き。認証情報は部屋の間は使い回す)
- OBS 鍵で入った画面はホスト席なので「全部消す(全員の線)」ができる(§10.3 と同じ。ぽこは OBS の対話で描くため)。OBS 鍵はシーンコレクションの書き出しなどで漏れやすいので、漏れたら「OBS 用リンクを作り直す」と MANUAL に書く

### 12.11 HTML 版(BOOTH zip、file://)の扱い

推奨: **file:// では一緒にデコるを出さない**。パネルには「一緒にデコるは Web 版で使えます」と Pages の URL だけ出す(§8 の「BOOTH の zip / ローカルファイルでは出さない」を続ける。2026-10-15 の「単体版では考えない」とも同じ)。

- file:// のページの WebSocket は `Origin: file://`(fetch では `null`)を送り、どこかのページの sandbox iframe などと区別できない。受けると Origin の確認が意味を失う(TURN の認証情報を配る口でもあるので、なおさら受けない)
- OBS の「ローカルファイル」は全部が同じ origin で localStorage を共有する(`?id=` で分けている問題)。ホスト鍵・席キーが混ざる
- 技術的には file:// でも WebRTC は動くので、要望があれば「参加だけ」(招待を貼って入る)を後から足せる(12.15 未決「file://(zip)での扱い」)

### 12.12 プラス版の WS 方式との関係

推奨: **当面は共存**。置き換えない。

| | プラス版(hoshino-poko.com `/tools/plus/`) | 無料版(Pages) |
|---|---|---|
| 方式 | §1〜§11 の WS 中継(今のまま) | §12 の WebRTC(Cloudflare TURN で relay) |
| 中継するもの | pokonya(cnh-vps) | Cloudflare(pokonya は接続を張るときだけ) |
| 参加者どうしの IP | 伝わらない | 伝わらない |
| ログイン | ホストは Discord(サブスク / メンバー / VIP) | なし(ゲストはホストの承認制) |
| 部屋 | pokonya のメモリ(ホストが離れても残る) | ホストのブラウザ |
| 招待 URL | `hoshino-poko.com/tools/plus/guest/<招待>/deco-poko/` | `pokkomyu.github.io/poko-tools/tools/deco-poko/#join=<招待>` |

- **2 つの部屋は行き来できない**(プラス版の部屋に無料版のページから入ることも、その逆もできない)。MANUAL と案内ページに書く
- コードの持ち方: op ログ・席・検証(room.py の JS 移植)と DataChannel の通信は **main**(無料版)に置く。プラス版は main の merge で受け取り、hoshino-poko.com の `/tools/plus/` では今の WS を使い、それ以外では WebRTC を使う(`collab.js` の通信部分を「WS」と「WebRTC」に分ける)
- 将来の選択肢(今回はやらない): プラス版も WebRTC + Cloudflare TURN に移す(pokonya の中継の負荷が無くなる。プラス版の特典は「ホストが離れても部屋が残る」などに寄せる)。無料版で TURN の使用量と安定を見てから決める
- pokonya: `members/deco/` はプラス版用にそのまま残す。シグナリングは別の `deco_signal/`(members の認証・SQLite に触らない)

### 12.13 変更が要る場所

- pokonya: `deco_signal/`(新規。WS `/api/deco/signal`、部屋の対応表、承認、Cloudflare TURN の認証情報の発行と失効(`httpx.AsyncClient`)、主体ごとの対応表、`signal` の関連アドレスを伏せる、GraphQL の監視(悪用の検知・月の総量)と通知、全失効の運用コマンド、上限、`X-Real-IP`、`stats()`、`DECO_SIGNAL_ENABLED`)。`.env.example` に `DECO_TURN_KEY_ID` / `DECO_TURN_KEY_API_TOKEN` / `DECO_CF_ACCOUNT_ID` / `DECO_CF_ANALYTICS_TOKEN` / 閾値(名前だけ)。pytest(Origin / Host、5 秒、宛先の制限と `signal.data` の形、`via` の付与、承認前は認証情報を出さない、OBS 鍵は承認なし、同じ主体の再 `join` に同じ認証情報、キック・断る・やり直し・閉じるで失効を呼ぶ(Cloudflare API はモック)、`raddr` を伏せる、`replaced`、10 分の猶予と `waiting`、承認待ち 5 分・参加待ち 60 秒(4408)、IP ごとの上限、悪用の閾値で全失効、月の総量で新しい部屋を断る、12 時間と延長 1 回)。`docs/architecture/deco-signal.md`(新規)
- wp-poko: `deploy/prod/nginx/` に `location = /api/deco/signal`(Upgrade、`proxy_set_header X-Real-IP $remote_addr`、`X-Forwarded-Host`、`proxy_read_timeout`、`limit_conn` / `limit_req`)。`limit_conn_zone` / `limit_req_zone` は http コンテキストでしか書けないので、include する location のファイルではなく `conf.d/` 側に置く。`/tools/privacy/`・`/tools/terms/` の追記(Cloudflare に IP アドレスが送られること、参加者どうしには伝わらないこと、ホストの承認)、`/tools/deco-poko/` の案内ページに一緒にデコるの説明
- poko-tools main: `tools/deco-poko/` に room の JS 移植、WebRTC の通信(relay だけ)、接続チェック、パネル(部屋を開く・招待・OBS 用リンク・鍵の作り直し・承認待ちの「入れる / 断る」・参加者と回線・外す・閉じる・延長)、状態の保存と復元。MANUAL / CHANGELOG
- poko-tools edition/plus: main の merge と、`/tools/plus/` では WS のままにする切り替え
- Cloudflare(ぶらんち): TURN キーと Analytics 用トークンの作成、課金の確認(12.5 の確認点)、請求の通知。キーが漏れたら: ダッシュボードで TURN キーを消す → 新しいキーを作る → 本番 `.env` を差し替えて pokonya を再起動(開いている部屋は切れる)

### 12.14 段階分け

| 段階 | repo | 内容 | 前提 |
|---|---|---|---|
| 0 | Cloudflare(ぶらんち) | `.env.dev` が `.gitignore` にあることを確かめる。12.5 の確認点 1(支払い方法)・2(通知を $1 程度に)・3 をダッシュボードで見て、開発用の TURN キーと Analytics 用トークン(Account Analytics だけ)を作る。開発用の pokonya の `.env.dev` に入れる(本番の `.env` は段階 d)。キーとトークンはぶらんちだけが扱い、codex には渡さない | この設計の承認 |
| a | 使い捨て(scratchpad)+ 開発用 pokonya | 認証情報を出すだけの最小の口と、2 画面の DataChannel(relay だけ)の実験。ぽこの PC の Chrome ↔ OBS の遅れ、スマホのテザリング、会社網に近い条件(UDP を塞いで 443 だけ)、Memory Saver を入れた裏のタブで 30 分。確認点 4・7・8・9(両側 relay の数え方、失効とキー削除の効き目、12 時間以上つながるか)もここで見る(キー削除は開発用のキーで)。開発用 pokonya は `.env.dev` を読んで起動するだけで、codex はキーを読まない・表示しない | 0 |
| b | pokonya | `deco_signal/`、pytest。本番反映は d でまとめて | a |
| c | poko-tools main | room の JS 移植(テストを移す)、WebRTC の通信、接続チェックの UI、承認・キック、保存と復元。検証サーバー(scratchpad の e2e にシグナリングを足す。Cloudflare は開発用のキーで実物を使う)と headless Chrome 5 画面で、§11 と同じ項目 + 承認待ち・断る・キックで戻れない・ホストの再読み込みで同じ席に戻る・10 分で終わる・版違い・× の表示・承認待ち 5 分の放置・悪用の閾値で全失効(GraphQL はモック) | b |
| d | wp-poko + 本番 | nginx、privacy / terms、本番の `.env` に TURN キー(ぶらんち)、pokonya image 作り直し(**必ず c を Pages に出すより先**)。そのあと Pages に c を出す | b, c、文言はぽこ確認 |
| e | poko-tools edition/plus | main を merge し、`/tools/plus/` では WS のまま動くことを確認、deploy-plus | c |

段階 d の手順書はぽこ / ぶらんちの分担入り HTML にする(ぽこ: ブラウザで部屋を開く・OBS 用リンクを OBS に貼る・ゲストに URL を渡す・承認する・描いて確かめる / ぶらんち: Cloudflare の設定と run.sh で反映)。

### 12.15 決定事項と未決事項

決定(2026-10-17 ぶらんち):

- **ホストはブラウザ**(対応範囲が広い。OBS をホストにする案は持たない)
- **キック(この人を外す)を付ける**(§11.9.4 は無料版では見直し。§11.9.4 にも注記)
- **参加の承認制を付ける**。承認前は TURN の認証情報もホストの SDP も渡さない
- **privacy / terms を更新する**(文言はぽこ確認)
- **Cloudflare Realtime TURN で全員 relay**。参加者どうしに IP は伝わらない(TURN なしの案は取りやめ)
- **鍵・秘密情報は zip で配る前提で扱う**(12.4 の「秘密情報の扱い」)

決定(2026-10-17 承認時、ぶらんち。下の 1〜12 は推奨どおり、13 は (b)、11 はぶらんちのアカウント):

1. **file://(zip)での扱い** — 推奨: 出さない(Web 版へ案内)。zip を配る前提は変えず、一緒にデコるだけ Pages で使ってもらう。zip でも使いたい要望が出たら「ゲストとして参加だけ」(招待 URL を貼る。ホスト鍵は作らない)を検討する。zip でホストまでできるようにすると、OBS のローカルファイルの共有 localStorage にホスト鍵が置かれ、ほかのローカルファイルのページから読めてしまうので勧めない
2. **最初の確認表示** — 2026-10-17 に「IP が相手に伝わることがあります」の確認を付けると決めたが、relay だけにしたので相手には伝わらなくなった。推奨: **確認表示は出さず**、パネルの説明に「通信は Cloudflare を経由します(プライバシーポリシー)」のリンクを置く
3. **人数** — 推奨: §11 と同じ ゲスト 3 人(計 4 人)、席あたり 2 接続。ホストの PC の負荷と TURN の使用量を見てから増やすか決める
4. **ホストが離れたときの猶予** — 推奨: 10 分、ホストの部屋の状態(12.8 の一覧)は IndexedDB に保存して戻ったら読み込む
5. **ホストの引き継ぎ** — 推奨: しない
6. **プラス版** — 推奨: 当面は WS 中継と共存。無料版で TURN の使用量と安定を見てから、プラス版も TURN に移すか決める
7. **ホストの置き換え(`replaced`)** — 推奨: 誰でも置き換えられる(再読み込み・別の画面で開き直すため)+ 切られた側に表示 + 「鍵を全部作り直す」
8. **OBS 鍵の権限** — 推奨: 今のプラス版と同じく、OBS もホスト席(全員の線を消せる)
9. **部屋の最長時間** — 推奨: 12 時間 + 残り 10 分の警告と「延長」1 回(合計 24 時間。認証情報の TTL の都合)
10. **TURN の予算** — 推奨: 実測で月 600 GB に達したら新しい部屋を止め、800 GB で通知(無料枠 1,000 GB の手前で止める)。悪用の検知は直近 5 分 540MB で全失効。課金の上限を Cloudflare 側で掛けられるか(確認点 2)で見直す
11. **どの Cloudflare アカウントで作るか** — 推奨: ぶらんちのアカウント(hoshino-poko.com の DNS は Cloudflare ではないので、DNS とは無関係に作れる)。請求先を誰にするかはぽこと相談
12. **合言葉の承認** — 推奨: 承認待ちのゲストに 4 桁の合言葉を出し、ホストの一覧に同じ数字を並べる(名前欄は作らない)
13. **Cloudflare の規約(確認点 6)** — **決定: FAQ が映像以外の使い方(ロボットの遠隔操作など)も合う使い方に挙げているのを根拠に、問い合わせずに進める**。以下は検討時のメモ: 許される使い方の文言は「video call の機能」で、お絵かきのデータだけの中継はグレー。推奨: 段階 0 の前に Cloudflare に問い合わせる(Discord の Cloudflare Developers やサポート)か、文言どおりでなくても FAQ の「映像以外の使い方」を根拠に進めるかを、ぶらんちが決める。だめなら自前の TURN(coturn を cnh-vps 以外に)か、プラス版と同じ WS 中継に戻る

## 13. オブジェクト消しゴム(自分の線を線ごと消す)— 2026-10-24 ぶらんち決定

デコポコ 1.2.0 でオブジェクト消しゴム(触れた線を 1 本まるごと消す)を入れた(要件は `docs/requirements/deco-poko.md`)。一緒にデコる中は **自分の線だけ** 消せる(ぶらんち)。

- プロトコル(v1 / v2 共通): クライアント → サーバー `{"t": "erase", "layer": 0..2, "targets": [線の id, …]}`。サーバーは targets のうち **送り主の席の stroke・同じレイヤー・取り消していない** ものだけを残し、1 つも残らなければ何もしない(返事なし)。残れば op `{"id", "seq", "seat", "kind": "erase", "layer", "targets"}` を作って `{"t": "op", "op": …}` で全員に流す。`welcome` の ops にも入る
- 検証: `layer` は 0..2(`all` は不可)、`targets` は 1〜500 個の配列(数でない要素は外す)。違えば `bad_message`。容量は消去と同じく `CLEAR_HEADROOM` まで許す
- 戻す / やり直す: erase op はその席の op なので、今の `undo` / `redo` のまま(取り消すと線が戻る)。後ろの消去に覆われた erase op は戻す対象にならない(§5 と同じ)
- 描き直し(collab.js): 取り消していない erase op の targets と erase op 自体を飛ばして描く(まとまりは区切らない)。なぞっている途中は、当たった自分の線を隠して描き直す。送ってから op が返るまでも隠し、10 秒返事が無ければ戻す(古いサーバーで `bad_message` になったときも同じ)
- 古いクライアント(1.1.x 以前)は erase op を知らないので、部屋で誰かが線ごと消すと描き直しで止まる。本番はサーバー → プラス版の順に出し、読み込み直してもらう
- 変更: pokonya `members/deco/room.py`(`_erase`、`Op.kind` に erase、`MAX_ERASE_TARGETS`)、poko-tools `tools/deco-poko/collab.js`(`erasable` / `previewErase` / `erase`、`rebuild` で erase を飛ばす)。無料版の WebRTC 方式(§12)でも同じ op の形を使う
