# ID Lens v3.4.1 — Deploy health fix

Fixes the two problems visible in the 21 October deployment screenshot:

1. `.github/workflows/deploy.yml` must copy `blink-core.js` alongside `liveness-core.js` to `dist/`.
2. `app.js` previously checked `asset-manifest.json` for `3.2.0` in one code path, while the build generated `3.4.0`. Both now check the current app version `3.4.1`.

Version is also updated in `sw.js`, `index.html` and `scripts/verify_assets.py` to force a clean cache generation. `scripts/verify_deploy.py` makes the GitHub build fail before deployment if the app scripts or model manifest are missing.

## Deploy

Replace the changed source files in your `main` branch, preserving nested paths such as `.github/workflows/deploy.yml` and `scripts/verify_deploy.py`. The Pages source must be GitHub Actions. Check `Publish ID Lens (offline assets)` completes both **build** and **deploy** successfully.

Verify these paths after deployment:

- https://rishikarot.github.io/idlens/blink-core.js
- https://rishikarot.github.io/idlens/asset-manifest.json (expect `"version": "3.4.1"`)

In ID Lens select **Clear old app cache & reload**, then **Check installation**. It should report no missing files.

This patch fixes packaging / versioning. It does not claim real-world blink detection accuracy or Aadhaar cryptographic authentication.
