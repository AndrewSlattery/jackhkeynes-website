#!/usr/bin/env bash
# Prints "due=true" if any post or Bluejacket puzzle whose date has passed is
# missing from the live site's published-posts.txt, otherwise "due=false".
# Lists the missing files on stderr. If the live list can't be fetched, it
# says due=true, since an unneeded rebuild is harmless.
# Dates come from the front matter "date:" line, falling back to the filename;
# a date without a timezone is read as UTC, as Jekyll does on the build runner.
#
# Usage: posts-due.sh <published-posts URL or file> [now]
#   (now is any date string, for testing)

source=$1
now=$(date -u -d "${2:-now}" +%s)

if [ -f "$source" ]; then
  published=$(tr -d '\r' < "$source")
elif ! published=$(set -o pipefail; curl -fsSL "$source" | tr -d '\r'); then
  echo "Couldn't fetch $source" >&2
  echo "due=true"
  exit 0
fi

# One "file<TAB>date" line per post
list=$(awk '
  function fallback() {
    if (file != "" && !found) {
      n = split(file, parts, "/")
      if (match(parts[n], /^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]/))
        print file "\t" substr(parts[n], 1, RLENGTH)
    }
  }
  FNR == 1 { fallback(); file = FILENAME; fm = ($0 ~ /^---/); found = 0; next }
  fm && /^---/ { fm = 0 }
  fm && !found && /^date:/ {
    d = $0; sub(/^date:[ \t]*/, "", d); gsub(/["\047\r]/, "", d)
    print file "\t" d; found = 1
  }
  END { fallback() }
' _posts/* _bluejacket/*)

# Convert all dates in one call, then pair them back up with their files
times=$(cut -f2 <<< "$list" | TZ=UTC date -f - +%s 2>/dev/null)

due=false
while IFS=$'\t' read -r f d && read -r t <&3; do
  if [ "$t" -le "$now" ] && ! grep -qxF "$f" <<< "$published"; then
    echo "Due: $f ($d)" >&2
    due=true
  fi
done <<< "$list" 3<<< "$times"

echo "due=$due"
