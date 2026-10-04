#!/bin/bash
# Film to figure in one command.
#
#   tools/pose-capture/run.sh VIDEO META.json            reads the video, writes a review page, saves nothing
#   tools/pose-capture/run.sh VIDEO META.json --write    the same, then saves the figure (as unreviewed)
#
# Reading the video takes about a second per frame-second of footage the first time; changing the meta file and running again is quick,
# because the landmarks are kept in tools/pose-capture/out/<name>/ until the video changes.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
VIDEO="$1"; META="$2"
[ -n "$VIDEO" ] && [ -n "$META" ] || { sed -n '2,9p' "$0"; exit 1; }
shift 2
[ -f "$VIDEO" ] || { echo "No such video: $VIDEO"; exit 1; }
[ -x "$HERE/.venv/bin/python" ] || { echo "Run tools/pose-capture/setup.sh first."; exit 1; }
NAME="$(basename "$META" .json)"
OUT="$HERE/out/$NAME"
STAMP="$(cd "$(dirname "$VIDEO")" && pwd)/$(basename "$VIDEO") $(stat -f %m "$VIDEO" 2>/dev/null || stat -c %Y "$VIDEO")"
if [ ! -f "$OUT/landmarks.json" ] || [ "$(cat "$OUT/source.txt" 2>/dev/null)" != "$STAMP" ]; then
  "$HERE/.venv/bin/python" "$HERE/detect.py" "$VIDEO" "$OUT" 2>&1 | grep -v -E "^(I|W|E)0000|^INFO|^WARNING: All log" || true
  [ -f "$OUT/landmarks.json" ] || { echo "The video could not be read."; exit 1; }
  printf '%s' "$STAMP" > "$OUT/source.txt"
fi
( cd "$ROOT/app" && npx tsx scripts/capture-movement.mts "$OUT" "$(cd "$(dirname "$META")" && pwd)/$(basename "$META")" "$@" )
[ -n "$NO_OPEN" ] || open "$OUT/review.html" 2>/dev/null || true
