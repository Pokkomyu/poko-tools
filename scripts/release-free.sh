#!/usr/bin/env bash
# 無料版のツールを 1 つ選んで zip にし、GitHub Release(公開)に上げる。
#   scripts/release-free.sh <tool>           # zip を作って、作る Release の内容を表示するだけ
#   scripts/release-free.sh <tool> --apply   # GitHub Release <tool>-v<version> を作って zip を添付する
#
# zip は tools/<tool>/ だけを含むツール単体の製品(scripts/package-tool.sh)。
# この repo は公開なので、有償版(tool.json に edition がある)は受け付けない。有償版は deploy-plus.sh と BOOTH のみ。
# タグは push 済みの main のコミットに付ける。同じ版の Release が既にあれば作らない(版を上げてから実行する)。
# 必要: gh(認証済み)
set -euo pipefail

TOOL=""; APPLY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1 ;;
    -h|--help) sed -n 2,9p "$0"; exit 0 ;;
    -*) echo "不明なオプション: $1" >&2; exit 2 ;;
    *) [ -z "$TOOL" ] || { echo "ツールは 1 つだけ指定してください" >&2; exit 2; }; TOOL=$1 ;;
  esac; shift
done
[ -n "$TOOL" ] || { echo "usage: $0 <tool> [--apply]" >&2; exit 2; }

root="$(cd "$(dirname "$0")/.." && pwd)"
src="$root/tools/$TOOL"
[ -f "$src/tool.json" ] || { echo "tools/$TOOL/tool.json がありません" >&2; exit 2; }
read -r edition version display < <(python3 -c '
import json, sys
m = json.load(open(sys.argv[1], encoding="utf-8"))
print(m.get("edition", "") or "-", m["version"], m["displayName"])' "$src/tool.json")
[ "$edition" = - ] || { echo "tools/$TOOL は有償版(edition: $edition)です。公開 Release には上げません" >&2; exit 2; }

# app.js の VERSION と tool.json を揃えておく(画面の版表示と zip 名がずれないように)
if grep -q 'var VERSION = ' "$src/app.js" 2>/dev/null && ! grep -q "var VERSION = \"$version\"" "$src/app.js"; then
  echo "tools/$TOOL/app.js の VERSION が tool.json($version)と違います" >&2; exit 1
fi
# CHANGELOG にこの版の節があること(Release ノートに使う)
notes=$(python3 - "$src/CHANGELOG.md" "$version" <<'PY'
import re, sys
s = open(sys.argv[1], encoding="utf-8").read()
m = re.search(r"^## " + re.escape(sys.argv[2]) + r"\b.*?\n(.*?)(?=^## |\Z)", s, flags=re.M | re.S)
print(m.group(1).strip() if m else "")
PY
)
[ -n "$notes" ] || { echo "tools/$TOOL/CHANGELOG.md に「## $version」の節がありません" >&2; exit 1; }

cd "$root"
branch=$(git branch --show-current)
[ "$branch" = main ] || { echo "main ブランチで実行してください(今: ${branch:-detached})" >&2; exit 1; }
[ -z "$(git status --porcelain -- "tools/$TOOL" packaging scripts)" ] || { echo "tools/$TOOL などに未コミットの変更があります" >&2; exit 1; }
git fetch -q origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || { echo "main が origin/main と一致しません(pull / push してから実行)" >&2; exit 1; }
sha=$(git rev-parse HEAD)

tag="$TOOL-v$version"
title="$display v$version"
echo "== zip を作る"
zip=$("$root/scripts/package-tool.sh" "$TOOL")
echo "$zip ($(du -h "$zip" | cut -f1))"

echo "== Release"
echo "tag    : $tag  (main $(git rev-parse --short HEAD))"
echo "title  : $title"
echo "asset  : $(basename "$zip")"
echo "notes  :"; echo "$notes" | sed 's/^/  /'
if gh release view "$tag" >/dev/null 2>&1; then
  echo "Release $tag は既にあります。版(tool.json / app.js / CHANGELOG)を上げてから実行してください。"
  exit 0
fi
if [ "$APPLY" -ne 1 ]; then
  echo
  echo "dry-run のみ。作るには: scripts/release-free.sh $TOOL --apply"
  exit 0
fi

gh release create "$tag" "$zip" --target "$sha" --title "$title" --notes "$notes"
echo "作成しました: $(gh release view "$tag" --json url -q .url)"
