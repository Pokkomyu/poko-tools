#!/usr/bin/env bash
# 有償版(tool.json に edition がある)のツールを 1 つ選んで zip にし、private repo(既定 Pokkomyu/poko-tools-plus)の
# GitHub Release に上げる。BOOTH に出す人(星乃ぽこ)はその Release から zip を取る(docs/release/plus-dist.md)。
#   scripts/release-edition.sh <tool>           # zip を作って、作る Release の内容を表示するだけ
#   scripts/release-edition.sh <tool> --apply   # private repo に Release <tool>-<edition>-v<version> を作って zip を添付する
#
# この repo(poko-tools)は public。gh の対象は GH_REPO で private repo に固定し、上げる前に
# 「private であること」「poko-tools 自身ではないこと」を確かめる。どちらかが違えば上げない。
# 実行するブランチは edition/<edition>(push 済みで origin と一致していること)。同じ版の Release が既にあれば何もしない。
# 環境変数: PLUS_DIST_REPO(既定 Pokkomyu/poko-tools-plus)
# 必要: gh(認証済み)
set -euo pipefail

PLUS_DIST_REPO=${PLUS_DIST_REPO:-Pokkomyu/poko-tools-plus}
export GH_REPO="$PLUS_DIST_REPO"

TOOL=""; APPLY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1 ;;
    -h|--help) sed -n 2,11p "$0"; exit 0 ;;
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
[ "$edition" != - ] || { echo "tools/$TOOL は無料版です(edition がありません)。無料版は scripts/release-free.sh" >&2; exit 2; }

# 出し先: private で、poko-tools 自身ではないこと(public への誤アップロードを防ぐ)
lower(){ tr '[:upper:]' '[:lower:]'; }
origin=$(git -C "$root" remote get-url origin 2>/dev/null | sed -E 's#^(git@[^:]+:|ssh://[^/]+/|https://[^/]+/)##; s#\.git$##' | lower)
if ! info=$(gh repo view "$PLUS_DIST_REPO" --json nameWithOwner,visibility -q '.nameWithOwner + " " + .visibility' 2>/dev/null); then
  echo "出し先の repo $PLUS_DIST_REPO が見つかりません(作成済みか、gh で見られるか確認)" >&2; exit 1
fi
read -r dist_name visibility <<<"$info"
[ "$visibility" = PRIVATE ] || { echo "NG: $dist_name は $visibility です。有償版は private repo にしか上げません" >&2; exit 1; }
[ -n "$origin" ] && [ "$(echo "$dist_name" | lower)" != "$origin" ] || { echo "NG: 出し先 $dist_name がこの repo(origin: ${origin:-不明})と同じか、origin が分かりません" >&2; exit 1; }

# app.js の VERSION と tool.json を揃えておく(画面の版表示と zip 名がずれないように)
if grep -q 'var VERSION = ' "$src/app.js" 2>/dev/null && ! grep -q "var VERSION = \"$version\"" "$src/app.js"; then
  echo "tools/$TOOL/app.js の VERSION が tool.json($version)と違います" >&2; exit 1
fi
# CHANGELOG にこの版の節があること(Release ノートに使う。見出しは「## 0.4.4 カラー版 (日付)」の形)
notes=$(python3 - "$src/CHANGELOG.md" "$version" <<'PY'
import re, sys
s = open(sys.argv[1], encoding="utf-8").read()
m = re.search(r"^## " + re.escape(sys.argv[2]) + r"(?![\w.]).*?\n(.*?)(?=^## |\Z)", s, flags=re.M | re.S)
print(m.group(1).strip() if m else "")
PY
)
[ -n "$notes" ] || { echo "tools/$TOOL/CHANGELOG.md に「## $version」の節がありません" >&2; exit 1; }

cd "$root"
branch=$(git branch --show-current)
[ "$branch" = "edition/$edition" ] || { echo "edition/$edition ブランチで実行してください(今: ${branch:-detached})" >&2; exit 1; }
[ -z "$(git status --porcelain -- "tools/$TOOL" packaging scripts)" ] || { echo "tools/$TOOL などに未コミットの変更があります" >&2; exit 1; }
git fetch -q origin "$branch"
[ "$(git rev-parse HEAD)" = "$(git rev-parse "origin/$branch")" ] || { echo "$branch が origin/$branch と一致しません(pull / push してから実行)" >&2; exit 1; }
short=$(git rev-parse --short HEAD)

tag="$TOOL-$edition-v$version"
title="$display v$version"
notes="$notes

---
作った元: poko-tools \`$branch\` $short"

echo "== zip を作る"
zip=$("$root/scripts/package-tool.sh" "$TOOL")
case "$(basename "$zip")" in
  "$tag.zip") ;;
  *) echo "zip 名 $(basename "$zip") がタグ $tag と合いません" >&2; exit 1 ;;
esac
echo "$zip ($(du -h "$zip" | cut -f1))"

echo "== Release(private: $dist_name)"
echo "tag    : $tag"
echo "title  : $title"
echo "asset  : $(basename "$zip")"
echo "notes  :"; echo "$notes" | sed 's/^/  /'
if gh release view "$tag" -R "$PLUS_DIST_REPO" >/dev/null 2>&1; then
  echo "Release $tag は既にあります: $(gh release view "$tag" -R "$PLUS_DIST_REPO" --json url -q .url)"
  exit 0
fi
if [ "$APPLY" -ne 1 ]; then
  echo
  echo "dry-run のみ。作るには: scripts/release-edition.sh $TOOL --apply"
  exit 0
fi

gh release create "$tag" "$zip" -R "$PLUS_DIST_REPO" --title "$title" --notes "$notes"
echo "作成しました: $(gh release view "$tag" -R "$PLUS_DIST_REPO" --json url -q .url)"
