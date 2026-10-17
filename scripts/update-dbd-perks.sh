#!/usr/bin/env bash
# DbD のパーク名(日本語 / 英語)とキャラ名を取得して tools/dbd-perks/perks-data.js を作り直す。
# 出典: https://dbd.tricky.lol/ (docs/requirements/dbd-perks.md「パークのデータ」)
# 新チャプターでパークが増えたら実行し、tool.json の version と CHANGELOG を上げる。
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
out="$root/tools/dbd-perks/perks-data.js"
api=https://dbd.tricky.lol/api
tmp=$(mktemp -d)
cleanup(){ if command -v trash-put >/dev/null; then trash-put "$tmp"; else rm -r "$tmp"; fi; }
trap cleanup EXIT

curl -fsSL -m 60 "$api/perks?locale=ja" -o "$tmp/perks_ja.json"
curl -fsSL -m 60 "$api/perks?locale=en" -o "$tmp/perks_en.json"
curl -fsSL -m 60 "$api/characters?locale=ja" -o "$tmp/chars_ja.json"

python3 -I - "$tmp" "$out" <<'PY'
import datetime, json, re, sys
tmp, out = sys.argv[1], sys.argv[2]
load = lambda n: json.load(open(f"{tmp}/{n}", encoding="utf-8"))
ja, en, chars = load("perks_ja.json"), load("perks_en.json"), load("chars_ja.json")

def clean(s):
    # 余分な空白を詰める(例: 「ウィンドウズ・オブ・ オポチュニティ」「抑圧の同盟\xa0」)
    s = re.sub(r"\s+", " ", s.replace("\xa0", " ")).strip()
    return re.sub(r"(?<=[^\x00-\x7f]) (?=[^\x00-\x7f])", "", s)

perks = []
for pid, p in ja.items():
    if p.get("role") not in ("killer", "survivor"):
        continue
    c = p.get("character")
    perks.append({
        "id": pid,
        "r": "k" if p["role"] == "killer" else "s",
        "ja": clean(p["name"]),
        "en": clean(en.get(pid, {}).get("name", "")),
        "ch": clean(chars[str(c)]["name"]) if c is not None and str(c) in chars else "",
    })
perks.sort(key=lambda x: (x["r"], x["ja"]))
count = {r: sum(1 for x in perks if x["r"] == r) for r in "ks"}
date = datetime.date.today().isoformat()
with open(out, "w", encoding="utf-8") as f:
    f.write("/* scripts/update-dbd-perks.sh で生成(手で編集しない)。出典: https://dbd.tricky.lol/\n")
    f.write(" * パーク名・キャラ名は Behaviour Interactive Inc. の著作物 */\n")
    f.write(f'var DBD_PERKS_DATE = "{date}";\n')
    f.write("var DBD_PERKS = [\n")
    f.write(",\n".join(json.dumps(x, ensure_ascii=False, separators=(",", ":")) for x in perks))
    f.write("\n];\n")
print(f"{out}: {len(perks)} 個(キラー {count['k']} / サバイバー {count['s']})、{date} 時点")
PY
