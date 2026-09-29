#!/usr/bin/env bash
# usage: bash scripts/qa/responsive.sh <path> <name> [scrollVH] [waitMs] [actionsJSON]
# Shoots one route at the 7 QA breakpoints and builds a contact sheet .qa/sheet-<name>.png
set -uo pipefail
cd "$(dirname "$0")/../.."
path="$1"; name="$2"; vh="${3:-0}"; wait="${4:-3500}"; actions="${5:-[]}"
base="${BASE:-http://localhost:3217}"
sep='?'; [[ "$path" == *\?* ]] && sep='&'
files=()
for sz in 1440x900 1280x800 1024x768 834x1194 768x1024 430x932 390x844; do
  w="${sz%x*}"; h="${sz#*x}"
  out=".qa/r-$name-$w.png"
  node scripts/qa/shoot.mjs "$base$path${sep}qa" "$out" "$w" "$h" "$vh" "$wait" "$actions" | grep -o '"errors":\[[^]]*' | grep -v '"errors":\["warning: THREE.Clock[^"]*"$' | grep -v '"errors":\[$' | sed "s/^/$sz /"
  files+=("$out")
done
node scripts/qa/sheet.mjs ".qa/sheet-$name.png" 4 "${files[@]}"
echo ".qa/sheet-$name.png"
