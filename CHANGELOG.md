# Changelog

## v3.0.0 — 20 October 2026

- Replaced runtime external CDN dependencies with local hosting and GitHub Actions dependency bundling (service-worker cache after first online load).
- Enhanced local recognition pipeline (SSD MobileNet v1 + full 68-point landmarks + existing 128-D recognition network); optional lightweight bundled pipeline for lower-powered phones.
- Added SHA-256-verified compatible model-pack download, client-only cached update selection, and rollback to bundled enhanced default.
- Added adjustable success/review thresholds, presets, reset to defaults, explanatory decision formula, Euclidean face distance and approximate similarity-index display.
- Improved QR crop with original-image coordinate mapping, movable selection/handles, zoom, pan, rotate and real cropped-region preview.
- Corrected manual-reference photo provenance so an uploaded test image is never labeled a QR-extracted portrait.
- Displayed version and IST build date/time at the bottom of the page.

**Scope:** Browser workflow logic tested with synthetic QR data and stubbed face inference. Actual model binaries and accuracy against genuine Aadhaar cards should be tested after the GitHub Actions first deployment. Not UIDAI-certified; no QR digital signature or liveness validation.
