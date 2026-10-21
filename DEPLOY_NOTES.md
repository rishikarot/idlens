# Updating https://rishikarot.github.io/idlens/

1. Extract `ID_Lens_v3_2_0_GitHub_Ready.zip` to the repository root. Do not upload the ZIP file itself as the website.
2. **Must include new root file `liveness-core.js`.** Keep `.github/workflows/deploy.yml` under its exact hidden folder.
3. GitHub → Settings → Pages → Build and deployment → Source: **GitHub Actions**. Do not use branch deployment.
4. Wait for `Publish ID Lens (offline assets)` to run and finish GREEN. Its build step includes `node tests/liveness.test.cjs` and existing asset download / verification.
5. Go to the HTTPS site, select **Clear old app cache & reload**, and **Check installation**. Expected result: healthy manifest version **3.2.0** and all listed assets present.
6. Test `Scan Aadhaar QR` with your own consented genuine QR. If the portrait is unavailable, the app intentionally blocks face verification.
7. Select consent, start **Live challenge** (camera only), follow prompts and verify face within 60 seconds.

**Do not commit genuine Aadhaar cards or face captures to public repositories.**

The ZIP is source-based; the CI workflow packages the binary models. First page use/download requires network; later offline use depends on browser caches. The app cannot detect all virtual cameras or sophisticated replay/deepfakes.
