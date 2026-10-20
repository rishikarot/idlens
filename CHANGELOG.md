# ID Lens v3.0.1 — 20 Oct 2026

- Added in-page setup diagnostics for shipped QR decoder, JPEG2000, PDF reader, face-api and weight shards.
- Added actionable repair instructions and one-click cache reset.
- Fixed setup headline incorrectly saying offline-ready before files are validated.
- Added build verifier, generated asset-manifest.json and CI checks for all 16 assets.
- Ensure GitHub Actions publish is the source; workflow runs on main or master.
- Removed ignore rules that prevented locally fetched binary assets from being committed to a branch deployment.
- Service worker refuses to activate incomplete offline cache, instead of quietly treating missing files as successes.
- Preserved all v3 crop, matching, model update and threshold features.
