#!/usr/bin/env python3
"""共有フォント(shared/fonts)とツール側コピー(tools/<tool>/assets/fonts)の同期と検査。

使い方:
  python3 scripts/fonts.py sync [tool]   shared/fonts から各ツールのコピーを作り直す
  python3 scripts/fonts.py check [tool]  台帳・コピー・参照を検査する(NG があれば終了コード 1)
標準ライブラリだけで動く。
"""
import hashlib, json, pathlib, re, shutil, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHARED = ROOT / "shared" / "fonts"
TOOLS = ROOT / "tools"
URL_EXEMPT = {"CREDITS.md", "MANUAL.md", "CHANGELOG.md"}  # 出典 URL を書いてよい文書(検査対象はそもそも html/css/js)


def load_manifest():
    return json.loads((SHARED / "manifest.json").read_text(encoding="utf-8"))["fonts"]


def tool_dirs(only=None):
    ds = sorted(p for p in TOOLS.iterdir() if (p / "tool.json").is_file())
    if only:
        ds = [p for p in ds if p.name == only]
        if not ds:
            sys.exit(f"NG: tools/{only}/tool.json がない")
    return ds


def tool_fonts(d):
    return json.loads((d / "tool.json").read_text(encoding="utf-8")).get("fonts", [])


def font_files(m):
    return list(m["files"]) + list(m["license"]["files"])


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def bad_file(p):
    """symlink / LFS ポインタは不可。理由を返す。"""
    if p.is_symlink():
        return "symlink"
    if p.is_file() and p.stat().st_size < 1024 and p.read_bytes().startswith(b"version https://git-lfs"):
        return "git-lfs pointer"
    return None


def strip_comments(text, kind):
    if kind == ".html":
        text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    if kind == ".js":
        text = re.sub(r"(?m)^\s*//.*$", "", text)
    return text


def sync(only):
    man = load_manifest()
    ng = 0
    for d in tool_dirs(only):
        ids = tool_fonts(d)
        base = d / "assets" / "fonts"
        for i in ids:
            if i not in man:
                print(f"NG: {d.name}: tool.json の fonts '{i}' が manifest にない")
                ng += 1
                continue
            dst = base / i
            dst.mkdir(parents=True, exist_ok=True)
            names = font_files(man[i])
            for f in names:
                shutil.copyfile(SHARED / i / f, dst / f)
            extra = sorted(p.name for p in dst.iterdir() if p.name not in names)
            for e in extra:
                print(f"NG: {d.name}: assets/fonts/{i}/{e} は台帳にない(自動では消さない。手で確認して削除)")
                ng += 1
        if base.is_dir():
            for p in sorted(base.iterdir()):
                if p.name not in ids:
                    print(f"NG: {d.name}: assets/fonts/{p.name} は tool.json の fonts にない(自動では消さない)")
                    ng += 1
        print(f"sync: {d.name} {ids}")
    return ng


def check(only):
    ng = []
    man = load_manifest()
    # 1, 2: 台帳と SHA256SUMS
    sums = {}
    for line in (SHARED / "SHA256SUMS").read_text(encoding="utf-8").splitlines():
        if line.strip():
            h, _, rel = line.partition("  ")
            sums[rel] = h
    want = set()
    for i, m in man.items():
        for f in font_files(m):
            rel = f"{i}/{f}"
            want.add(rel)
            p = SHARED / i / f
            if not p.is_file():
                ng.append(f"shared/fonts/{rel} がない(manifest にある)")
                continue
            r = bad_file(p)
            if r:
                ng.append(f"shared/fonts/{rel} は {r}")
                continue
            if rel not in sums:
                ng.append(f"shared/fonts/{rel} が SHA256SUMS にない")
            elif sums[rel] != sha(p):
                ng.append(f"shared/fonts/{rel} の sha256 が SHA256SUMS と違う")
    for rel in sums:
        if rel not in want:
            ng.append(f"SHA256SUMS の {rel} が manifest にない")
    # 7: RFN 台帳と OFL 本文(著作権表示行の "with Reserved Font Name" の有無)
    for i, m in man.items():
        for f in m["license"]["files"]:
            p = SHARED / i / f
            if p.is_file() and m["license"]["type"].startswith("OFL"):
                has = re.search(r"with\s+Reserved\s+Font\s+Name", p.read_text(encoding="utf-8", errors="replace"), re.I) is not None
                if has != (m["license"]["rfn"] is not None):
                    ng.append(f"{i}: OFL の RFN 付記({'あり' if has else 'なし'})が manifest の rfn と合わない")
    dirs = tool_dirs(only)
    for d in dirs:
        ids = tool_fonts(d)
        base = d / "assets" / "fonts"
        # 3: assets/fonts の集合 = tool.json fonts
        have = {p.name for p in base.iterdir()} if base.is_dir() else set()
        for x in sorted(have - set(ids)):
            ng.append(f"{d.name}: assets/fonts/{x} が tool.json の fonts にない")
        for x in sorted(set(ids) - have):
            ng.append(f"{d.name}: tool.json の fonts '{x}' のコピーがない(sync を実行)")
        # 4: コピーがバイト一致
        for i in ids:
            if i not in man:
                ng.append(f"{d.name}: tool.json の fonts '{i}' が manifest にない")
                continue
            names = font_files(man[i])
            for f in names:
                c, s = base / i / f, SHARED / i / f
                if bad_file(c):
                    ng.append(f"{d.name}: assets/fonts/{i}/{f} は {bad_file(c)}")
                elif not c.is_file():
                    ng.append(f"{d.name}: assets/fonts/{i}/{f} がない")
                elif s.is_file() and c.read_bytes() != s.read_bytes():
                    ng.append(f"{d.name}: assets/fonts/{i}/{f} が shared と違う")
            if (base / i).is_dir():
                for p in (base / i).iterdir():
                    if p.name not in names:
                        ng.append(f"{d.name}: assets/fonts/{i}/{p.name} が台帳にない")
        # 5, 6, 8: html / css / js の中身
        for p in sorted(d.rglob("*")):
            if not p.is_file() or p.suffix not in (".html", ".css", ".js") or p.name in URL_EXEMPT:
                continue
            rel = p.relative_to(ROOT)
            text = strip_comments(p.read_text(encoding="utf-8", errors="replace"), p.suffix)
            if p.suffix in (".html", ".css") and "shared/" in text:
                ng.append(f"{rel}: 'shared/' を参照している(assets/fonts/ を使う)")
            if re.search(r"https?://", text):
                ng.append(f"{rel}: 外部 URL(http:// / https://)がある")
            if p.suffix in (".html", ".css"):
                for blk in re.findall(r"@font-face\s*\{.*?\}", text, flags=re.S):
                    for fid in re.findall(r"assets/fonts/([^/\"')\s]+)/([^\"')\s]+)", blk):
                        i, fn = fid
                        if i not in ids or i not in man:
                            ng.append(f"{rel}: @font-face が tool.json にない assets/fonts/{i} を参照")
                            continue
                        if fn not in man[i]["files"]:
                            ng.append(f"{rel}: assets/fonts/{i}/{fn} は台帳のフォントファイルでない")
                        fam = re.search(r"font-family\s*:\s*[\"']?([^\"';}]+?)[\"']?\s*[;}]", blk)
                        wt = re.search(r"font-weight\s*:\s*(\d+|normal|bold)", blk)
                        w = {"normal": 400, "bold": 700}.get(wt.group(1), None) if wt else 400
                        if w is None:
                            w = int(wt.group(1))
                        if not fam or fam.group(1).strip() != man[i]["family"]:
                            ng.append(f"{rel}: @font-face の family が台帳('{man[i]['family']}')と違う")
                        if w != man[i]["weight"]:
                            ng.append(f"{rel}: @font-face の weight({w})が台帳({man[i]['weight']})と違う")
    for line in ng:
        print("NG: " + line)
    if ng:
        return 1
    print(f"OK: fonts check ({len(dirs)} tools)")
    return 0


def main(argv):
    if len(argv) < 2 or argv[1] not in ("sync", "check"):
        sys.exit(__doc__)
    only = argv[2] if len(argv) > 2 else None
    if argv[1] == "sync":
        return 1 if sync(only) else 0
    return check(only)


if __name__ == "__main__":
    sys.exit(main(sys.argv))
