# ID Lens v3.0.1 — deployment diagnostic checklist

## Error: “Offline QR reader not yet installed”

**Root cause in source-only v3 ZIP:** `assets/vendor/jsQR.js` was not bundled in that ZIP; its runtime dependencies were scheduled for download by GitHub Actions. Publishing the bare source with **Deploy from a branch** instead of **GitHub Actions** leaves the browser with missing decoder scripts. The earlier `.gitignore` also ignored files downloaded manually into `assets/vendor/` and `assets/models/`.

**Fix:** Replace repository files with this v3.0.1 package, retain `.github/workflows/deploy.yml`, select **Settings → Pages → Source: GitHub Actions**, and run **Actions → Publish ID Lens (offline assets) → Run workflow**. Verify green `build` and `deploy` jobs. The workflow fetches 4 libraries + 12 model files and will fail if any cannot be downloaded.

### Verify published file URLs (replace `YOUR_PAGE_URL`)

- `YOUR_PAGE_URL/asset-manifest.json` must return a JSON object with `"built": true` and `"version": "3.0.1"`.
- `YOUR_PAGE_URL/assets/vendor/jsQR.js` must return JavaScript, not a 404/HTML document.
- `YOUR_PAGE_URL/assets/vendor/openjpeg.js` must return JavaScript.
- `YOUR_PAGE_URL/assets/vendor/pdf.min.js` must return JavaScript.
- `YOUR_PAGE_URL/assets/vendor/face-api.min.js` must return JavaScript.
- `YOUR_PAGE_URL/assets/models/face_recognition_model-weights_manifest.json` must return JSON.
- `YOUR_PAGE_URL/assets/models/face_recognition_model-shard1` must return binary data.

The page's **Check installation** button tests all essential runtime files and displays exact failures. It does not scan or upload any Aadhaar data.

### If Actions succeeds but browser still shows old UI

1. Reload with a full refresh, then select **Clear old app cache & reload** inside v3.0.1.
2. If the v3.0.1 control never appears, remove site data for the Pages origin in your browser and reopen the app. This only applies to this app/site; any selected optional model updates cached in that browser may need reinstallation.
3. If browser reports old model weights or the QR fails while `asset-manifest.json` is correct, press **Check installation**, expand **Technical diagnostics**, and identify the missing path.

### Additional cases

| Symptom | Likely cause / next action |
|---|---|
| Camera does not open | Requires HTTPS/localhost and granted camera permission; use QR image upload |
| QR upload shows reader missing | `jsQR.js` missing; deployment failed/incomplete |
| QR code not recognized | Image too small/blurred; use crop editor and original-resolution QR image |
| Numeric payload decodes but no portrait | JPEG 2000 decoder missing or unsupported QR portrait variant |
| PDF will not scan | pdf.min.js missing or QR page unreadable |
| Face matching cannot initialize | face-api.min.js or one of the model manifests/shards missing |
| Offline works only while online | Service worker did not finish precaching; reconnect, let install finish, reload |
| Updated model fails | Incompatible manifest/shards; restore default model |
| Stale version after push | GitHub Pages is still serving old build or old service worker cache |

**Security caveat:** QR fields are parsed but **UIDAI digital signatures are not verified**, and comparisons are not official biometric authentication or liveness checks. Treat as a demonstration only.
