/* ぽこルーレット
 * file:// で動かすため module / fetch は使わない(docs/development/conventions.md)
 */
(function () {
  "use strict";

  var VERSION = "0.4.0"; // tool.json と揃える
  var EDITION = "カラー版"; // 有償版(edition/plus ブランチ)。無料版には無い
  var STORAGE_KEY = "poko-tools.roulette.v1";
  var STAGE_W = 1920;
  var STAGE_H = 1080;
  var WINNER_SHOW_MS = 5000;
  var TWO_PI = Math.PI * 2;
  // ---------- 配色(カラー版) 定義 ----------
  // 配信に映るパーツ。id は CSS 変数 --c-<id> にもなる(style.css)
  var PART_GROUPS = [
    { name: "ルーレット盤", parts: [
      ["wheel-1", "盤の色 1"], ["wheel-2", "盤の色 2"], ["wheel-3", "盤の色 3"],
      ["wheel-4", "盤の色 4"], ["wheel-5", "盤の色 5"], ["wheel-6", "盤の色 6"],
      ["wheel-text", "名前の文字"], ["wheel-text-outline", "名前のふち"],
      ["wheel-line", "枠線・仕切り"], ["wheel-center", "中心の飾り"]] },
    { name: "針", parts: [["pointer", "針"], ["pointer-line", "針の枠"]] },
    { name: "当選表示", parts: [
      ["winner-label-bg", "「おめでとう!」の背景"], ["winner-name-bg", "名前の背景"],
      ["winner-text", "文字"], ["winner-border", "枠"], ["winner-shadow", "影"]] },
    { name: "当たった人の一覧", parts: [
      ["list-title-bg", "見出しの背景"], ["list-title-text", "見出しの文字"], ["list-bg", "背景"],
      ["list-text", "文字"], ["list-number", "番号"], ["list-border", "枠"]] },
    { name: "回数表示", parts: [["count-bg", "背景"], ["count-text", "文字"], ["count-border", "枠"]] },
    { name: "背景", parts: [["preview-bg", "ブラウザで開いた時の背景(OBSでは透明)"]] }
  ];
  var PART_IDS = [];
  var PART_NAME = {};
  PART_GROUPS.forEach(function (g) {
    g.parts.forEach(function (p) { PART_IDS.push(p[0]); PART_NAME[p[0]] = p[1] === g.name ? p[1] : g.name + " / " + p[1]; });
  });

  // プリセットは少ない指定(盤6色・線の色・星・紙・アクセント・濃いアクセント・背景)から全パーツを組み立てる
  function makePreset(id, name, d) {
    var c = {};
    for (var i = 0; i < 6; i++) c["wheel-" + (i + 1)] = d.wheel[i];
    c["wheel-text"] = d.text || d.ink;
    c["wheel-text-outline"] = d.outline || "#ffffff";
    c["wheel-line"] = d.ink;
    c["wheel-center"] = d.star;
    c["pointer"] = d.star;
    c["pointer-line"] = d.ink;
    c["winner-label-bg"] = d.star;
    c["winner-name-bg"] = d.paper;
    c["winner-text"] = d.ink;
    c["winner-border"] = d.ink;
    c["winner-shadow"] = d.deep;
    c["list-title-bg"] = d.accent;
    c["list-title-text"] = d.titleText || d.ink;
    c["list-bg"] = d.paper;
    c["list-text"] = d.ink;
    c["list-number"] = d.deep;
    c["list-border"] = d.ink;
    c["count-bg"] = d.paper;
    c["count-text"] = d.ink;
    c["count-border"] = d.ink;
    c["preview-bg"] = d.bg;
    return { id: id, name: name, colors: c };
  }
  var PRESETS = [
    // 盤の 6 色はぽこ指定(2026-10-02)。それ以外(線・文字・針・見出し)は「ぽこ」と同じ。紺の項目も白いふちで読める
    makePreset("uchuneko", "宇宙猫", { wheel: ["#ff96c8", "#fffef4", "#3d3da5", "#ff62c9", "#b47eff", "#ffff4a"],
      ink: "#3b2b45", star: "#ffe066", paper: "#ffffff", accent: "#ff8fc7", deep: "#ff5fae", bg: "#ffd0f5" }),
    makePreset("poko", "ぽこ", { wheel: ["#ff8fc7", "#ffffff", "#6cb8ff", "#ff6b6b", "#b98cff", "#ffe066"],
      ink: "#3b2b45", star: "#ffe066", paper: "#ffffff", accent: "#ff8fc7", deep: "#ff5fae", bg: "#ffd0f5" }),
    makePreset("pastel", "パステル", { wheel: ["#ffd1dc", "#fff5ba", "#c9ecff", "#d4f8dc", "#e6d6ff", "#ffe0c7"],
      ink: "#7b6b8f", star: "#fff5ba", paper: "#fffdf7", accent: "#ffd1dc", deep: "#f49ab5", bg: "#fdf3ff" }),
    makePreset("vivid", "ビビッド", { wheel: ["#ff3d7f", "#ffd400", "#00c2ff", "#ff7a00", "#9b5cff", "#00e38c"],
      ink: "#141a3a", text: "#ffffff", outline: "#141a3a", star: "#ffd400", paper: "#ffffff", accent: "#ff3d7f", titleText: "#ffffff", deep: "#c4005a", bg: "#1e2250" }),
    makePreset("sakura", "さくら", { wheel: ["#ffb7d5", "#fff4f8", "#ff8fb8", "#ffdce9", "#f7a1c4", "#ffffff"],
      ink: "#8a3a5c", star: "#fff1a8", paper: "#fff6fa", accent: "#ffb7d5", deep: "#e8699b", bg: "#ffe4ee" }),
    makePreset("umi", "うみ", { wheel: ["#6cb8ff", "#e0f4ff", "#2f8be6", "#9fe3ff", "#4fd1c5", "#ffffff"],
      ink: "#163a63", star: "#ffe066", paper: "#f2fbff", accent: "#6cb8ff", deep: "#2f8be6", bg: "#bfe3ff" }),
    makePreset("yumekawa", "ゆめかわ", { wheel: ["#ffb3ec", "#b3e0ff", "#d6b3ff", "#fff3b3", "#b3ffe6", "#ffffff"],
      ink: "#7a4fa3", star: "#fff3b3", paper: "#fffafc", accent: "#ffb3ec", deep: "#c77dd6", bg: "#e9d8ff" }),
    makePreset("mono", "モノトーン", { wheel: ["#ffffff", "#d9d9d9", "#8c8c8c", "#f2f2f2", "#b3b3b3", "#666666"],
      ink: "#1a1a1a", star: "#ffffff", paper: "#ffffff", accent: "#cfcfcf", deep: "#555555", bg: "#dcdcdc" }),
    makePreset("halloween", "ハロウィン", { wheel: ["#ff8c1a", "#ffe066", "#8e4dc9", "#2b2b2b", "#ffffff", "#ff6b6b"],
      ink: "#1b0f2b", text: "#ffffff", outline: "#1b0f2b", star: "#ffe066", paper: "#fff3e0", accent: "#ff8c1a", deep: "#8e4dc9", bg: "#2b1a3d" })
  ];
  var MAX_CUSTOM = 5;        // 保存できる配色の数
  var colors = PRESETS[0].colors; // 今の配色(applyTheme で差し替える)
  var COLORS = PRESETS[0].colors; // 盤の6色は colors["wheel-N"] を使う(drawWheel 用に配列化する)
  var FONT = '"M PLUS Rounded 1c", "Kosugi Maru", "Hiragino Maru Gothic ProN", "BIZ UDPGothic", "Meiryo", system-ui, sans-serif';
  var MAX_NAME_LENGTH = 40;
  // 針のプルプル: 項目の境目が針を通るたびに弾かれ、すぐ減衰する
  // 弾いた揺れは約0.5秒で減衰する。最後の境目はじわじわ区間の途中で通るので、止まる頃には収まっている
  var KICK_DEG = 5;
  var KICK_DECAY_MS = 80;
  var KICK_PERIOD_MS = 160;
  var KICK_FULL_SPEED = 6;   // rad/s。これより遅いと弾く強さを弱める
  var KICK_MIN_RATIO = 0.3;
  // 回転: 減速(MAIN)のあと、最後の境目の手前から「じわじわ」(CREEP)進んで止まる
  var MAIN_MS_MIN = 3500, MAIN_MS_RANGE = 2000;
  var CREEP_MS_MIN = 2200, CREEP_MS_RANGE = 1000;
  var CREEP_LEAD_SEG = 0.5;                  // 最後の境目の何項目ぶん手前からじわじわ始めるか
  var CREEP_LEAD_MIN = 15 * Math.PI / 180;   // 項目が多い時も、名前がいくつか通り過ぎるように
  var CREEP_LEAD_MAX = 20 * Math.PI / 180;   // 項目が少なくて1項目が大きい時の上限
  var CREEP_MAX = 50 * Math.PI / 180;        // じわじわ区間の最大角度(これ以上だと速く見える)
  // 中心の飾りと重ならないよう、盤の中の文字を上にずらす量(半径比)
  var OFF_CENTER_Y = 0.35;

  // ---------- state ----------

  var state = {
    entries: [],   // {id, name}
    removed: [],   // 「当たったら消す」で盤から外した人。結果クリアで戻す
    winners: [],   // {n, name}
    spinCount: 0,
    lastWinnerId: null,
    theme: PRESETS[0].id,
    customThemes: [], // {id, name, colors} 最大 MAX_CUSTOM 件
    options: { removeOnWin: false, noRepeat: false, shuffleEach: false, showCount: false, sound: true, fanfare: true, congrats: true }
  };

  var rotation = 0;
  var spinning = false;
  var shuffling = false; // シャッフル演出中(回転と同じく操作を止める)
  var pendingRemovalId = null;
  var winnerTimer = null;
  var nextId = 1;

  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved) return;
      state.entries = Array.isArray(saved.entries) ? saved.entries : [];
      state.removed = Array.isArray(saved.removed) ? saved.removed : [];
      state.winners = Array.isArray(saved.winners) ? saved.winners : [];
      state.spinCount = saved.spinCount | 0;
      state.lastWinnerId = saved.lastWinnerId || null;
      if (Array.isArray(saved.customThemes)) {
        state.customThemes = saved.customThemes.filter(function (t) {
          return t && typeof t.id === "string" && t.id.indexOf("custom-") === 0 && t.colors;
        }).slice(0, MAX_CUSTOM).map(function (t) {
          var c = {};
          PART_IDS.forEach(function (id) { c[id] = isHex(t.colors[id]) ? normHex(t.colors[id]) : PRESETS[0].colors[id]; });
          return { id: t.id, name: String(t.name || "新規配色").slice(0, 12), colors: c };
        });
      }
      if (findTheme(saved.theme)) state.theme = saved.theme;
      for (var k in state.options) {
        if (saved.options && typeof saved.options[k] === "boolean") state.options[k] = saved.options[k];
      }
      state.entries.concat(state.removed).forEach(function (e) {
        if (e.id >= nextId) nextId = e.id + 1;
      });
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
    shuffleBtn: $("shuffleBtn"),
    addInput: $("addInput"),
    addBtn: $("addBtn"),
    startBtn: $("startBtn"),
    resetBtn: $("resetBtn"),
    version: $("version"),
    tabs: { names: $("tabNames"), colors: $("tabColors") },
    panels: { names: $("panelNames"), colors: $("panelColors") },
    presetList: $("presetList"),
    customList: $("customList"),
    themeHint: $("themeHint"),
    partList: $("partList"),
    pickerSwatch: $("pickerSwatch"),
    pickerPart: $("pickerPart"),
    themeName: $("themeName"),
    swatchGrid: $("swatchGrid"),
    svCanvas: $("svCanvas"),
    hueCanvas: $("hueCanvas"),
    rgb: [$("rgbR"), $("rgbG"), $("rgbB")],
    hexInput: $("hexInput"),
    opt: {
      removeOnWin: $("optRemoveOnWin"),
      noRepeat: $("optNoRepeat"),
      shuffleEach: $("optShuffleEach"),
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

  var stageScale = 1;
  function fitStage() {
    stageScale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
    var left = (window.innerWidth - STAGE_W * stageScale) / 2;
    var top = (window.innerHeight - STAGE_H * stageScale) / 2;
    el.stage.style.transform = "translate(" + left + "px," + top + "px) scale(" + stageScale + ")";
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

  // ---------- 色ユーティリティ ----------

  function isHex(v) { return typeof v === "string" && /^#?[0-9a-fA-F]{6}$/.test(v); }
  function normHex(v) { return "#" + v.replace("#", "").toLowerCase(); }
  function hexToRgb(h) {
    h = h.replace("#", "");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(function (v) {
      v = Math.max(0, Math.min(255, Math.round(v)));
      return (v < 16 ? "0" : "") + v.toString(16);
    }).join("");
  }
  function mixHex(a, b, t) {
    var x = hexToRgb(a), y = hexToRgb(b);
    return rgbToHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
  }
  function rgbaOf(hex, alpha) {
    var c = hexToRgb(hex);
    return "rgba(" + c[0] + ", " + c[1] + ", " + c[2] + ", " + alpha + ")";
  }
  // h: 0-360, s/v: 0-1
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, h = 0;
    if (d > 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h: h, s: max === 0 ? 0 : d / max, v: max };
  }
  function hsvToRgb(h, s, v) {
    var c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c, r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  }
  function hsvToHex(h, s, v) { var c = hsvToRgb(h, s, v); return rgbToHex(c[0], c[1], c[2]); }

  // ---------- 配色(カラー版) ----------

  function findTheme(id) {
    var i;
    for (i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === id) return PRESETS[i];
    for (i = 0; i < state.customThemes.length; i++) if (state.customThemes[i].id === id) return state.customThemes[i];
    return null;
  }
  function activeTheme() { return findTheme(state.theme) || PRESETS[0]; }
  function isCustom(t) { return t.id.indexOf("custom-") === 0; }

  // 盤の色は canvas で描くので配列に取り出し、それ以外は CSS 変数 --c-<part> で切り替える
  function applyTheme() {
    colors = activeTheme().colors;
    COLORS = PART_IDS.slice(0, 6).map(function (id) { return colors[id]; });
    var root = document.documentElement.style;
    PART_IDS.forEach(function (id) { root.setProperty("--c-" + id, colors[id]); });
    root.setProperty("--c-pointer-shine", mixHex(colors["pointer"], "#ffffff", 0.65));
    root.setProperty("--c-list-rule", rgbaOf(colors["list-text"], 0.25));
  }

  function selectTheme(id) {
    if (!findTheme(id)) return;
    state.theme = id;
    applyTheme();
    setHint("");
    save();
    render();
  }

  function newCustomName() {
    for (var n = 1; ; n++) {
      var name = "新規配色" + n;
      if (!state.customThemes.some(function (t) { return t.name === name; })) return name;
    }
  }

  // プリセットを編集した時に、そのコピーを「新規配色N」として保存して選択する。枠が無ければ null
  function forkToCustom() {
    if (state.customThemes.length >= MAX_CUSTOM) return null;
    var src = activeTheme();
    var c = {};
    PART_IDS.forEach(function (id) { c[id] = src.colors[id]; });
    var t = { id: "custom-" + Date.now().toString(36), name: newCustomName(), colors: c };
    state.customThemes.push(t);
    state.theme = t.id;
    return t;
  }

  function setPartColor(part, hex) {
    if (!isHex(hex)) return;
    hex = normHex(hex);
    var t = activeTheme();
    if (t.colors[part] === hex) return;
    if (!isCustom(t)) {
      t = forkToCustom();
      if (!t) {
        setHint("保存できる配色は" + MAX_CUSTOM + "つまでです。「保存した配色」の × でいらないものを消してね", true);
        return;
      }
      setHint("「" + t.name + "」として保存しました。名前は右上の欄で変えられます");
    }
    t.colors[part] = hex;
    applyTheme();
    save();
    render();
  }

  function deleteCustom(id) {
    state.customThemes = state.customThemes.filter(function (t) { return t.id !== id; });
    if (state.theme === id) state.theme = PRESETS[0].id;
    applyTheme();
    setHint("");
    save();
    render();
  }

  function renameCustom(name) {
    var t = activeTheme();
    if (!isCustom(t)) return;
    name = name.trim().slice(0, 12);
    if (name) t.name = name;
    save();
    renderThemeLists();
  }

  function setHint(text, warn) {
    el.themeHint.textContent = text;
    el.themeHint.classList.toggle("warn", !!warn);
  }

  // ---------- 配色の UI ----------

  var picker = { part: "wheel-1", h: 330, s: 0.44, v: 1 }; // 編集中のパーツと、パレットの位置
  var currentTab = "names";

  function showTab(name) {
    currentTab = name;
    for (var k in el.tabs) {
      el.tabs[k].classList.toggle("active", k === name);
      el.tabs[k].setAttribute("aria-selected", k === name ? "true" : "false");
      el.panels[k].hidden = k !== name;
    }
  }

  function themeChip(t, deletable) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme";
    btn.dataset.id = t.id;
    btn.title = t.name;
    var sw = document.createElement("span");
    sw.className = "theme-swatches";
    for (var i = 1; i <= 6; i++) {
      var s = document.createElement("i");
      s.style.background = t.colors["wheel-" + i];
      sw.appendChild(s);
    }
    var name = document.createElement("span");
    name.className = "theme-name";
    name.textContent = t.name;
    btn.appendChild(sw);
    btn.appendChild(name);
    btn.addEventListener("click", function () { selectTheme(t.id); });
    if (deletable) {
      var del = document.createElement("span");
      del.className = "del";
      del.setAttribute("role", "button");
      del.title = t.name + " を削除";
      del.textContent = "×";
      del.addEventListener("click", function (ev) { ev.stopPropagation(); deleteCustom(t.id); });
      btn.appendChild(del);
    }
    return btn;
  }

  // 代表色: 左列がグレー、残りは色相ごとに薄い→濃い
  var SWATCH_HUES = [0, 30, 55, 120, 175, 210, 260, 300, 335];
  var SWATCH_GRAYS = ["#ffffff", "#d9d9d9", "#a6a6a6", "#737373", "#404040", "#000000"];
  function swatchColors() {
    var rows = [];
    for (var r = 0; r < 6; r++) {
      var row = [SWATCH_GRAYS[r]];
      SWATCH_HUES.forEach(function (h) {
        var sv = [[0.25, 1], [0.5, 1], [0.85, 1], [1, 0.85], [1, 0.6], [1, 0.4]][r];
        row.push(hsvToHex(h, sv[0], sv[1]));
      });
      rows.push(row);
    }
    return rows;
  }

  function buildThemeUI() {
    el.presetList.textContent = "";
    PRESETS.forEach(function (t) { el.presetList.appendChild(themeChip(t, false)); });

    el.partList.textContent = "";
    PART_GROUPS.forEach(function (g) {
      var head = document.createElement("li");
      head.className = "group";
      head.textContent = g.name;
      el.partList.appendChild(head);
      g.parts.forEach(function (p) {
        var li = document.createElement("li");
        li.className = "part";
        li.dataset.id = p[0];
        var sw = document.createElement("span");
        sw.className = "swatch";
        var label = document.createElement("span");
        label.className = "label";
        label.textContent = p[1];
        label.title = p[1];
        li.appendChild(sw);
        li.appendChild(label);
        li.addEventListener("click", function () { selectPart(p[0]); });
        el.partList.appendChild(li);
      });
    });

    el.swatchGrid.textContent = "";
    swatchColors().forEach(function (row) {
      row.forEach(function (hex) {
        var b = document.createElement("button");
        b.type = "button";
        b.dataset.hex = hex;
        b.title = hex;
        b.style.background = hex;
        b.addEventListener("click", function () { setPartColor(picker.part, hex); });
        el.swatchGrid.appendChild(b);
      });
    });

    bindCanvasDrag(el.svCanvas, function (x, y) {
      picker.s = x;
      picker.v = 1 - y;
      setPartColor(picker.part, hsvToHex(picker.h, picker.s, picker.v));
      drawPicker();
    });
    bindCanvasDrag(el.hueCanvas, function (x) {
      picker.h = Math.min(359.9, x * 360);
      // 無彩色のままだと色相を変えても見た目が変わらないので、少し色を付ける
      if (picker.s === 0) picker.s = 1;
      if (picker.v === 0) picker.v = 1;
      setPartColor(picker.part, hsvToHex(picker.h, picker.s, picker.v));
      drawPicker();
    });

    el.rgb.forEach(function (input) {
      input.addEventListener("change", function () {
        var v = el.rgb.map(function (i) { return Math.max(0, Math.min(255, parseInt(i.value, 10) || 0)); });
        setPartColor(picker.part, rgbToHex(v[0], v[1], v[2]));
        renderPicker(); // 範囲外の入力を正規化して表示し直す
      });
    });
    el.hexInput.addEventListener("change", function () {
      if (isHex(el.hexInput.value)) setPartColor(picker.part, el.hexInput.value);
      renderPicker();
    });
    el.hexInput.addEventListener("keydown", function (ev) { if (ev.key === "Enter") el.hexInput.blur(); });
    el.themeName.addEventListener("change", function () { renameCustom(el.themeName.value); });
    el.themeName.addEventListener("keydown", function (ev) { if (ev.key === "Enter") el.themeName.blur(); });

    Object.keys(el.tabs).forEach(function (k) {
      el.tabs[k].addEventListener("click", function () { showTab(k); });
    });
  }

  // canvas 上のドラッグを 0〜1 の座標で渡す(ステージは拡大縮小されるので表示サイズで割る)
  function bindCanvasDrag(canvas, onPoint) {
    var dragging = false;
    function point(ev) {
      var r = canvas.getBoundingClientRect();
      onPoint(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)),
              Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height)));
    }
    canvas.addEventListener("pointerdown", function (ev) {
      dragging = true;
      canvas.setPointerCapture(ev.pointerId);
      point(ev);
      ev.preventDefault();
    });
    canvas.addEventListener("pointermove", function (ev) { if (dragging) point(ev); });
    function stop() { dragging = false; }
    canvas.addEventListener("pointerup", stop);
    canvas.addEventListener("pointercancel", stop);
  }

  function selectPart(id) {
    picker.part = id;
    syncPickerToColor();
    renderPicker();
    renderPartList();
  }

  // 今のパーツの色からパレットの位置を決める。灰色の時は色相を保つ(動かしても意味が無いため)
  function syncPickerToColor() {
    var c = hexToRgb(colors[picker.part]);
    var hsv = rgbToHsv(c[0], c[1], c[2]);
    if (hsv.s > 0) picker.h = hsv.h;
    picker.s = hsv.s;
    picker.v = hsv.v;
  }

  function drawPicker() {
    var cv = el.svCanvas, g = cv.getContext("2d"), w = cv.width, h = cv.height;
    g.fillStyle = hsvToHex(picker.h, 1, 1);
    g.fillRect(0, 0, w, h);
    var gx = g.createLinearGradient(0, 0, w, 0);
    gx.addColorStop(0, "rgba(255,255,255,1)");
    gx.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gx;
    g.fillRect(0, 0, w, h);
    var gy = g.createLinearGradient(0, 0, 0, h);
    gy.addColorStop(0, "rgba(0,0,0,0)");
    gy.addColorStop(1, "rgba(0,0,0,1)");
    g.fillStyle = gy;
    g.fillRect(0, 0, w, h);
    var x = picker.s * w, y = (1 - picker.v) * h;
    g.beginPath();
    g.arc(x, y, 6, 0, TWO_PI);
    g.lineWidth = 3; g.strokeStyle = "#ffffff"; g.stroke();
    g.lineWidth = 1; g.strokeStyle = "#000000"; g.stroke();

    var hc = el.hueCanvas, hg = hc.getContext("2d"), hw = hc.width, hh = hc.height;
    var grad = hg.createLinearGradient(0, 0, hw, 0);
    for (var i = 0; i <= 6; i++) grad.addColorStop(i / 6, hsvToHex(i * 60 % 360, 1, 1));
    hg.fillStyle = grad;
    hg.fillRect(0, 0, hw, hh);
    var hx = picker.h / 360 * hw;
    hg.fillStyle = "#ffffff";
    hg.fillRect(hx - 3, 0, 6, hh);
    hg.fillStyle = "#000000";
    hg.fillRect(hx - 1, 0, 2, hh);
  }

  function renderPicker() {
    var hex = colors[picker.part];
    el.pickerSwatch.style.background = hex;
    el.pickerPart.textContent = PART_NAME[picker.part];
    var c = hexToRgb(hex);
    if (document.activeElement !== el.rgb[0] && document.activeElement !== el.rgb[1] && document.activeElement !== el.rgb[2]) {
      el.rgb.forEach(function (input, i) { input.value = c[i]; });
    }
    if (document.activeElement !== el.hexInput) el.hexInput.value = hex;
    Array.prototype.forEach.call(el.swatchGrid.children, function (b) { b.classList.toggle("active", b.dataset.hex === hex); });
    drawPicker();
  }

  function renderPartList() {
    Array.prototype.forEach.call(el.partList.children, function (li) {
      if (!li.dataset.id) return;
      li.classList.toggle("active", li.dataset.id === picker.part);
      li.firstChild.style.background = colors[li.dataset.id];
    });
  }

  function renderThemeLists() {
    var t = activeTheme();
    Array.prototype.forEach.call(el.presetList.children, function (btn) {
      btn.classList.toggle("active", btn.dataset.id === state.theme);
    });
    el.customList.textContent = "";
    if (state.customThemes.length === 0) {
      var empty = document.createElement("span");
      empty.className = "empty";
      empty.textContent = "プリセットの色を変えると、ここに自動で保存されます(" + MAX_CUSTOM + "つまで)";
      el.customList.appendChild(empty);
    }
    state.customThemes.forEach(function (c) {
      var chip = themeChip(c, true);
      chip.classList.toggle("active", c.id === state.theme);
      el.customList.appendChild(chip);
    });
    el.themeName.hidden = !isCustom(t);
    if (document.activeElement !== el.themeName) el.themeName.value = isCustom(t) ? t.name : "";
  }

  function renderThemeUI() {
    renderThemeLists();
    renderPartList();
    syncPickerToColor();
    renderPicker();
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
      ctx.fillStyle = mixHex(colors["wheel-line"], "#ffffff", 0.9);
      ctx.fill();
      ctx.fillStyle = colors["wheel-line"];
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
          ctx.strokeStyle = colors["wheel-line"];
          ctx.stroke();
        }
      }

      // 名前(中心から外向き)
      var fontSize = Math.max(14, Math.min(40, (TWO_PI * r * 0.55) / n / k * 0.9)) * k;
      if (n === 1) fontSize = 48 * k;
      ctx.font = "800 " + fontSize + "px " + FONT;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      for (var j = 0; j < n; j++) {
        var mid = -Math.PI / 2 + rotation + (j + 0.5) * seg;
        var label = fitText(state.entries[j].name, r * 0.66);
        ctx.save();
        ctx.translate(c, c);
        ctx.rotate(n === 1 ? 0 : mid);
        // 1人だけの時は中心の飾りと重ならないよう上に置く
        var x = n === 1 ? ctx.measureText(label).width / 2 : r * 0.9;
        var y = n === 1 ? -r * OFF_CENTER_Y : 0;
        ctx.lineWidth = fontSize * 0.28;
        ctx.strokeStyle = colors["wheel-text-outline"];
        ctx.strokeText(label, x, y);
        ctx.fillStyle = colors["wheel-text"];
        ctx.fillText(label, x, y);
        ctx.restore();
      }
    }

    // 外枠と中心
    ctx.beginPath();
    ctx.arc(c, c, r, 0, TWO_PI);
    ctx.lineWidth = 16 * k;
    ctx.strokeStyle = colors["wheel-line"];
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(c, c, 26 * k, 0, TWO_PI);
    ctx.fillStyle = colors["wheel-center"];
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

  function playShuffle() {
    if (!state.options.sound) return;
    tone(700 + randInt(500), 0, 0.05, "square", 0.08);
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

  // 回転の動き(経過ms → {x: 進んだ角度, v: 角速度 rad/s})を作る
  // MAIN: easeOutQuart に一定速度を少し混ぜ、CREEP の初速とつなぐ
  // CREEP: 距離 creep を easeOutQuad で進む(初速 2*creep/T から 0 へ)
  function makeSpinCurve(delta, creep, mainMs, creepMs) {
    var mainDist = delta - creep;
    var mainS = mainMs / 1000;
    var creepS = creepMs / 1000;
    var vJoin = (2 * creep) / creepS;
    var mix = Math.min(1, (vJoin * mainS) / mainDist);
    return function (ms) {
      if (ms < mainMs) {
        var s = ms / mainMs;
        return {
          x: mainDist * ((1 - mix) * (1 - Math.pow(1 - s, 4)) + mix * s),
          v: (mainDist * ((1 - mix) * 4 * Math.pow(1 - s, 3) + mix)) / mainS
        };
      }
      var c = Math.min(1, (ms - mainMs) / creepMs);
      return {
        x: mainDist + creep * (1 - Math.pow(1 - c, 2)),
        v: (2 * creep * (1 - c)) / creepS
      };
    };
  }

  // ---------- pointer ----------

  var kickAt = 0;
  var kickAmp = 0;
  var kickRunning = false;

  // 境目に弾かれた時に呼ぶ。speed: 盤の角速度(rad/s)
  function kickPointer(speed) {
    kickAt = performance.now();
    kickAmp = KICK_DEG * Math.max(KICK_MIN_RATIO, Math.min(1, speed / KICK_FULL_SPEED));
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
      el.pointer.style.transform = "";
      return;
    }
    var deg = -kickAmp * Math.exp(-dt / KICK_DECAY_MS) * Math.cos((dt / KICK_PERIOD_MS) * TWO_PI);
    el.pointer.style.transform = "rotate(" + deg.toFixed(2) + "deg)";
    requestAnimationFrame(animatePointer);
  }

  function start() {
    if (spinning || shuffling) return;
    finishWinnerDisplay();
    if (state.entries.length === 0) return;
    audioCtx(); // ユーザー操作の中で音声を有効化する
    if (state.options.shuffleEach && state.entries.length > 1) {
      shuffleEntries(spin);
    } else {
      spin();
    }
  }

  function spin() {
    var n = state.entries.length;
    if (n === 0) return;

    var seg = TWO_PI / n;
    var w = pickWinnerIndex();
    var offset = 0.15 + randFloat() * 0.7; // 境界ギリギリに止めない
    var target = -(w + offset) * seg;
    var turns = 5 + randInt(3);
    var from = rotation;
    var delta = turns * TWO_PI + normalize(target - from);
    // じわじわ区間: 最後の境目(当たりの項目に入る境目)の少し手前から
    var creep = Math.min(CREEP_MAX, (1 - offset) * seg +
      Math.max(CREEP_LEAD_MIN, Math.min(CREEP_LEAD_SEG * seg, CREEP_LEAD_MAX)));
    var mainMs = MAIN_MS_MIN + randInt(MAIN_MS_RANGE);
    var creepMs = CREEP_MS_MIN + randInt(CREEP_MS_RANGE);
    var duration = mainMs + creepMs;
    var curve = makeSpinCurve(delta, creep, mainMs, creepMs);
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
      if (ms < duration) {
        requestAnimationFrame(frame);
      } else {
        rotation = normalize(rotation);
        drawWheel();
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

  // 盤の幅に収まるよう文字サイズを決める(アニメーション中でも測れるよう canvas で計測)
  // 1行に入らない長い名前は2行に折り返す
  function fitWinnerName() {
    var maxSize = 110;
    var lineWidth = 460; // .winner-name の max-width から枠と余白を引いた幅
    ctx.save();
    ctx.font = "800 " + maxSize + "px " + FONT;
    var width = ctx.measureText(el.winnerName.textContent).width;
    ctx.restore();
    var oneLine = Math.floor(maxSize * lineWidth / width);
    var twoLines = oneLine < 56;
    var size = twoLines ? Math.floor(maxSize * lineWidth * 1.8 / width) : Math.min(maxSize, oneLine);
    el.winnerName.classList.toggle("two-lines", twoLines);
    el.winnerName.style.fontSize = Math.max(28, size) + "px";
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

  // ---------- shuffle ----------

  // Fisher-Yates(crypto 乱数)
  function shuffledEntries() {
    var a = state.entries.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = randInt(i + 1);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // 演出: 短い間隔で並びを何度も入れ替え、だんだん間隔を広げて止まる。最後の並びが本当の結果
  var SHUFFLE_STEPS_MS = [60, 60, 60, 70, 80, 90, 110, 130, 160, 200, 250];

  function shuffleEntries(done) {
    if (shuffling || spinning) return;
    if (state.entries.length < 2) { if (done) done(); return; }
    finishWinnerDisplay();
    audioCtx();
    shuffling = true;
    el.entryList.classList.add("shuffling");
    render();
    var step = 0;
    function tick() {
      state.entries = shuffledEntries();
      playShuffle();
      kickPointer(KICK_FULL_SPEED);
      render();
      // li のアニメーションを毎回再生する
      el.entryList.classList.remove("shuffling");
      void el.entryList.offsetWidth;
      el.entryList.classList.add("shuffling");
      step++;
      if (step < SHUFFLE_STEPS_MS.length) {
        setTimeout(tick, SHUFFLE_STEPS_MS[step]);
      } else {
        shuffling = false;
        el.entryList.classList.remove("shuffling");
        save();
        render();
        if (done) done();
      }
    }
    setTimeout(tick, SHUFFLE_STEPS_MS[0]);
  }

  // ---------- entries ----------

  function indexOfId(id) {
    for (var i = 0; i < state.entries.length; i++) if (state.entries[i].id === id) return i;
    return -1;
  }

  function addFromInput() {
    if (spinning || shuffling) return;
    var names = el.addInput.value
      .split(/\r?\n/)
      .map(function (s) { return s.trim().slice(0, MAX_NAME_LENGTH); })
      .filter(function (s) { return s.length > 0; });
    if (names.length === 0) return;
    finishWinnerDisplay();
    names.forEach(function (name) {
      state.entries.push({ id: nextId++, name: name });
    });
    el.addInput.value = "";
    save();
    render();
  }

  function removeEntry(id) {
    if (spinning || shuffling) return;
    finishWinnerDisplay();
    var i = indexOfId(id);
    if (i < 0) return;
    state.entries.splice(i, 1);
    save();
    render();
  }

  // 誤操作防止: 2回押しで全消去(OBSの対話ウィンドウでは confirm() が出ないため)
  var clearArmTimer = null;
  function clearEntries() {
    if (spinning || shuffling) return;
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
    save();
    render();
  }

  function disarmClear() {
    clearTimeout(clearArmTimer);
    el.clearEntries.classList.remove("armed");
    el.clearEntries.textContent = "全消去";
  }

  function resetResults() {
    if (spinning || shuffling) return;
    finishWinnerDisplay();
    state.entries = state.entries.concat(state.removed);
    state.removed = [];
    state.winners = [];
    state.spinCount = 0;
    state.lastWinnerId = null;
    save();
    render();
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
      del.disabled = spinning || shuffling;
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
    renderThemeUI();
    el.winnerLabel.hidden = !state.options.congrats; // 当選表示中の切替にもすぐ反映

    el.startBtn.disabled = spinning || shuffling || n === 0;
    el.addBtn.disabled = spinning || shuffling;
    el.resetBtn.disabled = spinning || shuffling;
    el.clearEntries.disabled = spinning || shuffling || (n === 0 && state.removed.length === 0);
    el.shuffleBtn.disabled = spinning || shuffling || n < 2;
    el.wheelArea.classList.toggle("spinning", spinning);

    if (!spinning) drawWheel();
  }

  // ---------- events ----------

  el.startBtn.addEventListener("click", start);
  el.resetBtn.addEventListener("click", resetResults);
  el.addBtn.addEventListener("click", addFromInput);
  el.clearEntries.addEventListener("click", clearEntries);
  el.shuffleBtn.addEventListener("click", function () { shuffleEntries(); });
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

  el.version.textContent = "ぽこルーレット " + EDITION + " v" + VERSION;
  load();
  applyTheme();
  buildThemeUI();
  showTab("names");
  render();
  fitStage();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawWheel);

  // 検証用フック(動作には影響しない)
  window.__pokoRoulette = {
    state: state,
    presets: PRESETS,
    partIds: PART_IDS,
    colors: function () { return colors; },
    selectTheme: selectTheme,
    setPartColor: setPartColor,
    deleteCustom: deleteCustom,
    showTab: showTab,
    indexAtPointer: function () { return indexAtPointer(state.entries.length); },
    isSpinning: function () { return spinning; },
    isShuffling: function () { return shuffling; }
  };
})();
