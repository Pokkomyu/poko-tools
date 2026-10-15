// デコポコ プラス: 一緒にデコる(hoshino-poko.com の Web 版だけ)。
// 設計: docs/architecture/deco-poko-collab.md。サーバーは pokonya の members/deco(/api/members/deco/*)。
// index.html の window.decoBoard(描画の口)を使い、一緒にデコる中は board.collab にこのオブジェクトを入れる。
(() => {
  const board = window.decoBoard;
  if (!board) return;
  // Web 版(hoshino-poko.com)と開発用のローカルだけ。BOOTH の zip / ローカルファイルでは何も出さない
  if (!/^((www\.)?hoshino-poko\.com|localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
  const m = location.pathname.match(/^\/tools\/plus\/(obs|guest)\/([A-Za-z0-9_-]{32,})\/[a-z0-9-]+\//);
  const via = m ? m[1] : (/^\/tools\/plus\/[a-z0-9-]+\//.test(location.pathname) ? 'cookie' : null);
  if (!via) return;

  // ---------- 人ごとの席(設計 §11): ゲストは席キーで同じ席に戻る ----------
  // 保存先は招待トークンの先頭 6 文字ごと。localStorage が使えなければ sessionStorage → メモリ
  const SEAT_PREFIX = 'poko-deco-seat:';
  const seatStoreKey = via === 'guest' ? SEAT_PREFIX + m[2].slice(0, 6) : null;
  let memSeatKey = null;
  function storageList() {
    const list = [];
    try { if (window.localStorage) list.push(localStorage); } catch (_) {}
    try { if (window.sessionStorage) list.push(sessionStorage); } catch (_) {}
    return list;
  }
  function loadSeatKey() {
    for (const st of storageList()) { try { const v = st.getItem(seatStoreKey); if (v) return v; } catch (_) {} }
    return memSeatKey;
  }
  function saveSeatKey(key) {
    memSeatKey = key;
    for (const st of storageList()) {
      try {
        // 前の招待の席キーは消す(招待ごとに溜まらないように)
        for (let i = st.length - 1; i >= 0; i--) { const k = st.key(i); if (k && k.startsWith(SEAT_PREFIX) && k !== seatStoreKey) st.removeItem(k); }
        st.setItem(seatStoreKey, key);
        return;
      } catch (_) {}
    }
  }
  if (seatStoreKey) {
    // 「自分の OBS 用リンク」(#seat=席キー)で開いたら、その席として入る。# は画面に残さない
    const h = location.hash.match(/^#seat=([A-Za-z0-9_-]{16,64})$/);
    if (h) { saveSeatKey(h[1]); history.replaceState(null, '', location.pathname + location.search); }
  }
  let mySeatKey = null;           // この画面が実際に参加に使った席キー(自分の OBS 用リンクはこれで作る)
  let protoV = 2;                  // 古いサーバー(v1 だけ)に当たったら 1 に落とす(公開順を間違えたときの保険)
  let people = 0;

  const STAGE = { w: 1920, h: 1080 };
  const API = '/api/members/deco';
  const FLUSH_MS = 30;

  // ---------- 状態 ----------
  let ws = null, welcomed = false, inCollab = false, stopped = false;
  let seat = null, conn = 0, tmpN = 0, epoch = 0, maxPoints = 4000, peer = false;
  let retryMs = 1000, retryTimer = 0, pingTimer = 0, closedReason = null;
  let ops = [];                    // 確定した op(seq 順)
  let undone = new Set();          // 取り消し中の op の id
  let maxSeq = 0;
  const pending = new Map();       // 自分の確定待ち: tmp -> {op, canvas(ペン/縁取り)| null(消しゴム), seenSeq}
  const live = new Map();          // 他の接続の描きかけ: tmp -> op
  const rejected = new Set();      // サーバーが断った描きかけの tmp(容量超過など)。描き終えても送らず捨てる
  const PENDING_TIMEOUT_MS = 10000; // 確定の返事がこれだけ来なければ捨てる(保険)
  let peerCanvas = null;
  let sendBuf = null, flushTimer = 0;

  // ---------- UI(パネルに足す) ----------
  const css = document.createElement('style');
  css.textContent = `
    .collab-status { flex: 1; color: var(--ink); }
    .collab-status.warn { color: #ffcc33; }
    #collabUrl, #collabSelfUrl { flex: 1; min-width: 0; padding: 5px 6px; border-radius: 8px; border: 1px solid var(--panel-edge);
      background: rgba(255,255,255,.06); color: var(--ink); font: inherit; font-size: 10px; user-select: all; }
    .collab-hide { display: none !important; }
    #collabTip { position: fixed; left: 50%; bottom: max(12px, env(safe-area-inset-bottom)); transform: translateX(-50%);
      padding: 8px 14px; border-radius: 999px; background: rgba(28,22,34,.85); color: #f3eef7; font-size: 13px;
      pointer-events: none; z-index: 20; white-space: nowrap; }`;
  document.head.appendChild(css);
  const box = document.createElement('div');
  box.innerHTML = `
    <div class="sep"></div>
    <div class="row"><label>一緒に</label><div class="collab-status" id="collabStatus">確認中…</div></div>
    <div class="row collab-hide" id="collabStart"><button class="btn" id="collabOpen">一緒にデコる(部屋を開く)</button></div>
    <div class="row collab-hide" id="collabInvite"><input id="collabUrl" readonly><button class="btn" id="collabCopy" style="flex:none;padding:6px 10px">コピー</button></div>
    <div class="row collab-hide" id="collabSelf" title="この URL を自分の OBS に貼ると、このブラウザと同じ席になります"><input id="collabSelfUrl" readonly><button class="btn" id="collabSelfCopy" style="flex:none;padding:6px 10px">自分のOBS用</button></div>
    <div class="row collab-hide" id="collabHost">
      <button class="btn" id="collabReinvite">招待をやり直す</button>
      <button class="btn" id="collabClose">部屋を閉じる</button>
    </div>`;
  // スマホを縦にしていると描ける範囲が狭い(1920x1080 を縮めて表示している)ので、下の余白に案内を出す。配信(OBS)には出さない
  const tip = document.createElement('div');
  tip.id = 'collabTip'; tip.textContent = '横向きにすると大きく描けます'; tip.hidden = true;
  document.body.appendChild(tip);
  function checkOrientation() {
    tip.hidden = !(inCollab && typeof window.obsstudio === 'undefined' && window.innerHeight > window.innerWidth);
  }
  window.addEventListener('resize', checkOrientation);
  const hint = board.panel.querySelector('.hint');
  board.panel.insertBefore(box, hint);
  const $ = id => document.getElementById(id);
  const show = (id, on) => $(id).classList.toggle('collab-hide', !on);
  function status(text, warn) {
    $('collabStatus').textContent = text;
    $('collabStatus').classList.toggle('warn', !!warn);
  }
  function refreshUi() {
    checkOrientation();
    const host = via === 'cookie';
    show('collabStart', host && !inCollab && !stopped);
    show('collabHost', host && inCollab);
    const selfKey = via === 'guest' && inCollab && welcomed ? mySeatKey : null;
    show('collabSelf', !!selfKey);
    if (selfKey) $('collabSelfUrl').value = location.origin + location.pathname + '#seat=' + selfKey;
    if (inCollab && welcomed) {
      const me = seat === 'host' ? 'ホスト' : /^g\d+$/.test(seat || '') ? 'ゲスト ' + seat.slice(1) + ' ' : 'ゲスト';
      status(me + 'で参加中 ・ ' + (protoV >= 2 && people ? '参加: ' + people + ' 人' : '相手: ' + (peer ? 'いる' : 'まだ')));
    }
  }
  function showInvite(path) {
    // サーバーはパスで返すので、ゲストにそのまま渡せる完全な URL にする
    const url = path ? new URL(path, location.origin).href : '';
    show('collabInvite', !!url);
    $('collabUrl').value = url;
  }
  function copyFrom(id) {
    const el = $(id); el.select();
    (navigator.clipboard ? navigator.clipboard.writeText(el.value) : Promise.reject()).catch(() => document.execCommand('copy'));
  }
  $('collabCopy').addEventListener('click', () => copyFrom('collabUrl'));
  $('collabSelfCopy').addEventListener('click', () => copyFrom('collabSelfUrl'));

  async function rest(method, path) {
    const res = await fetch(API + path, { method, credentials: 'same-origin', headers: { 'Accept': 'application/json' } });
    if (res.status === 204) return {};
    let body = null; try { body = await res.json(); } catch (_) {}
    if (!res.ok) throw Object.assign(new Error('http ' + res.status), { status: res.status, body });
    return body;
  }
  function restError(err) {
    const s = err && err.status;
    status(s === 429 ? '部屋がいっぱいです。少し待ってから試してください'
      : s === 401 ? 'ログインが切れています。/tools/plus/ からログインし直してください'
      : s === 403 ? 'この操作はできません(権利かページの開き方を確認してください)'
      : '部屋を開けませんでした', true);
  }
  $('collabOpen').addEventListener('click', async () => {
    try {
      const r = await rest('POST', '/room');
      showInvite(r.invite && r.invite.url);
      if (!(r.invite && r.invite.url)) status('部屋を開きました。招待 URL が分からないときは「招待をやり直す」');
      stopped = false; connect();
    } catch (err) { restError(err); }
  });
  $('collabReinvite').addEventListener('click', async () => {
    if (!confirmInPanel('招待をやり直すと、今のゲストは切断されます。')) return;
    try { const r = await rest('POST', '/room/invite'); showInvite(r.invite && r.invite.url); refreshUi(); } catch (err) { restError(err); }
  });
  $('collabClose').addEventListener('click', async () => {
    if (!confirmInPanel('部屋を閉じると、描いた絵は消えます。')) return;
    try { await rest('DELETE', '/room'); } catch (err) { restError(err); }
  });
  // OBS の対話では confirm() が出ないので、2 回押しで確定する
  let armed = null;
  function confirmInPanel(msg) {
    const key = msg;
    if (armed === key) { armed = null; return true; }
    armed = key; status(msg + ' もう一度押すと実行します', true);
    setTimeout(() => { if (armed === key) { armed = null; refreshUi(); } }, 4000);
    return false;
  }

  // ---------- 接続 ----------
  function connect() {
    clearTimeout(retryTimer);
    if (ws) return;
    const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + API + '/ws';
    const sock = new WebSocket(url);
    ws = sock; welcomed = false; closedReason = null;
    if (!inCollab) status('つないでいます…');
    sock.onopen = () => {
      const auth = { t: 'auth', v: protoV, via };
      if (via !== 'cookie') auth.path = location.pathname;
      mySeatKey = null;              // v1 のサーバーでは席キーは使わない(自分の OBS 用リンクも出さない)
      if (via === 'guest' && protoV >= 2) { const k = loadSeatKey(); mySeatKey = k; if (k) auth.seat_key = k; }
      sock.send(JSON.stringify(auth));
    };
    sock.onmessage = ev => { if (ws === sock) { try { onMessage(JSON.parse(ev.data)); } catch (err) { console.warn(err); } } };
    sock.onclose = ev => { if (ws === sock) { ws = null; onClose(ev.code); } };
  }
  function send(obj) { if (ws && ws.readyState === 1 && welcomed) ws.send(JSON.stringify(obj)); }
  function retry(ms, text) {
    if (text) status(text, true);
    clearTimeout(retryTimer);
    retryTimer = setTimeout(connect, ms);
  }
  function onClose(code) {
    welcomed = false; clearInterval(pingTimer);
    board.updateButtons(); board.render();
    if (code === 4404) {                      // 部屋が無い / 閉じた
      // 閉じられた(理由付き)なら抜ける。理由が無いのは pokonya の再起動直後でホストより先につないだ場合なので待つ
      if (inCollab && (closedReason || via === 'cookie')) return leaveCollab();
      if (inCollab) return retry(3000, 'ホストのつなぎ直しを待っています…');
      if (via === 'cookie') { status('一人で描いています'); refreshUi(); return; }
      return retry(15000, via === 'obs' ? 'ブラウザ版で「一緒にデコる」を押すと、ここに自動でつながります'
        : 'ホストの部屋が開いていません。開くと自動でつながります');
    }
    if (code === 4403) { stopped = true; if (inCollab) return leaveCollab(via === 'guest' ? '招待が切れました(ホストが招待をやり直したか、部屋を閉じました)' : undefined); status(via === 'guest' ? '招待が切れています' : '使えません(権利がないか、URL が無効です)', true); return refreshUi(); }
    // v2 の認証を古いサーバー(v1 だけ)が 4401 で断った: v1 でつなぎ直す(公開順を間違えたときの保険)
    if (code === 4401 && protoV >= 2 && !inCollab) { protoV = 1; return retry(200); }
    // 人数がいっぱい(ホスト + ゲスト 3 人)
    if (code === 4410) return retry(30000, '人数がいっぱいです(ホスト + 3 人まで)。空いたら自動でつながります');
    if (code === 4401) {
      stopped = true;
      if (inCollab) return leaveCollab('ログインが切れました');
      status('ログインが切れています。/tools/plus/ からログインし直してください', true); return refreshUi();
    }
    // 同じ席の画面が多い: 回線が切れた直後はサーバーが古い接続をまだ数えていることがあるので、待ってつなぎ直す
    if (code === 4409) return retry(20000, '同じ席の画面が多すぎます(3 つまで)。少し待ってつなぎ直します');
    // 4429 / 通信の切断など: 少しずつ間隔を空けてつなぎ直す
    retryMs = Math.min(retryMs * 2, 30000);
    retry(retryMs, inCollab ? 'つなぎ直しています…(描けません)' : 'つなげませんでした。つなぎ直します…');
  }

  // ---------- 受信 ----------
  function onMessage(msg) {
    switch (msg.t) {
      case 'welcome': return onWelcome(msg);
      case 'op': return onOp(msg);
      case 'undone': return onUndone(msg);
      case 's.begin': live.set(msg.tmp, fromWire(msg, [msg.pt])); return board.render();
      case 's.pts': { const o = live.get(msg.tmp); if (o) { for (const p of msg.pts) o.pts.push({ x: p[0], y: p[1] }); board.render(); } return; }
      case 's.abort': return onAbort(msg.tmp);
      case 'peer':
        if (typeof msg.people === 'number') { people = msg.people; peer = people > 1; } else peer = msg.peer === 'joined';
        return refreshUi();
      case 'error': {
        // 断られた線は描き終えても送らない(送るとサーバーには無い線が「確定待ち」のまま残る)
        const tmp = msg.tmp || (msg.code === 'bad_message' && sendBuf ? sendBuf.tmp : null);
        if (tmp) { rejected.add(tmp); onAbort(tmp); }
        if (msg.code === 'room_full') status('部屋の容量がいっぱいです。ホストの「全部消す」で空けてください', true);
        return;
      }
      case 'closed': closedReason = msg.reason || 'closed'; return; // 理由のあとに close が来る(onClose で扱う)
    }
  }
  function onWelcome(msg) {
    welcomed = true; retryMs = 1000; epoch++;
    seat = msg.seat; conn = msg.conn; peer = !!msg.peer;
    protoV = msg.v >= 2 ? 2 : 1;
    people = msg.people || 0;
    if (msg.seat_key && seatStoreKey) { mySeatKey = msg.seat_key; saveSeatKey(msg.seat_key); }
    maxPoints = (msg.limits && msg.limits.stroke_points) || 4000;
    if (!inCollab) enterCollab();
    ops = (msg.ops || []).map(o => fromWire(o, o.pts));
    undone = new Set(msg.undone || []);
    maxSeq = ops.length ? ops[ops.length - 1].seq : 0;
    pending.clear(); live.clear();
    for (let i = 0; i < board.LAYER_COUNT; i++) rebuild(i);
    clearInterval(pingTimer);
    pingTimer = setInterval(() => send({ t: 'ping' }), 25000);
    refreshUi(); board.updateButtons(); board.render();
  }
  function onOp(msg) {
    const op = fromWire(msg.op, msg.op.pts || []);
    if (msg.reset) {
      // 満杯のときのホストの「全部消す」: サーバーはそれまでの op を捨て、この消去も残さない(戻せない)
      ops = []; undone.clear(); maxSeq = op.seq;
      for (let i = 0; i < board.LAYER_COUNT; i++) rebuild(i);
      return board.render();
    }
    ops.push(op);
    const prev = maxSeq; maxSeq = op.seq;
    const mine = msg.tmp ? pending.get(msg.tmp) : null;
    if (msg.tmp) { pending.delete(msg.tmp); live.delete(msg.tmp); }
    if (op.kind === 'clear') { for (const i of opLayers(op)) rebuild(i); return board.render(); }
    if (mine) {
      // 描き始めてから他の op が入っていなければ末尾に足す(縁取りのまとまりも描き直しと同じになる)
      if (mine.seenSeq === prev) board.appendLayer(op.layer, [op]);
      else rebuild(op.layer);
    } else if (op.tool === 'eraser' || hasPendingEraser(op.layer)) {
      rebuild(op.layer);
    } else {
      board.appendLayer(op.layer, [op]);
    }
    board.render();
  }
  function onUndone(msg) {
    if (msg.undone) undone.add(msg.id); else undone.delete(msg.id);
    const op = ops.find(o => o.id === msg.id);
    if (op) for (const i of opLayers(op)) rebuild(i);
    board.render();
  }
  function onAbort(tmp) {
    live.delete(tmp);
    const p = pending.get(tmp);
    if (p) { pending.delete(tmp); if (!p.canvas) rebuild(p.op.layer); }
    board.render();
  }

  // ---------- 描き直し ----------
  const opLayers = op => op.layer === 'all' ? [...Array(board.LAYER_COUNT).keys()] : [op.layer];
  const hasPendingEraser = i => [...pending.values()].some(p => !p.canvas && p.op.layer === i);
  // レイヤー i = 取り消していない op を seq 順に。消去は scope=all ならそれまでの全員の線、mine ならその席の線を消す。
  // 消去は縁取りのまとまりも区切る(1 人のときと同じ)
  const BREAK = { kind: 'break' };
  function rebuild(i) {
    let vis = [];
    for (const op of ops) {
      if (undone.has(op.id)) continue;
      if (op.kind === 'clear') {
        if (op.layer === 'all' || op.layer === i) { vis = op.scope === 'mine' ? vis.filter(o => o.seat !== op.seat) : []; vis.push(BREAK); }
      } else if (op.layer === i) vis.push(op);
    }
    board.relayer(i, vis);
    // 確定待ちの自分の消しゴムはレイヤーに直接描いているので、描き直したら重ね直す(縁取りのまとまりも区切れる)
    const extra = [...pending.values()].filter(p => !p.canvas && p.op.layer === i).map(p => p.op);
    // 描いている途中の消しゴムも同じ(消し跡が描き直しで消えないように)
    const cur = board.stroke;
    if (cur && cur.tool === 'eraser' && cur.layer === i) extra.push(cur);
    if (extra.length) board.appendLayer(i, extra);
  }

  // ---------- 送信(board から呼ばれる) ----------
  const r1 = v => Math.round(v * 10) / 10;
  const wirePt = p => [r1(p.x), r1(p.y)];
  // フチ色: 送るときは決めた色(#rrggbb)。サーバーは名前と大文字も通すので、どれでも描けるようにする
  function edgeHex(e) {
    e = String(e || '').toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(e)) return e;
    return e === 'black' ? '#000000' : '#ffffff';
  }
  function fromWire(o, pts) {
    return {
      id: o.id, seq: o.seq, seat: o.seat, kind: o.kind || 'stroke', layer: o.layer, scope: o.scope,
      tool: o.tool, color: o.color, alpha: o.alpha, size: o.size, osize: o.osize,
      ec: edgeHex(o.edge),
      pts: (pts || []).map(p => Array.isArray(p) ? { x: p[0], y: p[1] } : p),
    };
  }
  function flush() {
    clearTimeout(flushTimer); flushTimer = 0;
    if (sendBuf && sendBuf.pts.length) send({ t: 's.pts', tmp: sendBuf.tmp, pts: sendBuf.pts.map(wirePt) });
    if (sendBuf) sendBuf.pts = [];
  }
  const api = {
    canDraw: () => !!(ws && welcomed),
    maxPoints: () => maxPoints,
    begin(stroke) {
      stroke.tmp = conn + '-' + (++tmpN); stroke.epoch = epoch; stroke.seenSeq = maxSeq;
      stroke.alpha = r1(stroke.alpha); // サーバーは小数 1 桁に丸める。自分の表示も同じ値で描く
      flush();
      sendBuf = { tmp: stroke.tmp, pts: [] };
      send({
        t: 's.begin', tmp: stroke.tmp, layer: stroke.layer, tool: stroke.tool, color: stroke.color,
        alpha: stroke.alpha, size: stroke.size, edge: stroke.ec || 'auto', osize: stroke.osize, pt: wirePt(stroke.pts[0]),
      });
    },
    points(stroke, pts) {
      if (!sendBuf || sendBuf.tmp !== stroke.tmp) return;
      sendBuf.pts.push(...pts);
      if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_MS);
    },
    end(op, temp) {
      flush(); sendBuf = null;
      if (rejected.delete(op.tmp) || op.epoch !== epoch || !welcomed) {
        // 断られた / 描いている間につなぎ直した: この線はサーバーに無いので捨てる
        if (op.tool === 'eraser') { rebuild(op.layer); board.render(); }
        return;
      }
      let canvas = null;
      if (op.tool !== 'eraser') { canvas = board.makeCanvas(); canvas.getContext('2d').drawImage(temp, 0, 0); }
      pending.set(op.tmp, { op, canvas, seenSeq: op.seenSeq });
      send({ t: 's.end', tmp: op.tmp });
      setTimeout(() => { if (pending.has(op.tmp)) onAbort(op.tmp); }, PENDING_TIMEOUT_MS);
    },
    clear(layer) { send({ t: 'clear', layer, scope: seat === 'host' ? 'all' : 'mine' }); },
    undo() { send({ t: 'undo' }); },
    redo() { send({ t: 'redo' }); },
    renderLayer(ctx, i) {
      for (const p of pending.values()) if (p.canvas && p.op.layer === i) ctx.drawImage(p.canvas, 0, 0);
      let any = false;
      for (const o of live.values()) if (o.layer === i && o.tool !== 'eraser') { any = true; break; }
      if (!any) return;
      if (!peerCanvas || peerCanvas.width !== board.W || peerCanvas.height !== board.H) peerCanvas = board.makeCanvas();
      const c = peerCanvas.getContext('2d');
      c.clearRect(0, 0, peerCanvas.width, peerCanvas.height);
      for (const o of live.values()) if (o.layer === i && o.tool !== 'eraser' && o.pts.length) board.paintStrokeTo(c, o);
      ctx.drawImage(peerCanvas, 0, 0);
    },
  };

  function enterCollab() {
    inCollab = true;
    board.setStage(STAGE);      // 1920x1080 の論理座標に切り替え、1 人で描いていた絵は表示から外す(保存は残る)
    board.collab = api;
    board.updateButtons();
  }
  function leaveCollab(text) {
    if (via === 'guest') {
      // ゲストは読み込み直すと招待切れのページになるので、絵を消して案内だけ出す
      stopped = true; board.collab = null; board.setStage(STAGE); board.updateButtons();
      status(text || '部屋が閉じました。ありがとうございました', true);
      return refreshUi();
    }
    // 1 人で描いていた絵に戻すには読み込み直すのが確実(保存は一緒にデコる中も触っていない)
    status(text || '部屋が閉じました');
    setTimeout(() => location.reload(), 800);
  }

  window.addEventListener('beforeunload', () => { if (ws) ws.close(1000); });
  refreshUi();
  connect();
})();
