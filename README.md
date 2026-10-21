## v3.3.0 — Guided live verification

- Larger 3:4 portrait live preview, up to 430px wide, and `object-fit: contain` so the video is not cropped just to fill its container. The browser still chooses the actual supported camera format.
- Conversational instructions appear immediately below the camera for calibration and each randomized challenge.
- A failed motion, temporary face loss, or timeout **pauses** the challenge with the camera still visible; there are **three retries** within the same camera session, each restarting calibration and all five randomized actions. When those retries are used, the user can deliberately start a new verification sequence. Retrying never grants automatic success.
- On browser backgrounding, consent withdrawal, loss of camera permission, or the Stop button, the camera is closed and verification must begin again. This is intentional fail-closed behavior.
- No video or selfie upload for verification, Aadhaar QR portrait is still required, match button remains disabled without fresh live proof.
- This is heuristic active liveness only, not certified replay/deepfake protection.

# ID Lens v3.3.0 — offline-first QR → live motion challenges → face match

**Released:** 21 October 2026 (IST). **Purpose:** research / MVP, NOT UIDAI authentication or certified presentation-attack detection.

## What changed

- A document photo/PDF or camera can still be used to **scan the Aadhaar QR**, with high-resolution region scanning and optional crop/zoom/rotate.
- An embedded **QR portrait is mandatory** for verification. Manually uploaded reference images are no longer accepted.
- **No selfie photo upload and no stored video upload** exist in the verification UI.
- Only a new front-camera `getUserMedia()` session with the user's consent can produce the selfie for face comparison.
- Five checks in each live session: **blink, turn left/right, look up/down, smile, and final face-forward stability**. The first four are shuffled on each attempt.
- A neutral face baseline is gathered first; action thresholds use face-landmark **ratios** rather than pretending to measure exact degrees.
- The camera stream must advance; one face must remain tracked. Multiple faces, missing face over consecutive frames, a paused/hidden browser, timed-out instructions, or camera interruption fail the attempt.
- A passing selfie is generated from the uninterrupted camera stream in memory. Its one-session proof expires after 60 seconds; changing identity, withdrawing consent, or restarting the camera invalidates it.
- Low-light/low-resolution correction and existing locally hosted recognition model and adjustable similarity thresholds are retained. Face matching still happens locally.
- In-page diagnostics now include the new `liveness-core.js` and tiny face/landmark weights. The GitHub Actions workflow runs tests and publishes it with the app.

## GitHub Pages deployment

1. Upload this package's **contents** to `rishikarot/idlens` on the `main` branch. Preserve `.github/workflows/deploy.yml` and `liveness-core.js` at the repository root. For updating the previous version, use the **changed-files ZIP**, which preserves existing documents/assets and workflow configuration.
2. In repository **Settings → Pages**, use **Source: GitHub Actions** (not branch-based Pages), to avoid another build overwriting the bundled models.
3. Wait for **Publish ID Lens (offline assets)** to complete successfully. It executes the pure Node.js motion tests, downloads pinned models and QR decoders, checks weights and publishes a complete artifact.
4. Open `https://rishikarot.github.io/idlens/` and select **Clear old app cache & reload**. Next choose **Check installation** to verify local dependencies, including the liveness engine.
5. Test a real Aadhaar QR *only with the person's consent*. Confirm its **embedded portrait** is extracted. Check consent, tap **Start live challenge** and follow prompts, then **Verify live face against Aadhaar QR** within 60 seconds.

### Offline behavior

The source archive does **not** contain large binary JS/model weights. CI downloads and deploys them during the GitHub Action, from pinned third-party URLs. The user's browser then downloads from the same GitHub Pages origin and caches them for use when offline. The **first visit requires internet**, and a browser may subsequently evict the cache. Verification uses no third-party biometric API. A standalone air-gapped distribution must include previously downloaded `assets/vendor/`, `assets/models/` and generated `asset-manifest.json` as well as source files. See `scripts/fetch_assets.sh`.

## Action logic (heuristic, not calibrated)

| Action | Observed facial cue | MVP rule |
|---|---|---|
| Blink | Eye aspect ratio (EAR) | Closed then reopened relative to personal neutral baseline within 1.9 sec |
| Turn | Nose-to-eye horizontal position | Normalized yaw proxy differs by more than 0.23 from neutral |
| Look up/down | Nose-to-eye vertical proportion | Normalized pitch proxy differs by more than 0.075 from neutral |
| Smile | Lip-corner horizontal spread | Spread exceeds neutral by >0.10 eye-width units (or a combined spread/corner cue) |
| Stability | Single face count, landmark box position and size, video time | Continuous one-face track, no frame freeze, final centered/open-eyed hold across 4 observations |

Head-pose proxies are **not degrees**: claims such as 15–20° should NOT be inferred from this implementation. Thresholds will require per-device and demographic validation. Glasses reflections and low-resolution cameras can impair landmark tracking; the app refuses verification if reliable eye signals cannot be obtained.

## Accuracy and models

- **Face matching** uses face-api.js 0.22.2's SSD MobileNet v1 detector, 68-point landmarks and 128D embedding model (default), or the fast tiny face pipeline.
- **Liveness** uses a different small detection stack: bundled TinyFaceDetector and tiny 68-point landmarks to process consecutive video frames. It is not a learned anti-spoofing classifier.
- The displayed face score remains a made-up **similarity index**, `clamp(round((1.30 - EuclideanDistance) × 100), 0, 100)`. It is **not a probability or a measured accuracy rate**.
- Custom match thresholds and model-update/rollback controls remain available, but they **do not disable liveness**.
- The final live frame may receive conservative local contrast normalization. It cannot reconstruct eye information obscured by spectacles or rescue irretrievably blurry photos.

## Security / privacy limits

**This version does not and cannot guarantee rejection of every saved-video replay, virtual camera injection, sophisticated face swap or real-time deepfake.** Removing file uploads prevents the obvious photo-to-photo UI bypass, and randomized prompts help against unresponsive printed-photo or ordinary playback attacks. A prerecorded video presented to the *physical camera* or a malicious software camera may still succeed if sufficiently adaptive. Browser JavaScript can also be altered by a motivated attacker. High-assurance verification needs independently evaluated PAD/liveness technology, trusted camera/capture boundaries, replay-resistant challenge verification, signed UIDAI QR verification and external validation with actual spoof media.

- QR payload **digital signature is NOT checked**, so QR demographics and portrait provenance are NOT authenticated.
- `Live challenge passed` means only these browser heuristics passed. `FACE MATCH · SUCCESS` is a **prototype comparison**, not official Aadhaar authentication.
- Never use the MVP alone to grant or deny employment, benefits, financial access or other significant services.
- Obtain explicit consent and check UIDAI/offline-verification and privacy requirements before a production product.
- Aadhaar images and camera frames are not sent to an application backend. The app uses in-memory image buffers; browser preferences and optional AI weight updates are saved locally. Avoid committing real Aadhaar media to a public GitHub repository.

## Test commands

```bash
node tests/liveness.test.cjs
bash scripts/fetch_assets.sh  # internet, on a development machine; fetches 17 runtime assets
python3 -m http.server 8000
```

Open `http://localhost:8000`, or deploy to a HTTPS site for `getUserMedia` on iPhone. The pure Node tests validate state-independent landmark decision functions but **do not substitute for a real-camera acceptance test**.

## Release identification

`ID Lens v3.3.0`, release build 21 October 2026 IST; shown in the application footer.
