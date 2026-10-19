#!/usr/bin/env python3
"""DbD のパーク名とアイコンを取得して tools/dbd-perks/ を作り直す。

- パーク名(日本語 / 英語)・キャラ名: https://dbd.tricky.lol/ の API
- アイコン: https://deadbydaylight.wiki.gg/ の画像(256px 透過 PNG を 128px に縮めて icons/<id>.png に置く)
  アイコンは Behaviour Interactive の素材。GitHub Pages(main)にだけ置き、無料 zip には入れない
  (docs/requirements/dbd-perks.md「パークのデータ」、AGENTS.md の例外)

使い方:
  scripts/update-dbd-perks.py                  # 取得して書き出すだけ
  scripts/update-dbd-perks.py --bump           # 変わっていたら version を上げて CHANGELOG に書く(週次の Actions 用)
  scripts/update-dbd-perks.py --summary F      # 変更点を Markdown で F に書く(PR 本文用)
変わっていなければ何も書き換えない(取得日だけの差分を出さない)。
"""
import argparse
import datetime
import difflib
import io
import json
import pathlib
import re
import sys
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
TOOL = ROOT / "tools" / "dbd-perks"
DATA = TOOL / "perks-data.js"
ICONS = TOOL / "icons"
TRICKY = "https://dbd.tricky.lol/api"
WIKI = "https://deadbydaylight.wiki.gg"
UA = "poko-tools dbd-perks updater (https://github.com/Pokkomyu/poko-tools)"
ICON_PX = 128


def get(url, *, raw=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                body = r.read()
            return body if raw else json.loads(body)
        except Exception:
            if attempt == 2:
                raise
            time.sleep(3)


def wiki_api(**kw):
    kw["format"] = "json"
    return get(WIKI + "/api.php?" + urllib.parse.urlencode(kw))


def clean(s):
    # 余分な空白を詰める(例: 「ウィンドウズ・オブ・ オポチュニティ」「抑圧の同盟\xa0」)
    s = re.sub(r"\s+", " ", s.replace("\xa0", " ")).strip()
    return re.sub(r"(?<=[^\x00-\x7f]) (?=[^\x00-\x7f])", "", s)


# ---------- アイコンの名前を wiki で探す ----------

def lc_first(s):
    return s[:1].lower() + s[1:]


def guess_titles(image_path):
    """ゲーム内の画像パス(…/iconPerks_aceInTheHole)から wiki のファイル名の候補を作る。
    wiki はゲームのファイル名に合わせて IconPerks_(旧)/ IconsPerks_ / T_UI_iconsPerks_(新)で置いている"""
    m = re.search(r"icons?Perks_(.+)$", image_path.rsplit("/", 1)[-1], re.I)
    if not m:
        return []
    base = m.group(1)
    return [f"File:{pre}_{v}.png" for pre in ("IconPerks", "IconsPerks", "T_UI_iconsPerks") for v in dict.fromkeys([base, lc_first(base)])]


def query_titles(titles, **extra):
    """titles を 50 件ずつ問い合わせ、{渡した名前: page} を返す"""
    out = {}
    titles = list(dict.fromkeys(titles))
    for i in range(0, len(titles), 50):
        chunk = titles[i:i + 50]
        cont = {}
        while True:
            r = wiki_api(action="query", titles="|".join(chunk), **extra, **cont)
            q = r.get("query", {})
            back = {}
            for n in q.get("normalized", []):
                back[n["to"]] = n["from"]
            for n in q.get("redirects", []):
                back[n["to"]] = back.get(n["from"], n["from"])
            for pg in q.get("pages", {}).values():
                key = back.get(pg["title"], pg["title"])
                prev = out.setdefault(key, pg)
                if prev is not pg and "images" in pg:
                    prev.setdefault("images", []).extend(pg["images"])
            if "continue" not in r:
                break
            cont = r["continue"]
    return out


def name_key(s):
    s = s.lower()
    for w in ("scourge hook", "scourgehook", "hex", "boon", "invocation", "teamwork"):
        s = s.replace(w, "")
    return re.sub(r"[^a-z0-9]", "", s)


ICON_FILE = re.compile(r"File:(?:T[ _]UI[ _])?Icons?Perks[ _]", re.I)


def find_icons(perks_en):
    """{perk id: wiki のファイル名} を返す。見つからないパークは入れない。
    1. 英語名の記事に載っている画像のうち、名前が一番近いもの(記事には関連パークの画像も載るので名前で選ぶ)
    2. 記事がない・合う画像がないときは、ゲーム内の画像パスから作った名前
    ゲームのデータは画像パスが入れ替わっていることがある(Teamwork: Toughen Up / Throw Down)ので記事を優先する"""
    names = {pid: p["name"].replace("’", "'").replace("‘", "'") for pid, p in perks_en.items()}
    arts = query_titles(names.values(), prop="images", imlimit="max", redirects=1)
    found = {}
    for pid, name in names.items():
        imgs = [x["title"] for x in arts.get(name, {}).get("images", []) if ICON_FILE.match(x["title"])]
        if not imgs:
            continue
        score = lambda t: difflib.SequenceMatcher(None, name_key(name), name_key(ICON_FILE.sub("", t)[:-4])).ratio()
        best = max(imgs, key=lambda t: (score(t), -len(t)))  # 同点なら短い名前(「… 10.0.0PTB.png」より本番の画像)
        if score(best) >= 0.6:
            found[pid] = best
    rest = {pid: guess_titles(perks_en[pid].get("image", "")) for pid in perks_en if pid not in found}
    pages = query_titles([t for v in rest.values() for t in v], prop="imageinfo", iiprop="url")
    for pid, titles in rest.items():
        hit = next((t for t in titles if "imageinfo" in pages.get(t, {})), None)
        if hit:
            found[pid] = hit
    # 3. それでもないものは、wiki のパーク画像の一覧から名前が十分近いものを選ぶ
    #    (例: 記事名が「Light-Footed」・画像が IconPerks_light-Footed、ゲームのデータは friendsTillTheEnd・wiki は friendsTilTheEnd)
    rest = [pid for pid in perks_en if pid not in found]
    if rest:
        used = set(found.values())
        catalog = [t for t in list_perk_icons() if t not in used]
        for pid in rest:
            key = name_key(names[pid])
            scored = [(difflib.SequenceMatcher(None, key, name_key(ICON_FILE.sub("", t)[:-4])).ratio(), t) for t in catalog]
            if scored:
                score, best = max(scored)
                if score >= 0.85:
                    found[pid] = best
    return {pid: t.replace(" ", "_") for pid, t in found.items()}


def list_perk_icons():
    """wiki にあるパーク画像のファイル名(File:…)を全部返す。前方一致は大文字小文字を区別するので 3 種類とも引く"""
    out = []
    for prefix in ("IconPerks_", "IconsPerks_", "T_UI_iconsPerks_"):
        cont = {}
        while True:
            r = wiki_api(action="query", list="allimages", aiprefix=prefix, ailimit="500", **cont)
            out += ["File:" + x["name"] for x in r.get("query", {}).get("allimages", [])]
            if "continue" not in r:
                break
            cont = r["continue"]
    return [t for t in out if t.lower().endswith(".png") and not re.search(r"\d+\.\d+\.\d+", t)]  # 「… 10.0.0PTB.png」などの試験版は除く


def download_icons(icon_titles, old_icons):
    """変わった分だけ取り直す。戻り値は取得できなかった id"""
    from PIL import Image  # 取得するときだけ使う(Actions では pip install pillow)
    ICONS.mkdir(exist_ok=True)
    need = {pid: t for pid, t in icon_titles.items() if old_icons.get(pid) != t or not (ICONS / f"{pid}.png").is_file()}
    pages = query_titles(need.values(), prop="imageinfo", iiprop="url") if need else {}
    failed = []
    for pid, t in need.items():
        info = pages.get(t, {}).get("imageinfo")
        if not info:
            failed.append(pid)
            continue
        try:
            img = Image.open(io.BytesIO(get(info[0]["url"], raw=True))).convert("RGBA")
            img = img.resize((ICON_PX, ICON_PX), Image.LANCZOS)
            # 256 色に減らす(透過は残る)。1 枚 約 13KB → 約 3KB
            img.quantize(256, method=Image.Quantize.FASTOCTREE).save(ICONS / f"{pid}.png", optimize=True)
        except Exception as e:
            print(f"warn: {pid} の画像を取得できませんでした: {e}", file=sys.stderr)
            failed.append(pid)
        time.sleep(0.2)  # wiki に負荷をかけない
    return failed


# ---------- DLC(パークの設定で時期ごとに絞り込む用) ----------

BASE_DLC = {"id": "", "ja": "基本・共通", "d": ""}


def build_dlcs(perks_ja, chars, dlc_ja, dlc_en):
    """{perk id: DLC の id} と、公開順に並べた DLC の一覧を返す。
    基本キャラ(dlc なし)と共通パークは BASE_DLC("")。DLC の id は大文字小文字がずれていることがある(SUSHI_CHPTR40 / Sushi_CHPTR40)"""
    by_lower = {k.lower(): k for k in dlc_ja}
    perk_dlc = {}
    for pid, p in perks_ja.items():
        c = p.get("character")
        code = (chars.get(str(c)) or {}).get("dlc") if c is not None else None
        perk_dlc[pid] = by_lower.get(code.lower(), code) if code else ""
    used = sorted({d for d in perk_dlc.values() if d})
    # 公開日が 0 の DLC(出たばかり)は、パーク番号(S52P01 など)が 1 つ前の DLC のすぐ後ろに置く
    nums = {}  # DLC → {(S/K, 番号)}。1 つの DLC にキラーとサバイバーの両方があることがある(Poutine = K42 + S50/S51)
    for pid, d in perk_dlc.items():
        m = re.match(r"([SK])(\d+)P\d+$", pid)
        if d and m:
            nums.setdefault(d, set()).add((m.group(1), int(m.group(2))))
    t = {d: (dlc_ja.get(d) or {}).get("time") or 0 for d in used}
    for d in sorted((d for d in used if not t[d] and d in nums), key=lambda d: min(n for _, n in nums[d])):
        prev = [t[x] for x in used if t[x] and x != d and any(r == r2 and n2 < n for r, n in nums[d] for r2, n2 in nums.get(x, ()))]
        t[d] = max(prev) + 1 if prev else max(t.values())
    def name(d):
        for src in (dlc_ja, dlc_en):
            n = clean((src.get(d) or {}).get("name") or "")
            if n and not n.startswith("@#"):
                return n
        return d
    dlcs = [BASE_DLC] + [
        {"id": d, "ja": name(d),
         "d": datetime.datetime.fromtimestamp((dlc_ja.get(d) or {}).get("time") or 0, datetime.timezone.utc).date().isoformat()
              if (dlc_ja.get(d) or {}).get("time") else ""}
        for d in sorted(used, key=lambda d: (t[d], d))]
    return perk_dlc, dlcs


# ---------- perks-data.js ----------

def read_old():
    if not DATA.is_file():
        return [], [], ""
    text = DATA.read_text(encoding="utf-8")
    m = re.search(r'DBD_PERKS_DATE = "([^"]*)"', text)
    perks = [json.loads(line.rstrip(",")) for line in text.splitlines() if line.startswith('{"id"')]
    d = re.search(r"^var DBD_DLCS = (.*);$", text, re.M)
    return perks, (json.loads(d.group(1)) if d else []), (m.group(1) if m else "")


def write_data(perks, dlcs, date):
    lines = ",\n".join(json.dumps(x, ensure_ascii=False, separators=(",", ":")) for x in perks)
    DATA.write_text(
        "/* scripts/update-dbd-perks.py で生成(手で編集しない)。出典: https://dbd.tricky.lol/ ・ https://deadbydaylight.wiki.gg/\n"
        " * パーク名・キャラ名・アイコンは Behaviour Interactive Inc. の著作物 */\n"
        f'var DBD_PERKS_DATE = "{date}";\n'
        "// 公開順(先頭は基本・共通)。d は公開日(出たばかりで不明なものは空)\n"
        f"var DBD_DLCS = {json.dumps(dlcs, ensure_ascii=False, separators=(',', ':'))};\n"
        f"var DBD_PERKS = [\n{lines}\n];\n",
        encoding="utf-8")


def bump_version(added, removed, renamed):
    tj = TOOL / "tool.json"
    meta = json.loads(tj.read_text(encoding="utf-8"))
    major, minor, patch = (int(x) for x in meta["version"].split("."))
    new = f"{major}.{minor}.{patch + 1}"
    tj.write_text(tj.read_text(encoding="utf-8").replace(f'"version": "{meta["version"]}"', f'"version": "{new}"'), encoding="utf-8")
    app = TOOL / "app.js"
    app.write_text(re.sub(r'var VERSION = "[^"]+";', f'var VERSION = "{new}";', app.read_text(encoding="utf-8"), count=1), encoding="utf-8")
    notes = []
    if added:
        notes.append("- パークを追加: " + "、".join(added))
    if removed:
        notes.append("- パークを削除: " + "、".join(removed))
    if renamed:
        notes.append("- 名前・アイコンの更新: " + "、".join(renamed))
    cl = TOOL / "CHANGELOG.md"
    text = cl.read_text(encoding="utf-8")
    entry = (f"## {new} ({datetime.date.today().isoformat()})\n" + "\n".join(notes or ["- パーク情報を更新"])
             + "\n- scripts/update-dbd-perks.py による自動更新\n\n")
    cl.write_text(text.replace("# CHANGELOG\n\n", "# CHANGELOG\n\n" + entry, 1), encoding="utf-8")
    return new


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bump", action="store_true")
    ap.add_argument("--summary")
    args = ap.parse_args()

    ja = get(TRICKY + "/perks?locale=ja")
    en = get(TRICKY + "/perks?locale=en")
    chars = get(TRICKY + "/characters?locale=ja")
    dlc_ja = get(TRICKY + "/dlc?locale=ja")
    dlc_en = get(TRICKY + "/dlc")
    if len(ja) < 100 or set(ja) != set(en):
        sys.exit(f"NG: tricky.lol のデータがおかしい(ja {len(ja)} 件 / en {len(en)} 件)。書き換えない")

    old, old_dlcs, old_date = read_old()
    perk_dlc, dlcs = build_dlcs(ja, chars, dlc_ja, dlc_en)
    old_by = {p["id"]: p for p in old}
    icon_titles = find_icons(en)
    failed = set(download_icons(icon_titles, {p["id"]: p.get("icon") for p in old if p.get("icon")}))

    perks = []
    for pid, p in ja.items():
        if p.get("role") not in ("killer", "survivor"):
            continue
        c = p.get("character")
        x = {
            "id": pid,
            "r": "k" if p["role"] == "killer" else "s",
            "ja": clean(p["name"]),
            "en": clean(en.get(pid, {}).get("name", "")),
            "ch": clean(chars[str(c)]["name"]) if c is not None and str(c) in chars else "",
            "dlc": perk_dlc.get(pid, ""),
        }
        icon = icon_titles.get(pid)
        if icon and pid not in failed:
            x["icon"] = icon
        elif old_by.get(pid, {}).get("icon") and (ICONS / f"{pid}.png").is_file():
            x["icon"] = old_by[pid]["icon"]  # 今回取れなくても前の画像があれば使い続ける
        perks.append(x)
    perks.sort(key=lambda x: (x["r"], x["ja"]))

    new_ids = {p["id"] for p in perks}
    added = [p["ja"] for p in perks if p["id"] not in old_by]
    removed = [p["ja"] for p in old if p["id"] not in new_ids]
    renamed = [p["ja"] for p in perks if p["id"] in old_by and old_by[p["id"]] != p]
    no_icon = [f'{p["ja"]}({p["en"]})' for p in perks if "icon" not in p]
    changed = perks != old or dlcs != old_dlcs

    for p in old:  # 消えたパークの画像は置いたままにしない
        f = ICONS / f'{p["id"]}.png'
        if p["id"] not in new_ids and f.is_file():
            f.unlink()

    date = datetime.date.today().isoformat() if changed or not old_date else old_date
    if changed:
        write_data(perks, dlcs, date)
    version = bump_version(added, removed, renamed) if changed and old and args.bump else None

    count = {r: sum(1 for x in perks if x["r"] == r) for r in "ks"}
    print(f"{DATA.relative_to(ROOT)}: {len(perks)} 個(キラー {count['k']} / サバイバー {count['s']})、"
          f"アイコンあり {len(perks) - len(no_icon)} 個、{'更新' if changed else '変更なし'}")
    if args.summary:
        out = [f"パーク情報を {date} 時点に更新しました(`scripts/update-dbd-perks.py`)。", ""]
        if version:
            out.append(f"- version: {version}")
        out.append(f"- パーク {len(perks)} 個(キラー {count['k']} / サバイバー {count['s']})")
        for label, items in (("追加", added), ("削除", removed), ("名前・アイコンの更新", renamed)):
            if items:
                out.append(f"- {label}: " + "、".join(items))
        out.append("")
        out.append(f"アイコンが見つからず文字だけで出るパーク({len(no_icon)} 個):" if no_icon else "全パークのアイコンが見つかりました。")
        out += [f"- {n}" for n in no_icon]
        pathlib.Path(args.summary).write_text("\n".join(out) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
