#!/usr/bin/env bash
# BLEND -> optimized web venue.  Usage: BLEND="/path/Map Nothing.blend" npm run venue:build
# Needs python3 (venv created on first run). Blender itself is NOT required: the .blend is parsed directly.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; root="$here/../.."
BLEND="${BLEND:?set BLEND to the .blend path}"
work="${TMPDIR:-/tmp}/milkyway-venue"; mkdir -p "$work/out"
[ -d "$work/venv" ] || { python3 -m venv "$work/venv"; "$work/venv/bin/pip" install -q -r "$here/requirements.txt"; }
# Blender 4.2+ saves zstd-compressed .blend files; unwrap first
"$work/venv/bin/python" - "$BLEND" "$work/map.blend" <<'PY'
import sys,zstandard
src,dst=sys.argv[1:]
with open(src,'rb') as f: head=f.read(4)
if head==b'\x28\xb5\x2f\xfd':
    with open(src,'rb') as f, open(dst,'wb') as o: zstandard.ZstdDecompressor().copy_stream(f,o)
else:
    import shutil; shutil.copy(src,dst)
PY
"$work/venv/bin/python" "$here/build_venue.py" "$work/map.blend" "$work/out"
# quantize + meshopt (EXT_meshopt_compression); geometry is already decimated per-object in python
npx gltf-transform weld "$work/out/venue-raw.glb" "$work/out/venue-weld.glb"
npx gltf-transform quantize "$work/out/venue-weld.glb" "$work/out/venue-q.glb" --quantize-position 14
npx gltf-transform meshopt "$work/out/venue-q.glb" "$root/public/models/venue.glb" --level high
cp "$work/out/venue-points.bin" "$work/out/venue-bulbs.bin" "$root/public/models/"
cp "$work/out/venue-meta.json" "$root/public/data/venue-meta.json"
ls -la "$root/public/models"
