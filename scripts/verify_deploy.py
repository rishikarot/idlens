#!/usr/bin/env python3
"""Guard against silent GitHub Pages success with missing app scripts or old manifests."""
from pathlib import Path
import sys, json
base = Path(sys.argv[1] if len(sys.argv)>1 else 'dist')
needed = ['index.html','app.js','liveness-core.js','blink-core.js','sw.js','manifest.webmanifest',
          'asset-manifest.json','assets/vendor/face-api.min.js','assets/vendor/jsQR.js',
          'assets/vendor/mediapipe/vision_bundle.mjs','assets/models/face_landmarker.task']
for p in needed:
    f = base/p
    if not f.is_file() or f.stat().st_size < 50:
        sys.exit(f'ERROR: Missing/empty deployed file {p}. Aborting Pages publication.')
try:
    data = json.loads((base/'asset-manifest.json').read_text())
except Exception as e:
    sys.exit(f'ERROR: Invalid deployed manifest: {e}')
if data.get('version') != '3.4.1' or data.get('built') is not True:
    sys.exit(f"ERROR: Expected v3.4.1 asset manifest, got {data.get('version')!r}")
paths = {x.get('path') for x in data.get('files',[])}
for p in ['assets/vendor/mediapipe/vision_bundle.mjs','assets/models/face_landmarker.task',
          'assets/vendor/jsQR.js','assets/vendor/face-api.min.js']:
    if p not in paths:
        sys.exit(f'ERROR: Asset manifest excludes {p}')
html=(base/'index.html').read_text()
for p in ['liveness-core.js','blink-core.js']:
    if f'src="./{p}"' not in html:
        sys.exit(f'ERROR: index.html does not load {p}')
app=(base/'app.js').read_text()
if "const APP_VERSION = '3.4.1';" not in app:
    sys.exit('ERROR: app.js version mismatch')
print('PASS: publication includes all required scripts and a matching verified v3.4.1 manifest')
