#!/usr/bin/env bash
# Run once before serving/building. The deployed site serves ALL runtime code/models locally.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$ROOT/assets/vendor" "$ROOT/assets/models"
CURL=(curl --fail --location --retry 4 --retry-delay 2 --connect-timeout 20 --max-time 180 --silent --show-error)
fetch(){
  local url="$1" output="$2"
  echo "Downloading $output"
  "${CURL[@]}" "$url" -o "$output.tmp"
  test -s "$output.tmp" || { echo "Empty download: $url" >&2; exit 1; }
  mv "$output.tmp" "$output"
}
# Pin npm versions. Dynamic CDN fetches are NOT used by the published browser app.
fetch 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js' "$ROOT/assets/vendor/face-api.min.js"
fetch 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js' "$ROOT/assets/vendor/jsQR.js"
fetch 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js' "$ROOT/assets/vendor/pdf.min.js"
fetch 'https://raw.githubusercontent.com/kripken/j2k.js/master/openjpeg.js' "$ROOT/assets/vendor/openjpeg.js"
BASE='https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights'
for f in \
  ssd_mobilenetv1_model-weights_manifest.json ssd_mobilenetv1_model-shard1 ssd_mobilenetv1_model-shard2 \
  face_landmark_68_model-weights_manifest.json face_landmark_68_model-shard1 \
  face_recognition_model-weights_manifest.json face_recognition_model-shard1 face_recognition_model-shard2 \
  tiny_face_detector_model-weights_manifest.json tiny_face_detector_model-shard1 \
  face_landmark_68_tiny_model-weights_manifest.json face_landmark_68_tiny_model-shard1; do
  fetch "$BASE/$f" "$ROOT/assets/models/$f"
done
printf '\nAll runtime model and library files are present locally.\n'
du -sh "$ROOT/assets/vendor" "$ROOT/assets/models"

python3 "$ROOT/scripts/verify_assets.py"
