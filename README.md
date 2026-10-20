# ID Lens v3.1.0 — offline-first Aadhaar QR + face-comparison MVP

**Build date:** 20 October 2026 (IST).  **Status:** prototype, **not official Aadhaar verification**.

## Deploy to GitHub Pages

1. Create a repository, unpack all contents into its root, **including the hidden `.github` directory**, and push to `main` or `master`.
2. In GitHub repo **Settings → Pages → Build and deployment**, choose **GitHub Actions**.
3. The `Publish ID Lens (offline assets)` workflow downloads pinned JS libraries and face-api model weights as a **build step**, bundles them in the generated Pages artifact and publishes them under your own GitHub Pages origin.
4. When the workflow completes, open the Pages URL using HTTPS. The page will show an **Installation health** panel. It reads `asset-manifest.json` produced by the build. All checks must pass. The first visit loads the locally hosted assets and starts a service worker that caches them for later offline use. The first visit still requires connectivity. Later visits can work without an internet connection as long as the browser has not evicted the cache.
5. In Safari/Chrome, allow the camera when prompted. If permissions are unavailable, use the upload options.

**Why the distributable is a source ZIP, not one HTML file:**  Real neural-network weights are several MB of binary data and must be served alongside `index.html`. They are **not embedded in the HTML**, nor fetched from public CDNs by end-user browsers. This ZIP ships the app and a reproducible GitHub Actions dependency-bundling step; models are not included as bytes until that step finishes. If you need a physically complete air-gapped ZIP, run `bash scripts/fetch_assets.sh` with internet on your developer machine, then zip the populated folder; thereafter serving and face comparison need no outside network.

## Local testing

```bash
bash scripts/fetch_assets.sh  # Run once on a machine with internet
python3 -m http.server 8000
# visit http://localhost:8000
```

## Main workflow

1. Scan Aadhaar Secure QR via rear camera or upload a high-resolution card photo/QR image/PDF. For a safe offline test, upload `samples/synthetic_qr.png` (generated sample data, **not an Aadhaar credential**). If automatic QR recognition fails, drag to select the QR in the **optional crop editor**, resize with corner handles, move the selection, zoom/pan and inspect the true source-pixel crop preview before **Scan selected area**.
2. Review details extracted from QR, including masked last four digits, name, date of birth, gender, address. QR photo extraction uses the locally hosted OpenJPEG (JPEG 2000) decoder and may still fail for unusual QR variants.
3. Take selfie with front camera, or upload a selfie with consent; compare to QR portrait using the **locally hosted** face-api.js model weights.
4. View the *similarity index* and Euclidean distance, with success/review/failure based on the current adjustable thresholds. Without a QR-extracted portrait, a manually uploaded reference is clearly marked **photo test only**.

## Face model and accuracy

- **Enhanced (default):** face-api.js 0.22.2, SSD MobileNet v1 face detection + full 68-point landmarks + ResNet-34-like 128-D face recognition.
- **Fast:** tiny face detection + tiny 68-point landmarks + the same recognition network; faster on modest phones, lower small-face detection performance.
- **Default thresholds:** success: similarity index 80% or higher (`distance ≤ 0.50`), review: 72–79% (`distance ≤ 0.58`); below 72%: failure. **These are DEMO decision rules, not statistically calibrated biometric accuracy.**
- **Display equation:** `similarityIndex = clamp(round((1.30 - EuclideanDistance) * 100), 0, 100)`. `80%` on screen does **not** mean 80% chance of the same person.
- **Custom threshold sliders** and presets are saved in browser localStorage and can be restored with **Default**. The last result is reclassified live without re-running recognition.
- Wearing spectacles, reflections, pose, poor lighting and the QR portrait's small resolution can affect the result. High recognition accuracy for actual Aadhaar images is **not validated**.

## Optional compatible model updates and rollback

This app accepts **face-api.js v0.22.2-compatible enhanced models only**, not arbitrary ONNX or other model architectures.

1. Host an update pack at an HTTPS URL with a top-level manifest. This file must contain `engine: "face-api.js@0.22.2"`, `id`, `version` and a `files` array. Files each require a unique `name`, a full HTTPS or relative `url`, and a lowercase SHA-256 checksum (`sha256`).
2. Every referenced model manifest and shard is downloaded **only after clicking Download & install update**, hash-verified and saved in the user's **CacheStorage**, without uploading personal data.
3. The app switches to that model after reloading. The service worker intercepts the local `/model-updates/pack-id/...` paths to serve the newly cached weights.
4. **Restore default model** clears installed optional model packs and switches back to bundled enhanced models. Thresholds can be reset independently by clicking **Default**.
5. To publish a compatible update announcement, set `updates/channel.json`'s `latest` property to its HTTPS pack manifest URL; users must still explicitly download it.

Example pack format:

```json
{
  "id": "enhanced-2026-10",
  "version": "Enhanced weights 2026-10",
  "engine": "face-api.js@0.22.2",
  "files": [
    {"name": "ssd_mobilenetv1_model-weights_manifest.json", "url": "ssd_mobilenetv1_model-weights_manifest.json", "sha256": "<64 lowercase hex>"},
    {"name": "ssd_mobilenetv1_model-shard1", "url": "ssd_mobilenetv1_model-shard1", "sha256": "<64 lowercase hex>"},
    {"name": "ssd_mobilenetv1_model-shard2", "url": "ssd_mobilenetv1_model-shard2", "sha256": "<64 lowercase hex>"},
    {"name": "face_landmark_68_model-weights_manifest.json", "url": "face_landmark_68_model-weights_manifest.json", "sha256": "<64 lowercase hex>"},
    {"name": "face_landmark_68_model-shard1", "url": "face_landmark_68_model-shard1", "sha256": "<64 lowercase hex>"},
    {"name": "face_recognition_model-weights_manifest.json", "url": "face_recognition_model-weights_manifest.json", "sha256": "<64 lowercase hex>"},
    {"name": "face_recognition_model-shard1", "url": "face_recognition_model-shard1", "sha256": "<64 lowercase hex>"},
    {"name": "face_recognition_model-shard2", "url": "face_recognition_model-shard2", "sha256": "<64 lowercase hex>"}
  ]
}
```

To create a compatible pack from bundled files, produce SHA-256 hashes with `shasum -a 256 assets/models/*`. **An update must remain compatible with face-api.js 0.22.2.** Treat remote update packs as trusted input; malicious weight files may cause denial of service even with checksum validation.

## Privacy and limitations

- Aadhaar QR **digital signature is not verified** in this prototype. Data may have been tampered with; do not treat it as authenticated identity.
- Face match is NOT official UIDAI biometric face authentication. No liveness test, replay defense or calibrated FAR/FRR.
- The reference image and selfie stay in volatile browser memory; never put them in `localStorage`, IndexedDB or CacheStorage.
- Browser preference values and downloaded optional weight files are persisted locally. Use **Clear verification data** to clear on-screen personal fields and images; clearing is not proof of secure erasure from browser memory.
- This software must not be used as the sole basis to grant/deny services, benefits, employment or access. Obtain consent and comply with relevant Aadhaar / OVSE and privacy obligations before real-world use.
- Offline functionality depends on the browser Service Worker/cache availability; HTTPS or localhost is required for camera + service worker. Browsers may evict caches.
- **Dependencies:** face-api.js 0.22.2, jsQR 1.4.0 + ZXing 0.21.3, pdf.js 3.11.174, kripken/j2k.js OpenJPEG and weight shards from justadudewhohacks/face-api.js. Check upstream licenses and vulnerability advisories before any commercial deployment.

## Version

`ID Lens v3.1.0`, built 20 October 2026 · 10:26 PM IST, displayed in the page footer.

## Fix for “Offline QR reader not yet installed”

The downloadable *source* archive contains no binary JS/model assets; they are fetched during the GitHub Actions build. If Pages is configured to publish directly from a branch, `assets/vendor/jsQR.js` returns HTTP 404, so the original v3.0.0 reports “Offline QR Reader not yet installed”.

1. GitHub → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. **Actions** → **Publish ID Lens (offline assets)** → **Run workflow**. Wait until both `build` and `deploy` are successful. Ensure `.github/workflows/deploy.yml` is present in the repo, especially when uploading via browser.
3. Check `https://<your-pages-url>/asset-manifest.json`: it should contain `"built": true`, `"version": "3.0.1"`. Next visit `<your-pages-url>/assets/vendor/jsQR.js` — it should return JavaScript, not a 404 page.
4. Open the app and press **Check installation**; it lists every missing JS/weight URL. If an old service worker is serving stale code, press **Clear old app cache & reload**.
5. For **branch-based Pages**, run `bash scripts/fetch_assets.sh` locally, commit `assets/vendor`, `assets/models`, `asset-manifest.json`, and publish those files. `.gitignore` no longer blocks these assets. Note that cache/offline support and camera require HTTPS (or localhost).

**Failures diagnosed by v3.1.0:** missing JS reader, missing jpeg2000/PDF decoder, missing face-api.js, missing manifests or model shard files, missing build manifest, broken deployment strategy, and stale offline caches. The app does **not** auto-download third-party libraries from CDNs at runtime, preserving its offline-first design.

The true runtime model has not been end-to-end benchmarked here with real Aadhaar cards and selfies. This is a prototype with unsigned QR content and no liveness check.

## v3.1.0 — full Aadhaar photo & spectacle/low-quality support

- Full-card uploads automatically scan high-resolution whole image and four corners (two crop sizes), then centre using native BarcodeDetector, jsQR, and locally-bundled ZXing QR reader. Contrast-stretch and binary processing are attempted on candidates. A dense QR that is only a few pixels across each module cannot be recovered; take a closer, sharp photo in that case.
- The optional crop editor now has bottom/right/top/centre presets, touch resize handles, zoom, and original-resolution scanning.
- Face comparison supports a default-on *Improve low-quality selfies* checkbox, mild tone correction/upscaling, and two embeddings with a conservative agreement penalty. The success threshold is not secretly changed. Borderline or low-confidence photographs require manual review.
- Camera capture selects the sharpest of three local frames, which is **not** proof of liveness. Spectacle reflections and covered facial features remain limitations. No identity probability or statistical recognition accuracy can be inferred from the display score.
- ZXing is downloaded at GitHub build time and self-hosted on GitHub Pages. First load online; then caches allow offline use. Do not deploy only the source branch: deploy with the custom GitHub Actions workflow.

### Validation status

Only synthetic document photos are used in test fixtures; no real Aadhaar card or real-user face-recognition accuracy evaluation was performed. QR digital signatures remain unverified and face comparison is not official authentication.
