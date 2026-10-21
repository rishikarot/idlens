## 3.3.0 — 21 October 2026

- Larger uncropped passport-style portrait camera preview; responsive across mobile and desktop.
- Friendly conversational liveness coach immediately below video with tailored per-action instructions and live move-closer/move-back guidance.
- Automatically scrolls the active camera into view on mobile.
- Face detection/calibration/action timeouts pause instead of closing the camera. Up to three in-camera retries, restarting all randomized actions and resetting proof.
- After all retries, explicit new challenge is available; browser-background, permission loss and camera-stop conditions still close the stream.
- One-face continuity and mandatory QR photograph guards remain intact. Match cannot proceed on any failed attempt.
- Service worker cache version bumped to publish the interface update.

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

## 3.3.1 — Eye closure recognition and guidance (21 Oct 2026)
- Replaces hard-to-sample natural blink with a deliberate ~1-second eyes-closed-then-open challenge.
- Calibrated EAR hysteresis, two closed-eye observations and reopening requirement.
- Shorter scheduling delay during blink detection, inline "Eyes closed — now open" coaching, and 16-second timeout.
- Increments offline service worker cache key to ensure refreshed logic.
