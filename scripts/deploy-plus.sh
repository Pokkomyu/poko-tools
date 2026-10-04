#!/usr/bin/env bash
# 有償版(edition: plus)のツールを 1 つ選んで zip にし、本番(cnh-vps)の限定版配信ディレクトリに配置する。
#   scripts/deploy-plus.sh <tool>           # zip を作る → 本番の ~/temp に送る → dry-run を表示
#   scripts/deploy-plus.sh <tool> --apply   # 同じ流れで、最後に本番へ反映する
#
# zip は tools/<tool>/ だけを含むツール単体の製品(scripts/package-tool.sh)。他のツールは混ざらない。
# 本番側の展開は wp-poko の bin/update_plus_files.sh が行う(前の版は ~/wp-poko-backups/plus/ に退避)。
# 環境変数:
#   DEPLOY_HOST    ssh 先(既定 branch@cnh-vps)
#   DEPLOY_TEMP    本番の受け渡しディレクトリ(既定 temp。ホームからの相対)
#   DEPLOY_WP_POKO 本番の wp-poko のディレクトリ(既定 services/wp-poko。ホームからの相対)
set -euo pipefail

DEPLOY_HOST=${DEPLOY_HOST:-branch@cnh-vps}
DEPLOY_TEMP=${DEPLOY_TEMP:-temp}
DEPLOY_WP_POKO=${DEPLOY_WP_POKO:-services/wp-poko}

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
meta="$root/tools/$TOOL/tool.json"
[ -f "$meta" ] || { echo "tools/$TOOL/tool.json がありません" >&2; exit 2; }
edition=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8")).get("edition", ""))' "$meta")
[ "$edition" = plus ] || { echo "tools/$TOOL は有償版(edition: plus)ではありません。edition/plus ブランチで実行してください" >&2; exit 2; }

branch=$(git -C "$root" branch --show-current)
echo "== ブランチ: ${branch:-(detached)} $(git -C "$root" rev-parse --short HEAD)"
[ "$branch" = edition/plus ] || echo "WARN: edition/plus 以外のブランチから作ります"
if [ -n "$(git -C "$root" status --porcelain -- "tools/$TOOL" packaging scripts)" ]; then
  echo "WARN: tools/$TOOL などに未コミットの変更があります(そのまま zip に入ります)"
fi

echo "== zip を作る"
zip=$("$root/scripts/package-tool.sh" "$TOOL")
name=$(basename "$zip")
# ツール単体の製品であること: zip の中身が 1 つのトップディレクトリだけで、その直下に index.html がある
tops=$(python3 -c 'import sys,zipfile; print("\n".join(sorted({n.split("/")[0] for n in zipfile.ZipFile(sys.argv[1]).namelist()})))' "$zip")
[ "$(echo "$tops" | wc -l)" = 1 ] || { echo "zip のトップディレクトリが 1 つではありません: $tops" >&2; exit 1; }
echo "$zip ($(du -h "$zip" | cut -f1)、トップ: $tops)"

echo "== $DEPLOY_HOST:~/$DEPLOY_TEMP/ に送る"
scp -q "$zip" "$DEPLOY_HOST:$DEPLOY_TEMP/$name"

run_remote(){ ssh "$DEPLOY_HOST" "cd ~/$DEPLOY_WP_POKO && bin/update_plus_files.sh ~/$DEPLOY_TEMP/$name --tool $TOOL $*"; }

echo "== 本番で dry-run"
run_remote
if [ "$APPLY" -ne 1 ]; then
  echo
  echo "dry-run のみ。反映するには: scripts/deploy-plus.sh $TOOL --apply"
  exit 0
fi

echo "== 本番に反映"
run_remote --apply
echo
echo "BOOTH に出す zip: $zip"
