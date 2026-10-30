#!/usr/bin/env bash
# Prints "due=true" if any post or Bluejacket puzzle is dated within the last
# N hours (default 6), otherwise "due=false". Lists the due files on stderr.
# Dates come from the front matter "date:" line, falling back to the filename;
# a date without a timezone is read as UTC, as Jekyll does on the build runner.
#
# Usage: posts-due.sh [hours] [now]   (now is any date string, for testing)

hours=${1:-6}
now=$(date -u -d "${2:-now}" +%s)
since=$((now - hours * 3600))

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
  if [ "$t" -gt "$since" ] && [ "$t" -le "$now" ]; then
    echo "Due: $f ($d)" >&2
    due=true
  fi
done <<< "$list" 3<<< "$times"

echo "due=$due"
