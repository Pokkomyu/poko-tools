#!/usr/bin/env bash
# tools/<name> を配布用 zip にまとめる。
# 使い方: scripts/package-tool.sh <tool-name>
set -euo pipefail

name="${1:?usage: $0 <tool-name>}"
root="$(cd "$(dirname "$0")/.." && pwd)"

python3 - "$root" "$name" <<'PY'
import json, pathlib, sys, zipfile

root, name = pathlib.Path(sys.argv[1]), sys.argv[2]
src = root / "tools" / name
meta = json.loads((src / "tool.json").read_text(encoding="utf-8"))
top = meta["displayName"]

# 配布に含めるのは実行に必要なファイルとドキュメントだけ(tool.json などは含めない)
files = []
for f in ["index.html", "style.css", "app.js", "CREDITS.md", "CHANGELOG.md"]:
    if (src / f).is_file():
        files.append((src / f, f))
if (src / "assets").is_dir():
    files += [(p, str(p.relative_to(src))) for p in sorted((src / "assets").rglob("*")) if p.is_file()]
files.append((src / "MANUAL.md", "使い方.txt"))
# 有償版(tool.json の edition)は専用の利用規約があればそれを同梱し、zip 名にも edition を付ける
edition = meta.get("edition")
license_file = root / "packaging" / f"LICENSE_{edition}_ja.md" if edition else None
if not (license_file and license_file.is_file()):
    license_file = root / "packaging" / "LICENSE_ja.md"
files.append((license_file, "利用規約.txt"))

out = root / "dist" / f"{name}{'-' + edition if edition else ''}-v{meta['version']}.zip"
out.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for path, arc in files:
        # 日本語ファイル名は UTF-8 フラグ付きで格納される(Windows 標準の展開で文字化けしない)
        z.write(path, f"{top}/{arc}")
print(out)
PY
