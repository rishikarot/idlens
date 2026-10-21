# ID Lens v3.2.0 — 21 Oct 2026 IST

- Added live front-camera motion-challenge engine with a neutral-face calibration period.
- Randomized blink / head turn / vertical head motion / smile, then front-facing stability.
- Reject frozen frames, interrupted streams, backgrounded pages and multiple faces. Show per-action progress and informative retry paths.
- Require real QR-extracted reference photo + live challenge proof in the same session before any facial comparison.
- Removed photo/video upload routes from verification; Aadhaar document image and PDF upload remain available for QR extraction only.
- Kept offline face models, crop/zoom and optional local model updates/rollback.
- Add app/version/build footer, offline service worker assets, health checks and Node motion-geometry tests.
- Important: prototype active liveness is not certified replay/deepfake/presentation-attack protection; UIDAI signature still unverified.

# ID Lens v3.1.0 — 20 Oct 2026

- Improved full-card QR region scanner with offline jsQR and ZXing; higher-resolution crop presets and PDF support.
- Quality checks and controlled selfie tone correction (prior verification path no longer permitted).

# ID Lens v3.0.1 — 20 Oct 2026

- Offline asset build and installation checks, proper GitHub Actions deployment, cache repair and local face model weights.
