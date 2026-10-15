# デコポコ「一緒にデコる」設計(ドラフト)

状態: **承認済み**(2026-10-15 ぶらんち。§10 は推奨どおり)。§11(3 人以上)は 2026-10-16 追加のドラフトで承認前。2026-10-15 作成、同日 Fable レビューを反映。実装は下の「段階分け」の順に別チケットで行う。

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
op = 線   {id, seq, seat, layer, tool(brush|outline|eraser), color, alpha, size, edge(auto|white|black), osize, pts[[x,y],...], undone}
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

## 11. 3 人以上(人ごとの席)— ドラフト(承認前)

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
  2. v2 で席キーがあり、対応がある → その席
  3. v2 で席キーが無い・知らない → **人数に空きがあるときだけ** 新しい席 ID と席キーを発行し、`welcome` で返す。空きが無ければ席を発行せずに close `4410`(人数がいっぱい)
- 人数の数え方: 「接続のある席」+「切れてから 10 分以内で、線を 1 本以上描いた席」。**線を描いていない席は切断した時点で破棄**(10 分待たない。localStorage が使えない環境で再読み込みを繰り返しても人数を食い潰さない)
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

### 11.9 未決事項(承認時に決める)

1. **招待 1 本を共有**(推奨)。人ごとに招待を出す方式(誰が入れるかをホストが管理できるが、URL を何本も配る手間が増える)にするか
2. **ゲスト 3 人まで**(計 4 人)でよいか
3. **同じ人の 2 画面は「自分の OBS 用リンク(#席キー)」で同じ席にする**(推奨)。リンクを使わなければ別の人として数える
4. **特定のゲストだけ切る / その人の線だけ消す機能は作らない**(推奨。必要になったら追加)
5. 線を描いた人が切れてから人数に数えなくなるまでの時間 **10 分**でよいか
