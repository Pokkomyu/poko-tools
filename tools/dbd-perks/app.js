/* パークスロット(Dead by Daylight)
 * file:// で動かすため module / fetch は使わない(docs/development/conventions.md)
 * パークのデータは perks-data.js(scripts/update-dbd-perks.sh で生成)
 */
(function () {
  "use strict";

  var VERSION = "0.2.1"; // tool.json と揃える
  var STAGE_W = 1920;
  var STAGE_H = 1080;
  var SLOTS = 4;
  var FONT = '"M PLUS Rounded 1c", "Kosugi Maru", "Hiragino Maru Gothic ProN", "BIZ UDPGothic", "Meiryo", system-ui, sans-serif';
  // 名前の大きさ: 「：」がある名前と 9 文字以上の名前は、2 行の方が大きく出せるなら 2 行にする。
  // 短い名前を途中で切ると読みにくい(「打ち砕か / れた希望」)ので 1 行のまま縮める
  var NAME_MAX_PX = 40;
  var NAME_MIN_PX = 16;
  var NAME_SPLIT_LEN = 9;
  var NAME_BOX_W = 186;       // .slot-in の幅(ひし形 300px の 66% = 198px)から縁取りの分を引く
  var NAME_BOX_W_ICON = 290;  // 画像を出すときは名前をひし形の外に出す(.icons .slot-in の幅 300px)
  // 回転: 名前が切り替わる間隔を SPIN_TICK_MIN → SPIN_TICK_MAX に伸ばしながら、SPIN_MS + 枠ごとの遅れで止める
  var SPIN_MS = 1400;
  var SPIN_STAGGER_MS = 380;
  var SPIN_TICK_MIN = 45;
  var SPIN_TICK_MAX = 230;
  var TOAST_MS = 1500;

  var params = new URLSearchParams(location.search);
  // ?id=<名前> で保存先を分ける(同じページを OBS に複数置くとき用。deco-poko と同じ)
  var STORAGE_KEY = "poko-dbd-perks-v1" + (params.get("id") ? ":" + params.get("id") : "");

  var byId = {};
  DBD_PERKS.forEach(function (p) { byId[p.id] = p; });

  // ---------- state ----------

  function roleState() {
    return { slots: [null, null, null, null], locked: [false, false, false, false], excluded: [] };
  }
  var PRESET_MAX = 10;   // 役割ごと
  var PRESET_NAME_MAX = 20;
  var state = { role: "k", layout: "row", showIcon: true, showFrame: true, showName: true, showChar: false, sound: true, k: roleState(), s: roleState(),
                presets: { k: [], s: [] } }; // presets: 有効 / 無効のセット { name, excluded: [外した ID] }

  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved) return;
      if (saved.role === "k" || saved.role === "s") state.role = saved.role;
      if (saved.layout === "row" || saved.layout === "diamond") state.layout = saved.layout;
      state.showIcon = saved.showIcon !== false;
      state.showFrame = saved.showFrame !== false;
      state.showName = saved.showName !== false;
      state.showChar = !!saved.showChar;
      state.sound = saved.sound !== false;
      ["k", "s"].forEach(function (r) {
        var src = saved[r] || {};
        var dst = state[r];
        for (var i = 0; i < SLOTS; i++) {
          var id = src.slots && src.slots[i];
          dst.slots[i] = byId[id] && byId[id].r === r ? id : null; // 消えたパークは空に戻す
          dst.locked[i] = !!(src.locked && src.locked[i]) && dst.slots[i] !== null;
        }
        dst.excluded = Array.isArray(src.excluded) ? src.excluded.filter(function (id) { return byId[id]; }) : [];
        var ps = saved.presets && Array.isArray(saved.presets[r]) ? saved.presets[r] : [];
        state.presets[r] = ps.filter(function (x) { return x && typeof x.name === "string" && Array.isArray(x.excluded); })
          .slice(0, PRESET_MAX).map(function (x) {
            return { name: x.name.slice(0, PRESET_NAME_MAX), excluded: x.excluded.filter(function (id) { return byId[id]; }) };
          });
      });
    } catch (e) { /* 壊れていたら初期状態 */ }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* 保存できない環境 */ }
  }

  function cur() { return state[state.role]; }
  // 抽選対象 = その役割のパークのうち、外していないもの(保存するのは外した ID なので、新しいパークは最初から対象)
  function pool() {
    var ex = {};
    cur().excluded.forEach(function (id) { ex[id] = true; });
    return DBD_PERKS.filter(function (p) { return p.r === state.role && !ex[p.id]; });
  }

  // ---------- elements ----------

  function $(id) { return document.getElementById(id); }
  var el = {
    stage: $("stage"),
    slots: $("slots"),
    slotBtns: Array.prototype.slice.call(document.querySelectorAll(".slot")),
    rows: $("rows"),
    optIcon: $("optIcon"),
    optIconLabel: $("optIconLabel"),
    optFrame: $("optFrame"),
    optName: $("optName"),
    optNameLabel: $("optNameLabel"),
    optChar: $("optChar"),
    optSound: $("optSound"),
    poolBtn: $("poolBtn"),
    poolInfo: $("poolInfo"),
    spinBtn: $("spinBtn"),
    version: $("version"),
    dataDate: $("dataDate"),
    toast: $("toast"),
    pool: $("pool"),
    poolTitle: $("poolTitle"),
    poolClose: $("poolClose"),
    poolSearch: $("poolSearch"),
    poolCount: $("poolCount"),
    poolAll: $("poolAll"),
    poolNone: $("poolNone"),
    poolList: $("poolList"),
    presetSel: $("presetSel"),
    presetLoad: $("presetLoad"),
    presetDel: $("presetDel"),
    presetName: $("presetName"),
    presetSave: $("presetSave"),
    presetNow: $("presetNow"),
    dlcFrom: $("dlcFrom"),
    dlcTo: $("dlcTo")
  };

  // ---------- layout ----------

  var isObs = typeof window.obsstudio !== "undefined";
  if (!isObs && params.get("bg") !== "transparent") document.body.classList.add("preview");

  function fitStage() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var scale = Math.min(w / STAGE_W, h / STAGE_H);
    var left = (w - STAGE_W * scale) / 2;
    var top = (h - STAGE_H * scale) / 2;
    el.stage.style.transform = "translate(" + left + "px," + top + "px) scale(" + scale + ")";
  }

  // ---------- 名前の表示 ----------

  var measureCtx = document.createElement("canvas").getContext("2d");
  function textWidth(s, px) {
    measureCtx.font = "800 " + px + "px " + FONT;
    return measureCtx.measureText(s).width;
  }
  // 2 行に分ける位置: 「：」の後 > 真ん中に近い「・」「＆」や助詞(の・が・に…)の後(「ー」や小さい字の前では切らない)
  var BREAK_AFTER = "・＆のがにをはと";
  var NO_LINE_START = "ーッャュョァィゥェォっゃゅょぁぃぅぇぉ！？、。）」";
  function splitName(s) {
    var c = s.indexOf("：");
    if (c > 0 && c < s.length - 1) return [s.slice(0, c + 1), s.slice(c + 1)];
    var mid = s.length / 2, best = -1, i;
    for (i = 2; i < s.length - 2; i++) {
      if (BREAK_AFTER.indexOf(s.charAt(i)) >= 0 && NO_LINE_START.indexOf(s.charAt(i + 1)) < 0 &&
          (best < 0 || Math.abs(i + 1 - mid) < Math.abs(best + 1 - mid))) best = i;
    }
    // 区切りが端に寄りすぎていたら使わない。区切りがなければ 1 行のまま(「マインドブ / レーカー」のように語の途中で切らない)
    if (best > 0 && Math.abs(best + 1 - mid) <= s.length / 3) return [s.slice(0, best + 1), s.slice(best + 1)];
    return null;
  }
  // 枠に収まる大きさ(上限・下限をかける前)
  function rawPx(lines) {
    var widest = Math.max.apply(null, lines.map(function (l) { return textWidth(l, 100); }));
    return (iconMode() ? NAME_BOX_W_ICON : NAME_BOX_W) / widest * 100;
  }
  function renderName(node, name) {
    node.classList.toggle("empty", !name);
    if (!name) { node.textContent = "？"; node.style.fontSize = ""; return; }
    var lines = [name];
    var px = rawPx(lines);
    if (px < NAME_MAX_PX && (name.indexOf("：") > 0 || name.length >= NAME_SPLIT_LEN)) {
      var two = splitName(name);
      var px2 = two ? Math.min(rawPx(two), NAME_MAX_PX - 4) : 0;
      if (px2 > px * 1.15) { lines = two; px = px2; }
    }
    node.textContent = "";
    lines.forEach(function (l, i) {
      if (i) node.appendChild(document.createElement("br"));
      node.appendChild(document.createTextNode(l));
    });
    node.style.fontSize = Math.max(NAME_MIN_PX, Math.min(NAME_MAX_PX, Math.floor(px))) + "px";
  }
  function charLabel(p) { return p.ch || "共通"; }

  // ---------- パークの画像 ----------
  // 画像(icons/<id>.png)は GitHub Pages 版にだけ置く。zip 版にはないので、1 枚読めるか試してから使う
  var iconsAvailable = false;
  function iconMode() { return iconsAvailable && state.showIcon; }
  function iconUrl(p) { return "icons/" + encodeURIComponent(p.id) + ".png"; }
  function probeIcons(done) {
    var first = DBD_PERKS.filter(function (p) { return p.icon; })[0];
    if (!first) { done(); return; }
    var img = new Image();
    img.onload = function () { iconsAvailable = true; done(); };
    img.onerror = function () { done(); };
    img.src = iconUrl(first);
  }
  // 回転中に画像の読み込みが追いつかないので、その役割の画像を先に読んでおく
  var preloaded = {};
  function preloadIcons() {
    if (!iconMode() || preloaded[state.role]) return;
    preloaded[state.role] = DBD_PERKS.filter(function (p) { return p.r === state.role && p.icon; }).map(function (p) {
      var img = new Image();
      img.src = iconUrl(p);
      return img;
    });
  }

  function renderSlot(i, perk) {
    var btn = el.slotBtns[i];
    var img = btn.querySelector(".slot-icon");
    var showImg = iconMode() && perk && perk.icon;
    img.hidden = !showImg;
    if (showImg && img.getAttribute("src") !== iconUrl(perk)) img.src = iconUrl(perk);
    renderName(btn.querySelector(".slot-name"), perk ? perk.ja : "");
    btn.querySelector(".slot-char").textContent = perk && state.showChar ? charLabel(perk) : "";
  }

  // ---------- 操作パネルの行 ----------

  var rowEls = [];
  function buildRows() {
    for (var i = 0; i < SLOTS; i++) {
      var li = document.createElement("li");
      li.className = "row";
      li.innerHTML =
        '<span class="row-n">' + (i + 1) + '</span>' +
        '<span class="row-name"></span>' +
        '<span class="row-btns">' +
          '<button type="button" class="btn-small copy">コピー</button>' +
          '<button type="button" class="btn-small spin1">まわす</button>' +
          '<button type="button" class="btn-small lock">固定</button>' +
        '</span>' +
        '<span class="row-sub"></span>';
      el.rows.appendChild(li);
      rowEls.push({
        li: li,
        name: li.querySelector(".row-name"),
        sub: li.querySelector(".row-sub"),
        copy: li.querySelector(".copy"),
        spin1: li.querySelector(".spin1"),
        lock: li.querySelector(".lock")
      });
      (function (i) {
        rowEls[i].copy.addEventListener("click", function () { copySlot(i); });
        rowEls[i].spin1.addEventListener("click", function () { spin([i]); });
        rowEls[i].lock.addEventListener("click", function () { toggleLock(i); });
      })(i);
    }
  }

  var spinning = false;
  function render() {
    var c = cur();
    document.querySelectorAll("[data-role]").forEach(function (b) { b.classList.toggle("on", b.dataset.role === state.role); });
    document.querySelectorAll("[data-layout]").forEach(function (b) { b.classList.toggle("on", b.dataset.layout === state.layout); });
    el.slots.className = "slots layout-" + state.layout + (iconMode() ? " icons" : "") + (state.showFrame ? "" : " no-frame");
    el.optFrame.checked = state.showFrame;
    // 名前を消せるのは画像を出しているときだけ(画像なしで消すと何も映らない)
    el.slots.classList.toggle("no-name", iconMode() && !state.showName);
    el.optName.checked = !iconMode() || state.showName;
    el.optName.disabled = !iconMode();
    el.optNameLabel.classList.toggle("off", !iconMode());
    el.optNameLabel.title = iconMode() ? "" : "名前を消せるのは「パークの画像」がオンのときだけです";
    el.optIcon.checked = iconMode();
    el.optIcon.disabled = !iconsAvailable;
    el.optIconLabel.title = iconsAvailable ? "" : "画像は Web 版(GitHub Pages)だけ。zip 版は文字だけです";
    el.optIconLabel.classList.toggle("off", !iconsAvailable);
    el.optChar.checked = state.showChar;
    el.optSound.checked = state.sound;

    var n = pool().length;
    var free = c.locked.filter(function (x) { return !x; }).length;
    var short = n < SLOTS;
    el.poolInfo.textContent = short
      ? "抽選するパークが " + n + " 個しかありません(4 個以上必要)。「パークの設定」で入れてね"
      : (state.role === "k" ? "キラー" : "サバイバー") + "のパーク " + n + " 個から抽選";
    el.poolInfo.classList.toggle("warn", short);
    el.spinBtn.disabled = spinning || short || free === 0;

    for (var i = 0; i < SLOTS; i++) {
      var perk = byId[c.slots[i]] || null;
      var btn = el.slotBtns[i];
      btn.classList.toggle("k", state.role === "k");
      btn.classList.toggle("s", state.role === "s");
      if (!btn.classList.contains("spinning")) renderSlot(i, perk);
      var r = rowEls[i];
      r.name.textContent = perk ? perk.ja : "—";
      r.sub.textContent = perk ? perk.en + " / " + charLabel(perk) : "";
      r.li.classList.toggle("locked", c.locked[i]);
      r.lock.classList.toggle("on", c.locked[i]);
      r.copy.disabled = !perk;
      r.lock.disabled = !perk || spinning;
      r.spin1.disabled = spinning || short || c.locked[i];
    }
  }

  // ---------- 抽選 ----------

  function pickRandom(list) { return list[Math.floor(Math.random() * list.length)]; }

  // targets の枠をまわす。結果は先に決めて、同じパークが 4 枠に重ならないようにする
  function spin(targets) {
    if (spinning) return;
    var c = cur();
    targets = targets.filter(function (i) { return !c.locked[i]; });
    var candidates = pool();
    if (!targets.length || candidates.length < SLOTS) return;

    var keep = {};
    for (var i = 0; i < SLOTS; i++) if (targets.indexOf(i) < 0 && c.slots[i]) keep[c.slots[i]] = true;
    var single = targets.length === 1;
    var results = {};
    targets.forEach(function (t) {
      // 1 枠だけまわすときは、今出ているパークも避ける(同じものが出ると変わらないように見える)
      var avail = candidates.filter(function (p) { return !keep[p.id] && !(single && p.id === c.slots[t]); });
      if (!avail.length) avail = candidates.filter(function (p) { return !keep[p.id]; });
      var p = pickRandom(avail);
      results[t] = p.id;
      keep[p.id] = true;
    });

    spinning = true;
    render();
    unlockAudio();
    var start = performance.now();
    var remaining = targets.length;
    targets.forEach(function (t, order) {
      var btn = el.slotBtns[t];
      var stopAt = SPIN_MS + order * SPIN_STAGGER_MS;
      btn.classList.remove("stopped");
      btn.classList.add("spinning");
      (function tick() {
        var elapsed = performance.now() - start;
        if (elapsed >= stopAt) {
          btn.classList.remove("spinning");
          void btn.offsetWidth; // アニメーションをやり直す
          btn.classList.add("stopped");
          c.slots[t] = results[t];
          renderSlot(t, byId[results[t]]);
          playStop();
          if (--remaining === 0) {
            spinning = false;
            save();
          }
          render();
          return;
        }
        renderSlot(t, pickRandom(candidates));
        if (order === 0) playTick();
        var k = elapsed / stopAt;
        setTimeout(tick, SPIN_TICK_MIN + (SPIN_TICK_MAX - SPIN_TICK_MIN) * k * k);
      })();
    });
  }

  function toggleLock(i) {
    var c = cur();
    if (!c.slots[i] || spinning) return;
    c.locked[i] = !c.locked[i];
    save();
    render();
  }

  // ---------- コピー ----------

  // ゲーム内のパーク検索に貼る用。http(TS ネットワークなど)や file:// では navigator.clipboard が使えないことがあるので execCommand に落とす
  function copyText(s) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = s;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      return Promise.resolve(ok);
    }
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(s).then(function () { return true; }, fallback);
    }
    return fallback();
  }
  function copySlot(i) {
    var perk = byId[cur().slots[i]];
    if (!perk) return;
    copyText(perk.ja).then(function (ok) {
      showToast(ok ? "「" + perk.ja + "」をコピーしました" : "コピーできませんでした");
    });
  }
  var toastTimer = 0;
  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.hidden = true; }, TOAST_MS);
  }

  // ---------- 効果音(Web Audio で合成) ----------

  var audio = null;
  function unlockAudio() {
    if (!state.sound) return;
    if (!audio) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audio = new AC();
    }
    if (audio.state === "suspended") audio.resume();
  }
  function beep(freq, dur, vol, type) {
    if (!state.sound || !audio) return;
    var t = audio.currentTime;
    var o = audio.createOscillator();
    var g = audio.createGain();
    o.type = type || "square";
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(audio.destination);
    o.start(t);
    o.stop(t + dur);
  }
  function playTick() { beep(1400, 0.03, 0.05); }
  function playStop() { beep(880, 0.12, 0.12, "triangle"); setTimeout(function () { beep(1320, 0.18, 0.1, "triangle"); }, 70); }

  // ---------- パークの設定(除外) ----------

  // DLC: DBD_DLCS は公開順(先頭は基本・共通)。パークの dlc は DBD_DLCS の id
  var dlcIndex = {};
  DBD_DLCS.forEach(function (d, i) { dlcIndex[d.id] = i; });
  function dlcOf(p) { return dlcIndex[p.dlc] !== undefined ? dlcIndex[p.dlc] : 0; }
  function dlcLabel(d) {
    var name = d.ja.replace(/^「(.*)」チャプター$/, "$1");
    return d.id === "" ? name : (d.d ? d.d.slice(0, 7) : "最近") + " " + name;
  }
  // 時期の絞り込み(開いている間だけ。役割を変えたら全期間に戻す)
  var range = { role: "", from: 0, to: DBD_DLCS.length - 1 };

  function openPool() {
    el.pool.hidden = false;
    el.poolSearch.value = "";
    el.presetName.value = "";
    range.role = "";
    picked = -1;
    renderPool();
  }
  function roleDlcs() {
    var has = {};
    DBD_PERKS.forEach(function (p) { if (p.r === state.role) has[dlcOf(p)] = true; });
    return DBD_DLCS.map(function (d, i) { return i; }).filter(function (i) { return has[i]; });
  }
  function fillRange() {
    var list = roleDlcs();
    if (range.role !== state.role) range = { role: state.role, from: list[0], to: list[list.length - 1] };
    [el.dlcFrom, el.dlcTo].forEach(function (sel, k) {
      sel.textContent = "";
      list.forEach(function (i) {
        var o = document.createElement("option");
        o.value = i;
        o.textContent = dlcLabel(DBD_DLCS[i]);
        sel.appendChild(o);
      });
      sel.value = k ? range.to : range.from;
    });
  }
  function poolVisible() {
    var q = el.poolSearch.value.trim().toLowerCase();
    return DBD_PERKS.filter(function (p) {
      if (p.r !== state.role) return false;
      var d = dlcOf(p);
      if (d < range.from || d > range.to) return false;
      if (!q) return true;
      return (p.ja + "\n" + p.en + "\n" + charLabel(p) + "\n" + DBD_DLCS[d].ja).toLowerCase().indexOf(q) >= 0;
    });
  }
  function checkboxRow(text, sub, state, onChange, cls) {
    var li = document.createElement("li");
    var label = document.createElement("label");
    if (cls) li.className = cls;
    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = state === true;
    cb.indeterminate = state === null;
    cb.addEventListener("change", function () { onChange(cb.checked); });
    var name = document.createElement("span");
    name.className = "name";
    name.textContent = text;
    var subEl = document.createElement("span");
    subEl.className = "en";
    subEl.textContent = sub;
    if (state === false) label.className = "off";
    label.appendChild(cb);
    label.appendChild(name);
    label.appendChild(subEl);
    li.appendChild(label);
    return li;
  }
  function renderPool() {
    var ex = {};
    cur().excluded.forEach(function (id) { ex[id] = true; });
    var all = DBD_PERKS.filter(function (p) { return p.r === state.role; });
    el.poolTitle.textContent = (state.role === "k" ? "キラー" : "サバイバー") + "のパーク";
    el.poolCount.textContent = (all.length - cur().excluded.length) + " / " + all.length + " 個を抽選";
    fillRange();
    renderPresets();
    el.poolList.textContent = "";
    // DLC ごとにまとめる。見出しのチェックはその DLC の(表示中の)パークをまとめて切り替える
    var byDlc = {};
    poolVisible().forEach(function (p) { (byDlc[dlcOf(p)] = byDlc[dlcOf(p)] || []).push(p); });
    var groups = Object.keys(byDlc).map(Number).sort(function (a, b) { return a - b; })
      .map(function (d) { return { d: d, perks: byDlc[d] }; });
    groups.forEach(function (g) {
      var on = g.perks.filter(function (p) { return !ex[p.id]; }).length;
      var ids = g.perks.map(function (p) { return p.id; });
      var dl = DBD_DLCS[g.d];
      el.poolList.appendChild(checkboxRow(dl.ja, (dl.d || (dl.id ? "公開日不明" : "")) + "  " + on + " / " + g.perks.length,
        on === g.perks.length ? true : on === 0 ? false : null,
        function (checked) { setExcluded(ids, !checked); }, "grp"));
      g.perks.forEach(function (p) {
        el.poolList.appendChild(checkboxRow(p.ja, p.en + " / " + charLabel(p), !ex[p.id],
          function (checked) { setExcluded([p.id], !checked); }));
      });
    });
    if (!groups.length) {
      var li = document.createElement("li");
      li.className = "empty";
      li.textContent = "見つかりません";
      el.poolList.appendChild(li);
    }
  }
  function setExcluded(ids, off) {
    var c = cur();
    var set = {};
    c.excluded.forEach(function (id) { set[id] = true; });
    ids.forEach(function (id) { if (off) set[id] = true; else delete set[id]; });
    c.excluded = Object.keys(set);
    save();
    renderPool();
    render();
  }

  // ---------- プリセット(有効 / 無効のセット。役割ごと) ----------

  function sameSet(a, b) {
    if (a.length !== b.length) return false;
    var m = {};
    a.forEach(function (id) { m[id] = true; });
    return b.every(function (id) { return m[id]; });
  }
  function presets() { return state.presets[state.role]; }
  function presetIndexByName(name) {
    for (var i = 0; i < presets().length; i++) if (presets()[i].name === name) return i;
    return -1;
  }
  var delArmed = -1, delTimer = 0;
  var picked = -1; // 一覧で選んだプリセット。選んでいなければ今の設定と同じものを選んでおく
  function renderPresets() {
    var ps = presets();
    el.presetSel.textContent = "";
    if (!ps.length) {
      var o = document.createElement("option");
      o.value = "";
      o.textContent = "(まだありません)";
      el.presetSel.appendChild(o);
    }
    ps.forEach(function (x, i) {
      var o = document.createElement("option");
      o.value = String(i);
      o.textContent = x.name + "(" + (DBD_PERKS.filter(function (p) { return p.r === state.role; }).length - x.excluded.length) + " 個)";
      el.presetSel.appendChild(o);
    });
    var match = -1;
    ps.forEach(function (x, i) { if (match < 0 && sameSet(x.excluded, cur().excluded)) match = i; });
    if (picked >= ps.length) picked = -1;
    if (picked >= 0) el.presetSel.value = String(picked);
    else if (match >= 0) el.presetSel.value = String(match);
    el.presetNow.textContent = match >= 0 ? "使用中: " + ps[match].name : ps.length ? "今の設定はどのプリセットとも違います" : "";
    el.presetLoad.disabled = el.presetDel.disabled = !ps.length;
    el.presetDel.textContent = delArmed >= 0 ? "本当に削除?" : "削除";
    el.presetDel.classList.toggle("on", delArmed >= 0);
    var name = el.presetName.value.trim();
    var over = name && presetIndexByName(name) >= 0;
    el.presetSave.textContent = over ? "上書き保存" : "今の設定を保存";
    el.presetSave.disabled = !over && ps.length >= PRESET_MAX;
    el.presetSave.title = el.presetSave.disabled ? "プリセットは " + PRESET_MAX + " 個まで。上書きするか、削除してね" : "";
  }
  function savePreset() {
    var ps = presets();
    var name = el.presetName.value.trim().slice(0, PRESET_NAME_MAX);
    var n = 1;
    while (!name) { if (presetIndexByName("プリセット" + n) < 0) name = "プリセット" + n; n++; }
    var i = presetIndexByName(name);
    var item = { name: name, excluded: cur().excluded.slice() };
    if (i >= 0) ps[i] = item;
    else if (ps.length < PRESET_MAX) ps.push(item);
    else return;
    el.presetName.value = "";
    picked = -1;
    save();
    renderPool();
    showToast("プリセット「" + name + "」を保存しました");
  }
  function loadPreset() {
    var x = presets()[Number(el.presetSel.value)];
    if (!x) return;
    cur().excluded = x.excluded.filter(function (id) { return byId[id] && byId[id].r === state.role; });
    picked = -1;
    save();
    renderPool();
    render();
    showToast("プリセット「" + x.name + "」を呼び出しました");
  }
  // confirm() は OBS の対話で出ないので、2 回押しで消す
  function deletePreset() {
    var i = Number(el.presetSel.value);
    if (!presets()[i]) return;
    clearTimeout(delTimer);
    if (delArmed !== i) {
      delArmed = i;
      delTimer = setTimeout(function () { delArmed = -1; renderPresets(); }, 3000);
      renderPresets();
      return;
    }
    var name = presets()[i].name;
    presets().splice(i, 1);
    delArmed = -1;
    picked = -1;
    save();
    renderPool();
    showToast("プリセット「" + name + "」を削除しました");
  }

  // ---------- events ----------

  document.querySelectorAll("[data-role]").forEach(function (b) {
    b.addEventListener("click", function () {
      if (spinning) return;
      state.role = b.dataset.role;
      picked = -1;
      save();
      preloadIcons();
      render();
      if (!el.pool.hidden) renderPool();
    });
  });
  document.querySelectorAll("[data-layout]").forEach(function (b) {
    b.addEventListener("click", function () { state.layout = b.dataset.layout; save(); render(); });
  });
  el.slotBtns.forEach(function (b, i) { b.addEventListener("click", function () { spin([i]); }); });
  el.spinBtn.addEventListener("click", function () { spin([0, 1, 2, 3]); });
  el.optIcon.addEventListener("change", function () { state.showIcon = el.optIcon.checked; save(); preloadIcons(); render(); });
  el.optFrame.addEventListener("change", function () { state.showFrame = el.optFrame.checked; save(); render(); });
  el.optName.addEventListener("change", function () { state.showName = el.optName.checked; save(); render(); });
  el.optChar.addEventListener("change", function () { state.showChar = el.optChar.checked; save(); render(); });
  el.optSound.addEventListener("change", function () { state.sound = el.optSound.checked; save(); });
  el.poolBtn.addEventListener("click", openPool);
  el.poolClose.addEventListener("click", function () { el.pool.hidden = true; });
  el.poolSearch.addEventListener("input", renderPool);
  el.dlcFrom.addEventListener("change", function () {
    range.from = Number(el.dlcFrom.value);
    if (range.to < range.from) range.to = range.from;
    renderPool();
  });
  el.dlcTo.addEventListener("change", function () {
    range.to = Number(el.dlcTo.value);
    if (range.from > range.to) range.from = range.to;
    renderPool();
  });
  el.presetSel.addEventListener("change", function () { picked = Number(el.presetSel.value); delArmed = -1; renderPresets(); });
  el.presetName.addEventListener("input", renderPresets);
  el.presetSave.addEventListener("click", savePreset);
  el.presetLoad.addEventListener("click", loadPreset);
  el.presetDel.addEventListener("click", deletePreset);
  el.poolAll.addEventListener("click", function () { setExcluded(poolVisible().map(function (p) { return p.id; }), false); });
  el.poolNone.addEventListener("click", function () { setExcluded(poolVisible().map(function (p) { return p.id; }), true); });
  window.addEventListener("resize", fitStage);

  // ---------- init ----------

  load();
  buildRows();
  el.version.textContent = "パークスロット v" + VERSION;
  el.dataDate.textContent = "パーク情報: " + DBD_PERKS_DATE + " 時点";
  fitStage();
  render();
  probeIcons(function () { preloadIcons(); render(); });
  // 丸ゴシックの読み込みが遅れると幅の測り直しが要る
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
})();
