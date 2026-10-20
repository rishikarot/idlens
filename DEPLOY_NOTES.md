# ID Lens v3.1.0 — deploy / migration notes

## Existing repository `rishikarot/idlens`

The current GitHub Pages deployment already uses `.github/workflows/deploy.yml` and downloads models during the Actions build. Keep GitHub Pages **Source = GitHub Actions**.

### Replace the source files

- `app.js`
- `index.html`
- `sw.js`
- `scripts/fetch_assets.sh`
- `scripts/verify_assets.py`
- `README.md`, `CHANGELOG.md`
- New safe demo fixture `samples/full_card_synthetic_demo.png` (optional)

The existing `.github/workflows/deploy.yml` is compatible with v3.1.0; this ZIP also contains it.

### Deploy from your Mac

```bash
git clone https://github.com/rishikarot/idlens.git
cd idlens
# Copy the unzipped v3.1.0 package contents into this folder, keeping scripts/ etc.
git add -A
git commit -m "ID Lens v3.1.0: robust QR search and quality-aware selfie comparison"
git push origin main
```

Then check **Actions → Publish ID Lens (offline assets)**. Its build should download `zxing.min.js`, run `verify_assets.py`, generate `asset-manifest.json` version `3.1.0`, and publish the complete site.

On your phone, after the workflow reports green: open `https://rishikarot.github.io/idlens/`, tap **Clear old app cache & reload**, then **Check installation**. Confirm that ZXing and all model weights are present. No external CDN is called at normal app runtime; first deployment and initial browser caching need internet.

## What changed

- Multi-engine QR scanning (native detector, jsQR, ZXing) across full image, high-resolution corners and centre.
- Automatic contrast and binary preprocessing attempts on candidate regions.
- Convenient crop presets for 4 corners and centre, with unchanged precise manual editing.
- Local selfie quality measurement and default-enabled controlled enhancement.
- Best of 3 frames captured via camera, and independent original/corrected embedding distances with disagreement penalty. It never silently lowers the chosen success threshold.
- Model-manager and threshold sliders remain available; model remains face-api.js 0.22.2 (SSD MobileNet + full landmarks + 128-D face recognition). This is not an ArcFace upgrade.

## Validation

- JavaScript syntax checked with Node 22 and Python/Bash files linted for syntax.
- Browser smoke test exercised UI, synthetic full-card QR data flow with a decoder stub, manual crop presets/zoom, and comparison-result logic with mock face inference.
- Browser tests **did not** run the real ZXing or face-api.js vendor binaries (not embedded in this source ZIP); GitHub Actions must fetch them at build time.
- Real Aadhaar Secure QR data, QR JPEG 2000 portrait variants, real camera and person-with-spectacles accuracy were **not** tested. Do not assume a recognition accuracy improvement until tested with informed consent and a representative test set.

## Privacy/security

Unsigned QR contents, no liveness or spoof detection, no biometric calibration. This prototype must not be used to authenticate Aadhaar or automatically approve/deny access. Images are processed in memory in the browser and are not uploaded by application code, but device/browser permissions and hosting deployment should still be reviewed.
