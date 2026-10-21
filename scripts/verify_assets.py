#!/usr/bin/env python3
"""Ensure all runtime binaries exist; generate a proof file consumed by the app's install check."""
from pathlib import Path
import hashlib,json,sys
root=Path(__file__).resolve().parent.parent
vendors={'jsQR.js':100_000,'zxing.min.js':250_000,'openjpeg.js':100_000,'pdf.min.js':100_000,'face-api.min.js':100_000}
models=[
'ssd_mobilenetv1_model-weights_manifest.json','ssd_mobilenetv1_model-shard1','ssd_mobilenetv1_model-shard2',
'face_landmark_68_model-weights_manifest.json','face_landmark_68_model-shard1',
'face_recognition_model-weights_manifest.json','face_recognition_model-shard1','face_recognition_model-shard2',
'tiny_face_detector_model-weights_manifest.json','tiny_face_detector_model-shard1',
'face_landmark_68_tiny_model-weights_manifest.json','face_landmark_68_tiny_model-shard1']
rows=[]
for fname,minsize in [(f'assets/vendor/{n}',v) for n,v in vendors.items()]+[(f'assets/models/{n}',100 if n.endswith('.json') else 5_000) for n in models]:
    path=root/fname
    if not path.is_file():sys.exit(f'ERROR: Missing required runtime asset: {fname}. Run bash scripts/fetch_assets.sh')
    data=path.read_bytes()
    if len(data)<minsize:sys.exit(f'ERROR: Invalid or undersized asset {fname}: {len(data)} bytes')
    if data[:100].lstrip().startswith((b'<!doctype',b'<html',b'<Error')):sys.exit(f'ERROR: HTML/XML placeholder downloaded instead of binary: {fname}')
    rows.append({'path':fname,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
manifest={'built':True,'version':'3.2.0','files':rows}
(root/'asset-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('VERIFIED:',len(rows),'asset files,',round(sum(r['bytes'] for r in rows)/1e6,2),'MB; built asset-manifest.json')
