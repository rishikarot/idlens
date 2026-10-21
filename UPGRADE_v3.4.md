# ID Lens v3.4.0 · Spectacles-friendly blink update

- Blink uses pinned locally hosted MediaPipe Face Landmarker v0.10.21 with per-eye `eyeBlinkLeft` / `eyeBlinkRight` blendshape scores. Legacy EAR is not used for the blink stage.
- Blink requires: both eyes open baseline, at least 2 closed frames, at least 2 reopened frames; each side must meet the calibrated thresholds. Single-eye and static display are rejected by the unit tests.
- Uses original TinyFaceDetector for remaining head, pitch, smile, and hold checks; face-api recognition unchanged.
- The liveness camera shows the active instruction at the top of the frame. Passed enabled steps have green SVG check marks; disabled steps appear muted.
- Five action switches and Restore all default to ON. Enabled movements are randomized per attempt; stability always last if enabled. If no checks enabled, the camera cannot start. If some checks disabled, face match is marked REVIEW / TEST ONLY, not SUCCESS.
- Saved selfie/video uploads remain disabled. All checks remain local after assets are bundled. QR signature verification and certified presentation attack detection remain OUT OF SCOPE.

## Deploy

Replace files from `ID_Lens_v3_4_0_Changed_Files.zip` in GitHub, preserving `.github/workflows/deploy.yml`. The GitHub Actions deployment downloads MediaPipe JS, WASM, and the Face Landmarker model and publishes them locally, then checks their minimum sizes. The newly downloaded files are NOT in the source ZIP. First model download is handled on GitHub's runner, not on the user's phone. Offline use requires the browser to cache all model assets; WASM adds about 20MB plus the task model.

To validate: run `node tests/blink-v34.test.cjs` and the old `node tests/liveness.test.cjs`, deploy, open `Check installation`, then use spectacles tests with real camera and reduced glare. If new files fail to download, workflow fails rather than publishing an incomplete build. MediaPipe runtime can still fail on unsupported Safari devices; the app fails closed for blink rather than silently skipping it.

**Known risk:** Eyeglasses glare, tinted lenses and poor visibility can still prevent detection. This is not a guaranteed permanent fix; measure live success and false-acceptance rates on representative devices and users before production. Any reduced liveness configuration is test-only.
