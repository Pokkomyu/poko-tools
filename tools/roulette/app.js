/* ぽこルーレット
 * file:// で動かすため module / fetch は使わない(docs/development/conventions.md)
 */
(function () {
  "use strict";

  var VERSION = "1.0.0"; // tool.json と揃える
  var STORAGE_KEY = "poko-tools.roulette.v1";
  var STAGE_W = 1920;
  var STAGE_H = 1080;
  var WINNER_SHOW_MS = 5000;
  var TWO_PI = Math.PI * 2;
  var COLORS = ["#ff8fc7", "#ffffff", "#6cb8ff", "#ff6b6b", "#b98cff", "#ffe066"];
  var INK = "#3b2b45";
  var FONT = '"M PLUS Rounded 1c", "Kosugi Maru", "Hiragino Maru Gothic ProN", "BIZ UDPGothic", "Meiryo", system-ui, sans-serif';
  var MAX_NAME_LENGTH = 40;
  // 名前プリセット(2026-10-09 ぽこ要望「セットを10個ぐらい保存しておけるように」)
  var SET_MAX = 10;
  var SET_NAME_MAX = 20;
  // 針のプルプル: 項目の境目が針を通るたびに弾かれ、すぐ減衰する
  // 弾いた揺れは約0.5秒で減衰する。最後の境目を通ってから止まるまでは 0.5 秒以上あるので、止まる頃には収まっている
  var KICK_DEG = 5;
  var KICK_DECAY_MS = 80;
  var KICK_PERIOD_MS = 160;
  var KICK_FULL_SPEED = 6;   // rad/s。これより遅いと弾く強さを弱める
  var KICK_MIN_RATIO = 0.3;
  // 回転: 減速(MAIN)→ 最後の境目の手前から「じわじわ」(CREEP)→ 針の粘り(DRAMA。ない回もある)で止まる。
  // どれも毎回乱数で変える(毎回同じだと単調。2026-10-08 ぽこ要望「減速急すぎ」「じわじわの長さがワンパターン」)
  // MAIN の速度は (1-s)^p で落とす。p が小さいほどブレーキが緩やか(0.3.4 までの p=3 は序盤に急に落ちて見えた)
  var MAIN_MS_MIN = 3800, MAIN_MS_RANGE = 2000;
  var MAIN_EASE_MIN = 1.2, MAIN_EASE_RANGE = 1.3;
  // じわじわの長さ。lead: 当たりに入る境目の何項目ぶん手前から始めるか [下限, 幅]、leadDeg: その角度の範囲、ms: [下限, 幅]
  var CREEP_KINDS = [
    { weight: 3, lead: [0.2, 0.2], leadDeg: [8, 14], ms: [1400, 800] },    // あっさり
    { weight: 4, lead: [0.4, 0.3], leadDeg: [14, 24], ms: [2200, 1000] },  // ふつう
    { weight: 3, lead: [1.0, 1.2], leadDeg: [25, 70], ms: [3000, 1200] }   // 長い(名前をいくつか通り過ぎる)
  ];
  var CREEP_MAX_SPEED = 45 * Math.PI / 180;  // じわじわ開始時の角速度の上限 rad/s(これ以上だと速く見える)。超える時は時間を延ばす
  var CREEP_MS_MAX = 5000;
  var CREEP_MS_DRAMA = 0.7; // 粘りがある回はじわじわを短くして、全体が長くなりすぎないようにする
  // 針の粘り: 境目(釘)が針に触れる範囲で盤が止まりかけ、ギリギリ越えたり押し返されたりする(2026-10-08 ぽこ要望)
  // 位置は当たりの項目の中の割合 o で表す(1 = 当たりに入る境目、0 = 次の項目との境目)
  //   squeeze  : 当たりに入る境目で粘って、ギリギリ越える
  //   squeeze2 : 一度押し返されて、もう一回押して越える
  //   pushback : 当たりを通り過ぎかけて、次の境目で押し返される
  //   pushback2: 押し返されて、もう一回行きかけて、また押し返される
  // 押し返しが起きる回(squeeze2 / pushback / pushback2)は合わせて 2 割まで(2026-10-09 ぽこ要望「押し返しは1〜2割」)
  // minN: 項目が少ないと 1 項目が大きく、通り過ぎかける動きが長くなりすぎるので出さない
  var DRAMA_KINDS = [
    { name: "none", weight: 50, minN: 1 },
    { name: "squeeze", weight: 30, minN: 2 },
    { name: "squeeze2", weight: 5, minN: 2 },
    { name: "pushback", weight: 10, minN: 5 },
    { name: "pushback2", weight: 5, minN: 5 }
  ];
  var CONTACT_DEG = 7, CONTACT_SEG = 0.15;   // 釘が針に触れる角度(項目の幅の 15% まで)
  var CONTACT_BEND_DEG = 14;                 // 釘に押された針の最大の傾き
  var CONTACT_SPEED = 1.5;                   // rad/s。これより速い時は押されて見えないので傾けない
  // 中心の飾りと重ならないよう、盤の中の文字を上にずらす量(半径比)
  var OFF_CENTER_Y = 0.35;

  // ---------- state ----------

  var state = {
    entries: [],   // {id, name}
    removed: [],   // 「当たったら消す」で盤から外した人。結果クリアで戻す
    winners: [],   // {n, name}
    spinCount: 0,
    lastWinnerId: null,
    sets: [],          // 名前プリセット {id, name, names: [名前]}
    activeSetId: null, // 使用中のプリセット。名前を変えるとこのプリセットにも書き戻す
    options: { removeOnWin: false, noRepeat: false, showCount: false, sound: true, fanfare: true, congrats: true }
  };

  var rotation = 0;
  var spinning = false;
  var pendingRemovalId = null;
  var winnerTimer = null;
  var nextId = 1;
  var nextSetId = 1;
  var confirmedSetId = null; // 「プリセットが変更されます」で「変更する」を選んだプリセット(別のプリセットに切り替えるまで聞かない)

  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved) return;
      state.entries = Array.isArray(saved.entries) ? saved.entries : [];
      state.removed = Array.isArray(saved.removed) ? saved.removed : [];
      state.winners = Array.isArray(saved.winners) ? saved.winners : [];
      state.spinCount = saved.spinCount | 0;
      state.lastWinnerId = saved.lastWinnerId || null;
      for (var k in state.options) {
        if (saved.options && typeof saved.options[k] === "boolean") state.options[k] = saved.options[k];
      }
      state.entries.concat(state.removed).forEach(function (e) {
        if (e.id >= nextId) nextId = e.id + 1;
      });
      state.sets = (Array.isArray(saved.sets) ? saved.sets : []).filter(function (t) {
        return t && typeof t.id === "number" && typeof t.name === "string" && Array.isArray(t.names);
      }).slice(0, SET_MAX).map(function (t) {
        return { id: t.id, name: t.name, names: t.names.filter(function (x) { return typeof x === "string"; }) };
      });
      state.sets.forEach(function (t) { if (t.id >= nextSetId) nextSetId = t.id + 1; });
      state.activeSetId = setById(saved.activeSetId) ? saved.activeSetId : null;
    } catch (e) {
      // 保存データが壊れていても初期状態で起動する
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // 保存できない環境(シークレットウィンドウ等)でも動作は続ける
    }
  }

  // ---------- random ----------

  // 0 <= r < n の一様な整数(剰余の偏りを除く)
  function randInt(n) {
    var buf = new Uint32Array(1);
    var limit = Math.floor(0x100000000 / n) * n;
    do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
    return buf[0] % n;
  }

  function randFloat() {
    return randInt(0x40000000) / 0x40000000;
  }

  // ---------- DOM ----------

  function $(id) { return document.getElementById(id); }

  var el = {
    stage: $("stage"),
    screen: document.querySelector(".screen"),
    wheelArea: document.querySelector(".wheel-area"),
    canvas: $("wheel"),
    pointer: document.querySelector(".pointer"),
    spinCount: $("spinCount"),
    winner: $("winner"),
    winnerLabel: document.querySelector(".winner-label"),
    winnerName: $("winnerName"),
    winnerList: $("winnerList"),
    entryList: $("entryList"),
    entryCount: $("entryCount"),
    clearEntries: $("clearEntries"),
    addInput: $("addInput"),
    addBtn: $("addBtn"),
    startBtn: $("startBtn"),
    resetBtn: $("resetBtn"),
    version: $("version"),
    setCurrent: $("setCurrent"),
    setOpenBtn: $("setOpenBtn"),
    dialog: $("dialog"),
    dialogTitle: $("dialogTitle"),
    dialogBody: $("dialogBody"),
    dialogButtons: $("dialogButtons"),
    opt: {
      removeOnWin: $("optRemoveOnWin"),
      noRepeat: $("optNoRepeat"),
      showCount: $("optShowCount"),
      sound: $("optSound"),
      fanfare: $("optFanfare"),
      congrats: $("optCongrats")
    }
  };
  var ctx = el.canvas.getContext("2d");

  // ---------- layout ----------

  var isObs = typeof window.obsstudio !== "undefined";
  var params = new URLSearchParams(location.search);
  if (!isObs && params.get("bg") !== "transparent") document.body.classList.add("preview");

  // スマホ表示: 幅が狭いか縦長の時は、ルーレット+当選履歴(SCREEN_W x SCREEN_H)を幅に合わせて縮小し、
  // 操作パネルはその下に普通の大きさで並べる(縦スクロール)。OBS 内では常に 1920x1080
  var SCREEN_W = 990;
  var SCREEN_H = 740;
  var stageScale = 1;
  function fitStage() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var mobile = !isObs && (w < 900 || w < h);
    document.documentElement.classList.toggle("mobile", mobile);
    if (mobile) {
      el.stage.style.transform = "";
      var cs = getComputedStyle(el.stage);
      var avail = el.stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      // 横向きのスマホでも START(約 100px)まで 1 画面に収まるよう高さでも制限する
      stageScale = Math.min(1, avail / SCREEN_W, Math.max(0.3, (h - 100) / SCREEN_H));
      el.screen.style.transform = "scale(" + stageScale + ")";
      // transform はレイアウト上の大きさを変えないので、縮んだ分を margin で詰める
      el.screen.style.marginRight = (SCREEN_W * stageScale - SCREEN_W) + "px";
      el.screen.style.marginBottom = (SCREEN_H * stageScale - SCREEN_H) + "px";
    } else {
      el.screen.style.transform = el.screen.style.marginRight = el.screen.style.marginBottom = "";
      stageScale = Math.min(w / STAGE_W, h / STAGE_H);
      var left = (w - STAGE_W * stageScale) / 2;
      var top = (h - STAGE_H * stageScale) / 2;
      el.stage.style.transform = "translate(" + left + "px," + top + "px) scale(" + stageScale + ")";
    }
    resizeCanvas();
  }

  function resizeCanvas() {
    var ratio = Math.max(1, (window.devicePixelRatio || 1) * stageScale);
    var size = Math.round(640 * ratio);
    if (el.canvas.width !== size) {
      el.canvas.width = size;
      el.canvas.height = size;
    }
    drawWheel();
  }

  // ---------- wheel ----------

  function segmentColor(i, n) {
    // 最後と最初が同じ色で隣り合う場合は最後の色をずらす
    if (n > 1 && i === n - 1 && i % COLORS.length === 0) return COLORS[2];
    return COLORS[i % COLORS.length];
  }

  function normalize(a) {
    a %= TWO_PI;
    return a < 0 ? a + TWO_PI : a;
  }

  // 針(真上)の下にある項目の index
  function indexAtPointer(n) {
    return Math.floor(normalize(-rotation) / (TWO_PI / n)) % n;
  }

  // 盤の名前の大きさ(半径 300 の盤での px)。長い名前は NAME_MIN_RATIO 倍まで縮め、それでも入らない時だけ … で切る
  var NAME_MAX = 40, NAME_MAX_SINGLE = 48, NAME_MIN = 14, NAME_MIN_RATIO = 0.5;

  // 1 項目ぶんの名前の大きさと表示文字列を決める(ctx.font を設定して返す)
  // 外側の端(半径 outer)にそろえて置くので、文字の内側の端が中心に近いほど扇形の幅が狭くなる。
  // 内側の端で扇形の幅(弦)が文字の高さ以上あることも条件にする
  function fitName(name, base, minSize, maxWidth, outer, halfSeg) {
    ctx.font = "800 " + base + "px " + FONT;
    var perPx = ctx.measureText(name).width / base; // 文字幅は大きさに比例する
    var size = Math.min(base, maxWidth / perPx);
    if (halfSeg < Math.PI / 2) {
      // 内側の端の半径 outer - perPx*size で弦 2ρ·sin(halfSeg) >= size
      size = Math.min(size, outer / (perPx + 1 / (2 * Math.sin(halfSeg))));
    }
    size *= 0.99;
    if (size >= minSize) {
      ctx.font = "800 " + size + "px " + FONT;
      return { size: size, label: name };
    }
    ctx.font = "800 " + minSize + "px " + FONT;
    var w = maxWidth;
    if (halfSeg < Math.PI / 2) w = Math.min(w, outer - minSize / (2 * Math.sin(halfSeg)));
    return { size: minSize, label: fitText(name, w) };
  }

  function fitText(text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    var s = text;
    while (s.length > 1 && ctx.measureText(s + "…").width > maxWidth) s = s.slice(0, -1);
    return s + "…";
  }

  function drawWheel() {
    var size = el.canvas.width;
    var k = size / 640;
    var c = size / 2;
    var r = 300 * k;
    var n = state.entries.length;

    ctx.clearRect(0, 0, size, size);

    if (n === 0) {
      ctx.beginPath();
      ctx.arc(c, c, r, 0, TWO_PI);
      ctx.fillStyle = "#f3eaf2";
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.font = "800 " + 36 * k + "px " + FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // 中心の飾りと重ならないよう上にずらす
      ctx.fillText("名前を追加してね", c, c - r * OFF_CENTER_Y);
    } else {
      var seg = TWO_PI / n;
      for (var i = 0; i < n; i++) {
        var a0 = -Math.PI / 2 + rotation + i * seg;
        ctx.beginPath();
        ctx.moveTo(c, c);
        ctx.arc(c, c, r, a0, a0 + seg);
        ctx.closePath();
        ctx.fillStyle = segmentColor(i, n);
        ctx.fill();
        if (n > 1) {
          ctx.lineWidth = 2 * k;
          ctx.strokeStyle = INK;
          ctx.stroke();
        }
      }

      // 名前(中心から外向き)。基準の大きさは項目数で決め、入りきらない名前だけ個別に縮める
      var baseSize = Math.max(NAME_MIN, Math.min(NAME_MAX, (TWO_PI * r * 0.55) / n / k * 0.9)) * k;
      if (n === 1) baseSize = NAME_MAX_SINGLE * k;
      var minSize = Math.max(NAME_MIN * k, baseSize * NAME_MIN_RATIO);
      // 名前は外側(0.9r)にそろえ、内側は中心の飾りの手前(0.16r)まで使う。1人だけの時は横書きで盤の上側に置くので盤の幅近くまで使える
      var maxWidth = n === 1 ? r * 1.5 : r * 0.74;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      for (var j = 0; j < n; j++) {
        var mid = -Math.PI / 2 + rotation + (j + 0.5) * seg;
        var fit = fitName(state.entries[j].name, baseSize, minSize, maxWidth, r * 0.9, n === 1 ? Math.PI : seg / 2);
        var label = fit.label;
        var fontSize = fit.size;
        ctx.save();
        ctx.translate(c, c);
        ctx.rotate(n === 1 ? 0 : mid);
        // 1人だけの時は中心の飾りと重ならないよう上に置く
        var x = n === 1 ? ctx.measureText(label).width / 2 : r * 0.9;
        var y = n === 1 ? -r * OFF_CENTER_Y : 0;
        ctx.lineWidth = fontSize * 0.28;
        ctx.strokeStyle = "#ffffff";
        ctx.strokeText(label, x, y);
        ctx.fillStyle = INK;
        ctx.fillText(label, x, y);
        ctx.restore();
      }
    }

    // 外枠と中心
    ctx.beginPath();
    ctx.arc(c, c, r, 0, TWO_PI);
    ctx.lineWidth = 16 * k;
    ctx.strokeStyle = INK;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(c, c, 26 * k, 0, TWO_PI);
    ctx.fillStyle = "#ffe066";
    ctx.fill();
    ctx.lineWidth = 6 * k;
    ctx.stroke();
  }

  // ---------- sound (Web Audio 合成。素材ファイル不要) ----------

  var audio = null;
  var lastTickAt = 0;

  function audioCtx() {
    if (!audio) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audio = new AC();
    }
    if (audio.state === "suspended") audio.resume();
    return audio;
  }

  function tone(freq, start, duration, type, gain) {
    var ac = audioCtx();
    if (!ac) return;
    var t = ac.currentTime + start;
    var osc = ac.createOscillator();
    var g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g).connect(ac.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  function playTick() {
    if (!state.options.sound) return;
    var now = performance.now();
    if (now - lastTickAt < 35) return;
    lastTickAt = now;
    tone(1650, 0, 0.04, "triangle", 0.18);
  }

  function playWin() {
    if (!state.options.sound || !state.options.fanfare) return;
    [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
      tone(f, i * 0.11, 0.35, "triangle", 0.22);
    });
    tone(1318.5, 0.44, 0.7, "sine", 0.18);
  }

  // ---------- spin ----------

  function pickWinnerIndex() {
    var candidates = [];
    state.entries.forEach(function (e, i) {
      if (state.options.noRepeat && state.entries.length > 1 && e.id === state.lastWinnerId) return;
      candidates.push(i);
    });
    return candidates[randInt(candidates.length)];
  }

  function randRange(r) { return r[0] + randFloat() * r[1]; }

  function pickWeighted(list) {
    var total = 0;
    list.forEach(function (k) { total += k.weight; });
    var r = randFloat() * total;
    for (var i = 0; i < list.length; i++) {
      r -= list[i].weight;
      if (r < 0) return list[i];
    }
    return list[list.length - 1];
  }

  // 粘りの動き: [かける時間ms, 止まる位置 o] の列。最後が止まる位置(offset)
  // E(c) / N(c): 当たりに入る境目 / 次の境目で、釘に c だけ押し込んだ位置(1 = 境目そのもの、負 = 触れる範囲の外へ戻る)
  function dramaKeys(kind, z, offset) {
    function E(c) { return 1 + z * (1 - c); }
    function N(c) { return z * (1 - c); }
    function t(ms) { return ms * (0.8 + randFloat() * 0.45); }
    switch (kind) {
      case "squeeze":
        return [[0, E(0.7)], [t(400), E(0.45)], [t(450), E(0.9)], [t(1400), offset]];
      case "squeeze2":
        return [[0, E(0.7)], [t(350), E(0.5)], [t(400), E(0.85)], [t(700), E(-1.5)],
          [t(900), E(0.8)], [t(350), E(0.6)], [t(1300), offset]];
      case "pushback":
        return [[0, N(0.65)], [t(350), N(0.45)], [t(450), N(0.92)], [t(1000), offset]];
      case "pushback2":
        return [[0, N(0.75)], [t(400), N(0.9)], [t(800), N(-2)], [t(900), N(0.85)],
          [t(300), N(0.6)], [t(1000), offset]];
      default:
        return [[0, offset]];
    }
  }

  // 止まる位置(当たりの項目の中の割合)。境界ギリギリには止めない。押し返しは押された分だけ境目から離れる
  function pickOffset(kind) {
    if (kind === "squeeze" || kind === "squeeze2") return 0.55 + randFloat() * 0.3;
    if (kind === "pushback" || kind === "pushback2") return 0.2 + randFloat() * 0.25;
    return 0.15 + randFloat() * 0.7;
  }

  // 3次エルミート補間。区間 {t0,t1,x0,x1,v0,v1}(ms, rad, rad/s)
  function hermite(g, ms) {
    var T = (g.t1 - g.t0) / 1000;
    var s = Math.max(0, Math.min(1, (ms - g.t0) / (g.t1 - g.t0)));
    var s2 = s * s, s3 = s2 * s, m0 = g.v0 * T, m1 = g.v1 * T;
    return {
      x: (2 * s3 - 3 * s2 + 1) * g.x0 + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * g.x1 + (s3 - s2) * m1,
      v: ((6 * s2 - 6 * s) * g.x0 + (3 * s2 - 4 * s + 1) * m0 + (-6 * s2 + 6 * s) * g.x1 + (3 * s2 - 2 * s) * m1) / T
    };
  }

  // 1 回ぶんの動き(経過ms → {x: 進んだ角度, v: 角速度 rad/s})を作る
  // MAIN: 速度 vJoin + A(1-s)^p。CREEP: 初速 vJoin から 0 まで(easeOutQuad)。DRAMA: 止まる位置どうしを滑らかにつなぐ
  function planSpin(n, w, from) {
    var seg = TWO_PI / n;
    var kinds = DRAMA_KINDS.filter(function (k) { return n >= k.minN; });
    var drama = pickWeighted(kinds).name;
    var offset = pickOffset(drama);
    var target = -(w + offset) * seg;
    var turns = 5 + randInt(3);
    var delta = turns * TWO_PI + normalize(target - from);
    // 当たりの項目の中の位置 o → 進む角度
    function xAt(o) { return delta + (offset - o) * seg; }

    var z = Math.min(CONTACT_DEG * Math.PI / 180, CONTACT_SEG * seg) / seg;
    var keys = dramaKeys(drama, z, offset);

    var ck = pickWeighted(CREEP_KINDS);
    var lead = Math.min(Math.max(randRange(ck.lead) * seg, ck.leadDeg[0] * Math.PI / 180), ck.leadDeg[1] * Math.PI / 180);
    lead = Math.max(lead, 2.5 * z * seg); // 粘る位置より手前から始める
    var creepFrom = xAt(1) - lead;
    var creepTo = xAt(keys[0][1]);
    var creepDist = creepTo - creepFrom;
    var creepMs = randRange(ck.ms) * (drama === "none" ? 1 : CREEP_MS_DRAMA);
    creepMs = Math.min(CREEP_MS_MAX, Math.max(creepMs, (2 * creepDist / CREEP_MAX_SPEED) * 1000));
    var vJoin = (2 * creepDist) / (creepMs / 1000);

    var mainMs = MAIN_MS_MIN + randInt(MAIN_MS_RANGE);
    var mainS = mainMs / 1000;
    var p = MAIN_EASE_MIN + randFloat() * MAIN_EASE_RANGE;
    var amp = Math.max(0, ((p + 1) * (creepFrom - vJoin * mainS)) / mainS);
    // amp が 0 になる(盤がほぼ回らない)ことは turns >= 5 なので起きないが、念のため距離は vJoin 側で合わせる
    var vConst = amp > 0 ? vJoin : creepFrom / mainS;

    var parts = [{ t0: mainMs, t1: mainMs + creepMs, x0: creepFrom, x1: creepTo, v0: vJoin, v1: 0 }];
    var t = mainMs + creepMs;
    for (var i = 1; i < keys.length; i++) {
      var t1 = t + keys[i][0];
      parts.push({ t0: t, t1: t1, x0: xAt(keys[i - 1][1]), x1: xAt(keys[i][1]), v0: 0, v1: 0 });
      t = t1;
    }

    return {
      duration: t,
      drama: drama,
      curve: function (ms) {
        if (ms < mainMs) {
          var s = ms / mainMs;
          return {
            x: vConst * mainS * s + (amp * mainS * (1 - Math.pow(1 - s, p + 1))) / (p + 1),
            v: vConst + amp * Math.pow(1 - s, p)
          };
        }
        for (var j = 0; j < parts.length; j++) {
          if (ms <= parts[j].t1) return hermite(parts[j], ms);
        }
        return { x: delta, v: 0 };
      }
    };
  }

  // ---------- pointer ----------

  var kickAt = 0;
  var kickAmp = 0;
  var kickRunning = false;
  var pointerBend = 0; // 境目の釘に押されている傾き(deg、右がマイナス)

  // 境目に弾かれた時に呼ぶ。speed: 盤の角速度(rad/s)。釘に押されて傾いていた時は、その傾きから弾け戻る
  function kickPointer(speed) {
    kickAt = performance.now();
    kickAmp = Math.max(KICK_DEG * Math.max(KICK_MIN_RATIO, Math.min(1, speed / KICK_FULL_SPEED)), -pointerBend);
    pointerBend = 0;
    if (!kickRunning) {
      kickRunning = true;
      requestAnimationFrame(animatePointer);
    }
  }

  // 盤は時計回り = 上端は右へ動くので、針先は右(マイナス方向)へ弾かれて減衰振動する
  function animatePointer(now) {
    var dt = Math.max(0, now - kickAt);
    if (dt > KICK_DECAY_MS * 6) {
      kickRunning = false;
      setPointerTransform(pointerBend);
      return;
    }
    var deg = -kickAmp * Math.exp(-dt / KICK_DECAY_MS) * Math.cos((dt / KICK_PERIOD_MS) * TWO_PI);
    setPointerTransform(deg + pointerBend);
    requestAnimationFrame(animatePointer);
  }

  function setPointerTransform(deg) {
    el.pointer.style.transform = Math.abs(deg) < 0.01 ? "" : "rotate(" + deg.toFixed(2) + "deg)";
  }

  // 次の境目(釘)が針に触れていれば、押し込まれた分だけ針を右へ傾ける。速い時は傾けない
  // 針の下の位置は項目の中の割合 o(盤が進むと 1 → 0 に減り、0 で次の項目へ)。o < z が触れている範囲
  function bendPointer(n, speed) {
    var seg = TWO_PI / n;
    var q = normalize(-rotation) / seg;
    var o = q - Math.floor(q);
    var z = Math.min(CONTACT_DEG * Math.PI / 180, CONTACT_SEG * seg) / seg;
    var slow = Math.max(0, 1 - Math.abs(speed) / CONTACT_SPEED);
    pointerBend = o < z ? -CONTACT_BEND_DEG * (1 - o / z) * slow : 0;
    if (!kickRunning) setPointerTransform(pointerBend);
  }

  function start() {
    if (spinning) return;
    finishWinnerDisplay();
    var n = state.entries.length;
    if (n === 0) return;

    audioCtx(); // ユーザー操作の中で音声を有効化する

    var w = pickWinnerIndex();
    var from = rotation;
    var plan = planSpin(n, w, from);
    var duration = plan.duration;
    var curve = plan.curve;
    var winnerEntry = state.entries[w];

    spinning = true;
    state.spinCount += 1;
    render();

    var t0 = performance.now();
    var lastIdx = indexAtPointer(n);

    function frame(now) {
      var ms = Math.min(duration, now - t0);
      var p = curve(ms);
      rotation = from + p.x;
      drawWheel();
      var idx = indexAtPointer(n);
      if (idx !== lastIdx) {
        lastIdx = idx;
        playTick();
        kickPointer(p.v);
      }
      bendPointer(n, p.v);
      if (ms < duration) {
        requestAnimationFrame(frame);
      } else {
        rotation = normalize(rotation);
        drawWheel();
        pointerBend = 0;
        if (!kickRunning) setPointerTransform(0);
        onStop(winnerEntry);
      }
    }
    requestAnimationFrame(frame);
  }

  function onStop(entry) {
    spinning = false;
    state.lastWinnerId = entry.id;
    state.winners.push({ n: state.spinCount, name: entry.name });
    if (state.options.removeOnWin) pendingRemovalId = entry.id;
    save();
    render({ newWinner: true });
    showWinner(entry.name);
    playWin();
  }

  function showWinner(name) {
    el.winnerName.textContent = name;
    el.winner.hidden = false;
    el.winner.classList.remove("hide");
    el.winner.classList.remove("show");
    void el.winner.offsetWidth; // アニメーションを再生し直す
    el.winner.classList.add("show");
    fitWinnerName();
    winnerTimer = setTimeout(function () {
      el.winner.classList.add("hide");
      winnerTimer = setTimeout(finishWinnerDisplay, 350);
    }, WINNER_SHOW_MS);
  }

  // 当選した名前を枠に収める。1行で WINNER_ONE_LINE_MIN まで縮めても入らなければ2行に折り返し、
  // さらに WINNER_MIN まで縮める。それでも入らない時だけ従来どおり … で省略(CSS の ellipsis / line-clamp)。
  // scrollWidth / clientWidth は transform(登場アニメーション・スマホ表示の縮小)の影響を受けないので、表示中でも測れる
  var WINNER_MAX = 110, WINNER_ONE_LINE_MIN = 56, WINNER_MIN = 24, WINNER_STEP = 2;
  function fitWinnerName() {
    var e = el.winnerName;
    var size;
    e.classList.remove("two-lines");
    for (size = WINNER_MAX; ; size -= WINNER_STEP) {
      e.style.fontSize = size + "px";
      if (e.scrollWidth <= e.clientWidth) return;
      if (size <= WINNER_ONE_LINE_MIN) break;
    }
    e.classList.add("two-lines");
    for (size = WINNER_ONE_LINE_MIN; ; size -= WINNER_STEP) {
      e.style.fontSize = size + "px";
      if (e.scrollHeight <= e.clientHeight + 1 || size <= WINNER_MIN) return;
    }
  }

  // 当選表示を閉じ、「当たったら消す」を反映する
  function finishWinnerDisplay() {
    clearTimeout(winnerTimer);
    winnerTimer = null;
    el.winner.hidden = true;
    el.winner.classList.remove("show", "hide");
    if (pendingRemovalId !== null) {
      var id = pendingRemovalId;
      pendingRemovalId = null;
      var i = indexOfId(id);
      if (i >= 0) {
        state.removed.push(state.entries[i]);
        state.entries.splice(i, 1);
        save();
        render();
      }
    }
  }

  // ---------- entries ----------

  function indexOfId(id) {
    for (var i = 0; i < state.entries.length; i++) if (state.entries[i].id === id) return i;
    return -1;
  }

  function addFromInput() {
    if (spinning) return;
    var names = el.addInput.value
      .split(/\r?\n/)
      .map(function (s) { return s.trim().slice(0, MAX_NAME_LENGTH); })
      .filter(function (s) { return s.length > 0; });
    if (names.length === 0) return;
    editEntries(function () {
      finishWinnerDisplay();
      names.forEach(function (name) {
        state.entries.push({ id: nextId++, name: name });
      });
      el.addInput.value = "";
    });
  }

  function removeEntry(id) {
    if (spinning || indexOfId(id) < 0) return;
    editEntries(function () {
      finishWinnerDisplay();
      var i = indexOfId(id);
      if (i >= 0) state.entries.splice(i, 1);
    });
  }

  // 誤操作防止: 2回押しで全消去(OBSの対話ウィンドウでは confirm() が出ないため)
  // プリセットを使用中なら使用を解除して消す(プリセットの中身は消さない)
  var clearArmTimer = null;
  function clearEntries() {
    if (spinning) return;
    if (!el.clearEntries.classList.contains("armed")) {
      el.clearEntries.classList.add("armed");
      el.clearEntries.textContent = "もう一回で消去";
      clearArmTimer = setTimeout(disarmClear, 3000);
      return;
    }
    disarmClear();
    finishWinnerDisplay();
    state.entries = [];
    state.removed = [];
    state.lastWinnerId = null;
    state.activeSetId = null;
    save();
    render();
  }

  function disarmClear() {
    clearTimeout(clearArmTimer);
    el.clearEntries.classList.remove("armed");
    el.clearEntries.textContent = "全消去";
  }

  function resetResults() {
    if (spinning) return;
    finishWinnerDisplay();
    state.entries = state.entries.concat(state.removed);
    state.removed = [];
    state.winners = [];
    state.spinCount = 0;
    state.lastWinnerId = null;
    save();
    render();
  }

  // ---------- dialog ----------

  // 確認・入力の窓。操作パネルの中に重ねる(confirm() / prompt() は OBS の対話ウィンドウで出ないため)
  // buttons: [{label, cls, onClick, disabled, title}]。onClick が無いボタンは閉じるだけ
  function openDialog(opt) {
    el.dialogTitle.textContent = opt.title;
    el.dialogBody.textContent = "";
    if (opt.text) {
      var p = document.createElement("p");
      p.className = "dialog-text";
      p.textContent = opt.text;
      el.dialogBody.appendChild(p);
    }
    if (opt.body) el.dialogBody.appendChild(opt.body);
    el.dialogButtons.textContent = "";
    (opt.buttons || []).forEach(function (b) {
      el.dialogButtons.appendChild(smallButton(b.label, b.cls, b.onClick || closeDialog, b.disabled, b.title));
    });
    el.dialog.hidden = false;
    var focus = el.dialog.querySelector("input") || el.dialogButtons.querySelector(".primary:not(:disabled)");
    if (focus) focus.focus();
  }

  function closeDialog() {
    el.dialog.hidden = true;
    el.dialogBody.textContent = "";
    el.dialogButtons.textContent = "";
  }

  function smallButton(label, cls, onClick, disabled, title) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn-small" + (cls ? " " + cls : "");
    b.textContent = label;
    b.disabled = !!disabled;
    if (title) b.title = title;
    b.addEventListener("click", onClick);
    return b;
  }

  // ---------- name presets ----------

  function setById(id) {
    for (var i = 0; i < state.sets.length; i++) if (state.sets[i].id === id) return state.sets[i];
    return null;
  }

  // 今の名前(「当たったら消す」で外れている人も含む)を追加した順で
  function currentNames() {
    return state.entries.concat(state.removed).slice()
      .sort(function (a, b) { return a.id - b.id; })
      .map(function (e) { return e.name; });
  }

  function setsFull() { return state.sets.length >= SET_MAX; }

  function addSet(name, names) {
    var t = { id: nextSetId++, name: name.slice(0, SET_NAME_MAX), names: names };
    state.sets.push(t);
    return t;
  }

  function defaultSetName() {
    for (var k = 1; ; k++) {
      var name = "プリセット" + k;
      if (!state.sets.some(function (t) { return t.name === name; })) return name;
    }
  }

  // 名前の追加・削除。プリセットを使用中なら、プリセットも書き換わることを一度確認する(2026-10-09 ぽこ要望)
  // 「コピーして新規登録」は元のプリセットを残し、コピーを使用中にしてからそちらを変更する
  function editEntries(apply) {
    var t = setById(state.activeSetId);
    function commit() {
      closeDialog();
      apply();
      t = setById(state.activeSetId);
      if (t) t.names = currentNames();
      save();
      render();
    }
    if (!t || confirmedSetId === t.id) { commit(); return; }
    openDialog({
      title: "プリセット「" + t.name + "」が変更されます",
      text: "このまま変更すると、保存してあるプリセットの名前も変わります。元のプリセットを残したい時は「コピーして新規登録」を選んでね。",
      buttons: [
        { label: "コピーして新規登録", cls: "primary", disabled: setsFull(),
          title: setsFull() ? "プリセットは " + SET_MAX + " 個までです" : "",
          onClick: function () {
            var c = addSet(t.name + "のコピー", t.names.slice());
            state.activeSetId = c.id;
            confirmedSetId = c.id;
            commit();
          } },
        { label: "変更する", onClick: function () { confirmedSetId = t.id; commit(); } },
        { label: "やめる" }
      ]
    });
  }

  function loadSet(t) {
    closeDialog();
    finishWinnerDisplay();
    state.entries = t.names.map(function (name) { return { id: nextId++, name: name }; });
    state.removed = [];
    state.lastWinnerId = null;
    state.activeSetId = t.id;
    confirmedSetId = null;
    save();
    render();
  }

  // プリセットに切り替える。今の名前がどのプリセットにも入っていなければ、消える前に確認する
  function useSet(id) {
    var t = setById(id);
    if (!t || spinning) return;
    var n = state.entries.length + state.removed.length;
    if (state.activeSetId !== null || n === 0) { loadSet(t); return; }
    openDialog({
      title: "今の名前はプリセットに入っていません",
      text: "「" + t.name + "」に切り替えると、今の名前(" + n + "人)は消えます。",
      buttons: [
        { label: "保存してから切り替え", cls: "primary", disabled: setsFull(),
          title: setsFull() ? "プリセットは " + SET_MAX + " 個までです" : "",
          onClick: function () { addSet(defaultSetName(), currentNames()); loadSet(t); } },
        { label: "切り替える", onClick: function () { loadSet(t); } },
        { label: "やめる", onClick: openSetList }
      ]
    });
  }

  // 今の名前を新しいプリセットとして保存し、使用中にする。続けて名前を付ける
  function saveAsSet() {
    if (setsFull() || spinning) return;
    var t = addSet(defaultSetName(), currentNames());
    state.activeSetId = t.id;
    confirmedSetId = null;
    save();
    render();
    renameSet(t.id);
  }

  function renameSet(id) {
    var t = setById(id);
    if (!t) return;
    var input = document.createElement("input");
    input.type = "text";
    input.className = "dialog-input";
    input.maxLength = SET_NAME_MAX;
    input.value = t.name;
    function ok() {
      var name = input.value.trim().slice(0, SET_NAME_MAX);
      if (name) t.name = name;
      save();
      render();
      openSetList();
    }
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" && !ev.isComposing) { ev.preventDefault(); ok(); }
    });
    var wrap = document.createElement("div");
    wrap.appendChild(input);
    var hint = document.createElement("p");
    hint.className = "dialog-hint";
    hint.textContent = "OBSの対話では日本語が打てないので、メモ帳などで書いて Ctrl+V で貼り付けてね(" + SET_NAME_MAX + "文字まで)";
    wrap.appendChild(hint);
    openDialog({
      title: "プリセットの名前",
      body: wrap,
      buttons: [{ label: "決定", cls: "primary", onClick: ok }, { label: "やめる", onClick: openSetList }]
    });
    input.select();
  }

  function deleteSet(id) {
    var t = setById(id);
    if (!t) return;
    openDialog({
      title: "プリセット「" + t.name + "」を削除しますか?",
      text: "削除したプリセットは元に戻せません。" + (t.id === state.activeSetId ? "ルーレットの名前はそのまま残ります。" : ""),
      buttons: [
        { label: "削除する", cls: "danger", onClick: function () {
          state.sets = state.sets.filter(function (x) { return x.id !== id; });
          if (state.activeSetId === id) state.activeSetId = null;
          save();
          render();
          openSetList();
        } },
        { label: "やめる", onClick: openSetList }
      ]
    });
  }

  function openSetList() {
    if (spinning) return;
    var list = document.createElement("ol");
    list.className = "set-list";
    state.sets.forEach(function (t) {
      var li = document.createElement("li");
      var active = t.id === state.activeSetId;
      if (active) li.className = "active";
      var name = document.createElement("span");
      name.className = "set-name";
      name.textContent = t.name;
      name.title = t.name;
      var count = document.createElement("span");
      count.className = "set-count";
      count.textContent = active ? "使用中・" + t.names.length + "人" : t.names.length + "人";
      li.appendChild(name);
      li.appendChild(count);
      li.appendChild(smallButton("使う", "primary", function () { useSet(t.id); }, active));
      li.appendChild(smallButton("名前", "", function () { renameSet(t.id); }));
      li.appendChild(smallButton("削除", "", function () { deleteSet(t.id); }));
      list.appendChild(li);
    });
    if (state.sets.length === 0) {
      var empty = document.createElement("li");
      empty.className = "empty";
      empty.textContent = "まだプリセットがないよ。名前を入れて「今の名前を保存」で作れます";
      list.appendChild(empty);
    }
    var none = state.entries.length + state.removed.length === 0;
    openDialog({
      title: "名前プリセット(" + state.sets.length + " / " + SET_MAX + ")",
      body: list,
      buttons: [
        { label: "今の名前を保存", cls: "primary", onClick: saveAsSet, disabled: setsFull() || none,
          title: setsFull() ? "プリセットは " + SET_MAX + " 個までです。いらないものを削除してね" : none ? "先に名前を入れてね" : "" },
        state.activeSetId !== null
          ? { label: "使用をやめる", title: "名前はそのまま残し、プリセットへの書き戻しをやめる",
              onClick: function () { state.activeSetId = null; save(); render(); openSetList(); } }
          : null,
        { label: "閉じる" }
      ].filter(Boolean)
    });
  }

  // ---------- render ----------

  function render(opts) {
    opts = opts || {};
    var n = state.entries.length;

    el.entryCount.textContent = n;
    el.entryList.textContent = "";
    if (n === 0) {
      var empty = document.createElement("li");
      empty.className = "empty";
      empty.textContent = "まだ誰もいないよ";
      el.entryList.appendChild(empty);
    }
    state.entries.forEach(function (e, i) {
      var li = document.createElement("li");
      var sw = document.createElement("span");
      sw.className = "swatch";
      sw.style.background = segmentColor(i, n);
      var name = document.createElement("span");
      name.className = "name";
      name.textContent = e.name;
      name.title = e.name;
      var del = document.createElement("button");
      del.type = "button";
      del.textContent = "×";
      del.title = e.name + " を削除";
      del.disabled = spinning;
      del.addEventListener("click", function () { removeEntry(e.id); });
      li.appendChild(sw);
      li.appendChild(name);
      li.appendChild(del);
      el.entryList.appendChild(li);
    });

    el.winnerList.textContent = "";
    state.winners.forEach(function (w, i) {
      var li = document.createElement("li");
      if (opts.newWinner && i === state.winners.length - 1) li.className = "new";
      var num = document.createElement("span");
      num.className = "n";
      num.textContent = w.n + ".";
      var name = document.createElement("span");
      name.className = "name";
      name.textContent = w.name;
      li.appendChild(num);
      li.appendChild(name);
      el.winnerList.appendChild(li);
    });
    el.winnerList.scrollTop = el.winnerList.scrollHeight;

    el.spinCount.hidden = !state.options.showCount || state.spinCount === 0;
    el.spinCount.textContent = state.spinCount + "回目";

    for (var k in el.opt) el.opt[k].checked = state.options[k];
    el.winnerLabel.hidden = !state.options.congrats; // 当選表示中の切替にもすぐ反映

    el.startBtn.disabled = spinning || n === 0;
    el.addBtn.disabled = spinning;
    el.resetBtn.disabled = spinning;
    el.clearEntries.disabled = spinning || (n === 0 && state.removed.length === 0);
    var active = setById(state.activeSetId);
    el.setCurrent.textContent = active ? active.name : "使っていません";
    el.setCurrent.title = active ? active.name : "";
    el.setCurrent.classList.toggle("none", !active);
    el.setOpenBtn.disabled = spinning;
    el.wheelArea.classList.toggle("spinning", spinning);

    if (!spinning) drawWheel();
  }

  // ---------- events ----------

  el.startBtn.addEventListener("click", start);
  el.resetBtn.addEventListener("click", resetResults);
  el.addBtn.addEventListener("click", addFromInput);
  el.clearEntries.addEventListener("click", clearEntries);
  el.setOpenBtn.addEventListener("click", openSetList);
  el.dialog.addEventListener("click", function (ev) { if (ev.target === el.dialog) closeDialog(); });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && !el.dialog.hidden) closeDialog();
  });
  el.addInput.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault();
      addFromInput();
    }
  });
  Object.keys(el.opt).forEach(function (k) {
    el.opt[k].addEventListener("change", function () {
      state.options[k] = el.opt[k].checked;
      save();
      render();
    });
  });
  window.addEventListener("resize", fitStage);

  // ---------- boot ----------

  el.version.textContent = "ぽこルーレット v" + VERSION;
  load();
  render();
  fitStage();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawWheel);

  // 検証用フック(動作には影響しない)
  window.__pokoRoulette = {
    state: state,
    indexAtPointer: function () { return indexAtPointer(state.entries.length); },
    isSpinning: function () { return spinning; },
    planSpin: planSpin
  };
})();
