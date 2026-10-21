# ID Lens v3.3.1 — blink reliability fix

Target: browsers with slow facial landmark inference and selfies with spectacles.

## Why blink was missed
- The model previously checked facial landmarks every inference + 140 ms; a natural blink can happen between observations.
- EAR had to drop below 75% of the neutral ratio (or by .035), which can be too stringent with reflective spectacles.
- A short natural blink is not a reliable challenge on modest mobile CPUs.

## What changed
- Friendly challenge now requests: "Close your eyes gently for about one second, then open."
- Adaptive closed-eye threshold: `max(0.12, min(0.84 * baselineEAR, baselineEAR - 0.025))`.
- Completed only when two separate samples detect a closed-eye state, then a later open sample crosses a higher reopening threshold, with at least 220 ms elapsed and a maximum ~3.2 s closure.
- One-frame landmark noise does not pass; keeping eyes open does not pass. A completed transition stays latched across frames for UI stability.
- Faster rescheduling during the blink step only: 45 ms after each inference (down from 140 ms), while other challenge actions remain unchanged.
- 16 seconds allowed for the eye action; all other challenges still allow 12 seconds.
- New inline guidance immediately beneath the preview changes to "Eyes closed detected — now open your eyes".
- Offline service-worker version bumped; no new model assets or CDN downloads.

## Test/rollout
1. Commit updated `app.js`, `liveness-core.js`, `index.html`, `sw.js` (plus test file if desired).
2. Run the existing GitHub Pages offline-assets workflow; do not deploy directly from branch.
3. Clear old app cache and reload on each device.
4. Compare recorded pass rates with/without spectacles, including no-eye-movement negative controls and prerecorded-video replay attempts.

**Security caution:** This remains heuristic active liveness, not robust spoof/video/deepfake detection or official UIDAI verification. Easier motion thresholds must be evaluated with genuine and adversarial tests before production adoption.
