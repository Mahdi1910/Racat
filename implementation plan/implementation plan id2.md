# Model Setup and Prayer Positioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a polished first-download model screen and a one-time pre-prayer positioning flow that checks face visibility, distance, lighting, and optional phone tilt before counting 5-to-0 and starting prayer tracking.

**Architecture:** Use explicit application views and states instead of loading the AI model inside the Start button. Store the pinned MoveNet graph model in browser IndexedDB, load it from IndexedDB on later visits, and run positioning checks only between camera permission and prayer tracking. When tracking begins, remove the positioning overlay and stop all distance, lighting, and phone-angle instructions.

**Tech Stack:** HTML, CSS, browser JavaScript, TensorFlow.js, MoveNet SinglePose Lightning, IndexedDB through TensorFlow.js model IO, Device Orientation API, Canvas pixel sampling, Node.js built-in test runner

## Global Constraints

- Do not add the greeting “Hello, how are you?”
- Do not download the AI model when the user presses Start.
- The first page must check whether the model exists in IndexedDB.
- If the model exists and loads successfully, skip the download view and open the main Start view.
- If the model does not exist, show a Download Model button.
- During download, show animation, percentage, downloaded data, and network speed.
- Ask for camera permission only after the user presses Start.
- Do not start the 5-to-0 countdown immediately after camera permission.
- First guide the user until the face is visible, correctly sized, and in the top 20–30% area of the camera.
- Say “go back one step” while the face is too close.
- Say a positive message and “stop in your place” when the position becomes correct.
- Start the 5-to-0 countdown immediately after the correct position remains stable.
- Do not show or speak “hold still for calibration.”
- Position, distance, lighting, and angle guidance must stop completely when prayer tracking starts.
- Missing face during Ruku or Sujud is normal and must not trigger setup messages.
- Phone-angle checking is optional and must not block devices without orientation sensor data.
- Do not add settings, APK/WebView packaging, first-use tutorial pages, recalibration, vibration, volume testing, or wake-lock changes in this implementation.

---

## Final user flow

```text
OPEN APP
  -> CHECKING_MODEL
      -> model valid in IndexedDB -> MAIN_READY
      -> model absent/corrupt -> MODEL_REQUIRED
  -> DOWNLOAD_MODEL
      -> DOWNLOADING_MODEL
      -> VERIFYING_MODEL
      -> MAIN_READY
  -> USER PRESSES START
      -> REQUESTING_CAMERA
      -> POSITIONING
      -> POSITION_CORRECT
      -> COUNTDOWN 5, 4, 3, 2, 1, 0
      -> TRACKING_PRAYER
```

Only `POSITIONING` and `COUNTDOWN` may run setup checks. `TRACKING_PRAYER` must use the existing standing detector and prayer counter without displaying setup warnings.

## File structure

- Create `model-manager.js`: IndexedDB model check, download, progress/speed reporting, verification, and cached detector creation.
- Create `setup-guide.js`: pure face-position, face-size, lighting, and phone-angle classification.
- Modify `index.html`: model check/download view, main view, camera positioning overlay, hidden lighting canvas, and script order.
- Modify `styles.css`: loading animation, download progress, speed display, view transitions, and animated face target.
- Modify `app.js`: application state flow, model view routing, camera start, positioning instructions, countdown cancellation, and transition into the existing prayer tracker.
- Modify `standing-detector.js`: only if needed to accept the cached detector; do not change its standing-state rules.
- Create `tests/model-manager.test.js`: model-state and download-metric tests.
- Create `tests/setup-guide.test.js`: positioning classifier tests.
- Modify `tests/verify-split.ps1`: verify new files and correct script loading order.

## Central configuration

Create one configuration object near the top of `model-manager.js`:

```javascript
const MODEL_CONFIG = Object.freeze({
    remoteUrl: 'https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4',
    indexedDbUrl: 'indexeddb://racat-movenet-singlepose-lightning-v4',
    modelVersion: 4,
    speedWindowMs: 1500
});
```

Create one configuration object near the top of `setup-guide.js`:

```javascript
const SETUP_CONFIG = Object.freeze({
    faceConfidence: 0.35,
    faceBandTop: 0.08,
    faceBandBottom: 0.30,
    minimumFaceWidth: 0.055,
    maximumFaceWidth: 0.16,
    minimumBrightness: 45,
    validPositionMs: 800,
    invalidCountdownGraceMs: 250,
    instructionSpeechCooldownMs: 2000,
    minimumPhoneBeta: 75,
    maximumPhoneBeta: 105,
    maximumPhoneGamma: 20
});
```

These are initial tuning values. Real-phone testing may adjust them, but they must remain centralized.

---

### Task 1: Add application views and boot states

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `app.js`
- Modify: `tests/verify-split.ps1`

**Interfaces:**
- Consumes: Existing camera view, Start button, counter, status elements, and TensorFlow.js scripts.
- Produces: `setAppState(nextState)` and visible views for model setup, main Start, positioning, countdown, and prayer tracking.

- [ ] **Step 1: Write the failing structural test**

Require these IDs in `tests/verify-split.ps1`:

```powershell
$requiredNewMarkup = @(
    'id="model-view"',
    'id="model-checking"',
    'id="model-download-panel"',
    'id="downloadModelBtn"',
    'id="model-progress"',
    'id="model-percentage"',
    'id="model-speed"',
    'id="main-view"',
    'id="positioning-overlay"',
    'id="face-target"',
    'id="setup-message"',
    'id="lighting-sample"'
)
```

- [ ] **Step 2: Run the structural test and verify RED**

Run: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/verify-split.ps1`

Expected: FAIL because `model-view` is missing.

- [ ] **Step 3: Add the view state names**

```javascript
const AppState = Object.freeze({
    CHECKING_MODEL: 'CHECKING_MODEL',
    MODEL_REQUIRED: 'MODEL_REQUIRED',
    DOWNLOADING_MODEL: 'DOWNLOADING_MODEL',
    VERIFYING_MODEL: 'VERIFYING_MODEL',
    MAIN_READY: 'MAIN_READY',
    REQUESTING_CAMERA: 'REQUESTING_CAMERA',
    POSITIONING: 'POSITIONING',
    COUNTDOWN: 'COUNTDOWN',
    TRACKING_PRAYER: 'TRACKING_PRAYER',
    ERROR: 'ERROR'
});
```

`setAppState()` must hide every unrelated view and show only the elements belonging to the new state. Use `hidden` or one `.is-active` class; do not navigate to another HTML file.

- [ ] **Step 4: Add the model and positioning markup**

The model view must contain:

- A checking animation and “Checking AI model…” message.
- A Download Model button shown only in `MODEL_REQUIRED`.
- A progress bar, numeric percentage, downloaded-data label, and speed label shown only in `DOWNLOADING_MODEL`.
- A “Verifying model…” state after network download reaches 100%.
- A Retry button for network, storage, or model validation failure.

The positioning overlay must contain an animated face target in the top camera area and one message element. It must be hidden outside `POSITIONING` and `COUNTDOWN`.

- [ ] **Step 5: Add polished but lightweight animation**

Use CSS-only animation:

- Rotating/pulsing AI check ring.
- Smooth progress-bar fill.
- Soft moving highlight across the download card.
- Face target gently pulsing while waiting.
- Face target becoming green and holding steady when placement is correct.
- Respect `@media (prefers-reduced-motion: reduce)` by disabling repeated animation.

- [ ] **Step 6: Run the structural test and verify GREEN**

Expected: PASS for all new required IDs.

---

### Task 2: Check, download, and store MoveNet in IndexedDB

**Files:**
- Create: `model-manager.js`
- Create: `tests/model-manager.test.js`
- Modify: `index.html`
- Modify: `app.js`

**Interfaces:**
- Produces: `ModelManager.hasValidModel()`, `ModelManager.downloadModel(onProgress)`, `ModelManager.createDetector()`, `ModelManager.removeCachedModel()`.
- Consumes: `tf.io.listModels`, `tf.loadGraphModel`, `GraphModel.save`, and `poseDetection.createDetector`.

- [ ] **Step 1: Write failing model manager tests**

Tests must cover:

```javascript
test('missing IndexedDB model returns false', async () => {});
test('matching IndexedDB model loads and validates', async () => {});
test('corrupt IndexedDB model is removed and returns false', async () => {});
test('download progress never decreases', async () => {});
test('speed uses downloaded bytes divided by elapsed time', () => {});
test('cached detector uses the IndexedDB model URL', async () => {});
```

Use injected TensorFlow and pose-detection adapters so the tests do not download the real model.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/model-manager.test.js`

Expected: FAIL because `model-manager.js` does not exist.

- [ ] **Step 3: Implement the cached-model check**

```javascript
async function hasValidModel() {
    const models = await tf.io.listModels();
    if (!models[MODEL_CONFIG.indexedDbUrl]) return false;

    try {
        const model = await tf.loadGraphModel(MODEL_CONFIG.indexedDbUrl);
        model.dispose();
        return true;
    } catch (error) {
        await tf.io.removeModel(MODEL_CONFIG.indexedDbUrl).catch(() => {});
        return false;
    }
}
```

- [ ] **Step 4: Implement download progress and speed**

Load the pinned graph model with TensorFlow.js `onProgress` for completion fraction. Supply a tracked `fetchFunc` that counts response-body bytes as the model JSON and weight files stream in.

Every progress report must have this shape:

```javascript
{
    fraction: 0.0,
    percentage: 0,
    downloadedBytes: 0,
    bytesPerSecond: 0
}
```

Compute speed from a rolling 1.5-second byte window so the displayed speed does not jump wildly. Format speed as `KB/s` below 1 MB/s and `MB/s` above it.

TensorFlow.js supports `onProgress`, IndexedDB model URLs, `tf.io.listModels()`, and graph-model saving. Reference: <https://js.tensorflow.org/api/latest/#loadGraphModel>.

- [ ] **Step 5: Save and verify the model**

```javascript
const downloadedModel = await tf.loadGraphModel(MODEL_CONFIG.remoteUrl, {
    fromTFHub: true,
    onProgress: fraction => reportFraction(fraction),
    fetchFunc: trackedFetch
});

await downloadedModel.save(MODEL_CONFIG.indexedDbUrl);
downloadedModel.dispose();

if (!await hasValidModel()) {
    throw new Error('MODEL_VERIFICATION_FAILED');
}
```

Do not display download completion until IndexedDB verification succeeds.

- [ ] **Step 6: Create the detector from IndexedDB**

```javascript
return poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet,
    {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        modelUrl: MODEL_CONFIG.indexedDbUrl,
        enableSmoothing: true
    }
);
```

MoveNet officially supports a custom `modelUrl`: <https://github.com/tensorflow/tfjs-models/blob/master/pose-detection/src/movenet/README.md>.

- [ ] **Step 7: Connect the boot screen**

On `DOMContentLoaded`:

1. Enter `CHECKING_MODEL`.
2. Call `hasValidModel()`.
3. If true, create the detector from IndexedDB and enter `MAIN_READY`.
4. If false, enter `MODEL_REQUIRED`.
5. The Download button enters `DOWNLOADING_MODEL`, updates all metrics, verifies storage, creates the detector, plays the completion animation, and enters `MAIN_READY`.
6. Start must never call the remote model URL.

- [ ] **Step 8: Run tests and verify GREEN**

Run: `node --test tests/model-manager.test.js`

Expected: All model-manager tests pass.

---

### Task 3: Classify face placement, distance, lighting, and phone tilt

**Files:**
- Create: `setup-guide.js`
- Create: `tests/setup-guide.test.js`
- Modify: `index.html`

**Interfaces:**
- Produces: `SetupGuide.extractSetupFeatures()`, `SetupGuide.measureBrightness()`, `SetupGuide.classifySetup()`, and `SetupGuide.normalizePhoneAngle()`.
- Consumes: MoveNet face keypoints, video dimensions, a small canvas sample, and optional `DeviceOrientationEvent` data.

- [ ] **Step 1: Write failing setup classifier tests**

Tests must use real feature objects and cover these results:

```javascript
'FACE_NOT_VISIBLE'
'IMPROVE_LIGHTING'
'FIX_PHONE_ANGLE'
'MOVE_BACK_ONE_STEP'
'MOVE_CLOSER_ONE_STEP'
'FACE_TOO_LOW'
'FACE_TOO_HIGH'
'POSITION_CORRECT'
```

Also test that missing orientation data does not fail an otherwise correct position.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/setup-guide.test.js`

Expected: FAIL because `setup-guide.js` does not exist.

- [ ] **Step 3: Extract face placement and size**

Use only reliable nose, eye, and ear points. Calculate:

```javascript
faceCenterY = median(facePoints.map(point => point.y)) / videoHeight;
faceWidth = (maximumFaceX - minimumFaceX) / videoWidth;
```

If fewer than two reliable face points exist, return `FACE_NOT_VISIBLE`.

- [ ] **Step 4: Measure lighting**

Draw the current video frame into the hidden `32 x 32` lighting canvas. Calculate average luminance:

```javascript
luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
```

Average all sampled pixels. Require the low-light result for several consecutive samples before showing `IMPROVE_LIGHTING`; one dark frame must not change the message.

- [ ] **Step 5: Read optional phone tilt**

Listen to `deviceorientation` only during positioning. Use normalized portrait values:

- `beta` between 75° and 105° means the phone is approximately upright front-to-back.
- absolute `gamma` at or below 20° means the phone is not leaning strongly left or right.
- If the API is missing, permission is unavailable, or no reading arrives, set `angleAvailable: false` and do not block positioning.

Device orientation values and axes: <https://developer.mozilla.org/en-US/docs/Web/API/Device_orientation_events/Orientation_and_motion_data_explained>.

- [ ] **Step 6: Use one deterministic message priority**

```javascript
function classifySetup(features) {
    if (!features.faceVisible) return 'FACE_NOT_VISIBLE';
    if (!features.lightingGood) return 'IMPROVE_LIGHTING';
    if (features.angleAvailable && !features.angleGood) return 'FIX_PHONE_ANGLE';
    if (features.faceWidth > SETUP_CONFIG.maximumFaceWidth) return 'MOVE_BACK_ONE_STEP';
    if (features.faceWidth < SETUP_CONFIG.minimumFaceWidth) return 'MOVE_CLOSER_ONE_STEP';
    if (features.faceCenterY > SETUP_CONFIG.faceBandBottom) return 'FACE_TOO_LOW';
    if (features.faceCenterY < SETUP_CONFIG.faceBandTop) return 'FACE_TOO_HIGH';
    return 'POSITION_CORRECT';
}
```

- [ ] **Step 7: Run tests and verify GREEN**

Run: `node --test tests/setup-guide.test.js`

Expected: All setup-guide tests pass.

---

### Task 4: Build the live positioning experience

**Files:**
- Modify: `app.js`
- Modify: `styles.css`
- Modify: `tests/verify-split.ps1`

**Interfaces:**
- Consumes: `SetupGuide.classifySetup()`, existing `speak()`, camera frames, and cached MoveNet detector.
- Produces: rate-limited Arabic instructions, target animation, stable-position confirmation, and countdown start.

- [ ] **Step 1: Add a failing integration check**

Require `app.js` to contain explicit handlers for every setup result and the state guards `POSITIONING`, `COUNTDOWN`, and `TRACKING_PRAYER`.

- [ ] **Step 2: Run the integration check and verify RED**

Expected: FAIL because setup-result handling is absent.

- [ ] **Step 3: Add Arabic setup messages**

```javascript
const SETUP_MESSAGES = Object.freeze({
    FACE_NOT_VISIBLE: 'الوجه غير ظاهر، انظر إلى الكاميرا',
    IMPROVE_LIGHTING: 'الإضاءة ضعيفة، حسّن الإضاءة',
    FIX_PHONE_ANGLE: 'اجعل الهاتف شبه عمودي',
    MOVE_BACK_ONE_STEP: 'ارجع خطوة واحدة إلى الخلف',
    MOVE_CLOSER_ONE_STEP: 'اقترب خطوة واحدة',
    FACE_TOO_LOW: 'ارفع اتجاه الهاتف قليلاً حتى يظهر وجهك في أعلى الشاشة',
    FACE_TOO_HIGH: 'اخفض اتجاه الهاتف قليلاً',
    POSITION_CORRECT: 'ممتاز، توقف في مكانك'
});
```

Speak only when the result changes, and never repeat the same instruction more often than every two seconds.

- [ ] **Step 4: Animate the face target**

- Waiting: soft neutral pulse.
- Incorrect face position: amber border with directional hint.
- Correct position: green border, check mark, and no pulsing movement.
- Keep the target in the top 30% of the visible camera.

- [ ] **Step 5: Confirm the position before countdown**

Require `POSITION_CORRECT` continuously for 800 ms. Then speak “ممتاز، توقف في مكانك” once and enter `COUNTDOWN` immediately. Do not show or speak a calibration message.

- [ ] **Step 6: Cancel a bad countdown safely**

Continue checking face placement during the countdown. If the position becomes invalid for more than 250 ms:

1. Cancel the active countdown using a run ID/token.
2. Return to `POSITIONING`.
3. Speak the new correction.
4. Restart at 5 only after position becomes correct again for 800 ms.

- [ ] **Step 7: Enter prayer tracking after zero**

After speaking zero:

1. Save the standing face position from the stable positioning samples.
2. Remove the positioning overlay.
3. Stop lighting sampling.
4. Remove the `deviceorientation` listener.
5. Clear setup messages.
6. Enter `TRACKING_PRAYER`.
7. Send camera frames only to the existing standing detector and Rak’ah counter.

No missing-face, lighting, distance, or phone-angle setup warning may appear in `TRACKING_PRAYER`.

- [ ] **Step 8: Run all automated tests**

```text
node --test tests/model-manager.test.js tests/setup-guide.test.js tests/standing-detector.test.js
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/verify-split.ps1
node --check model-manager.js
node --check setup-guide.js
node --check standing-detector.js
node --check app.js
```

Expected: All tests and syntax checks pass.

---

### Task 5: Failure handling and real-device verification

**Files:**
- Modify: `app.js`
- Modify: `model-manager.js`
- Test: `tests/model-manager.test.js`
- Test: `tests/setup-guide.test.js`

**Interfaces:**
- Consumes: Network errors, IndexedDB errors, storage quota errors, denied camera permission, optional sensor availability, and real camera frames.
- Produces: recoverable Retry or Back-to-Start flows without losing the known working prayer tracker.

- [ ] **Step 1: Add failure tests**

Test these exact cases:

- Download fails before 100%: show retry; do not mark model ready.
- IndexedDB save fails: show storage error; do not enter main view.
- Cached model exists but cannot load: remove it and show Download Model.
- Camera permission denied: return to Start view with a clear permission message.
- Orientation sensor unavailable: positioning continues using face and lighting checks.
- Lighting becomes dark during prayer: no setup warning appears.
- Face disappears during prayer: existing not-standing logic continues; setup positioning does not reopen.

- [ ] **Step 2: Run failure tests and verify RED**

Expected: New failure tests fail before error-state implementation.

- [ ] **Step 3: Implement recoverable errors**

Use stable error codes instead of raw browser error text:

```javascript
const UserError = Object.freeze({
    NETWORK: 'تعذر تنزيل النموذج، تحقق من الإنترنت وحاول مرة أخرى',
    STORAGE: 'تعذر حفظ النموذج على الجهاز، وفر مساحة وحاول مرة أخرى',
    MODEL_INVALID: 'ملف الذكاء الاصطناعي غير صالح، أعد تنزيله',
    CAMERA_DENIED: 'يجب السماح للكاميرا حتى يعمل عداد الركعات'
});
```

- [ ] **Step 4: Run failure tests and verify GREEN**

Expected: All automated failure tests pass.

- [ ] **Step 5: Test model flow in a real browser**

1. Clear IndexedDB.
2. Open the app and confirm the checking animation appears.
3. Confirm Download Model appears and Start does not.
4. Download and verify percent, data amount, and speed update smoothly.
5. Reload and confirm the model screen is skipped.
6. Simulate corrupt cache, reload, and confirm Download Model returns.

- [ ] **Step 6: Test positioning on real phones**

Test at least:

- Face absent.
- Poor lighting.
- Face too close.
- Face too far.
- Face too low because the phone angle is wrong.
- Phone approximately 80–90° upright.
- Device without orientation readings.
- Correct face position held for 800 ms.
- Movement out of position during countdown.
- Full countdown followed by prayer tracking.
- Ruku and Sujud with the face missing and no setup warnings.

- [ ] **Step 7: Review browser storage behavior**

Confirm the application checks IndexedDB on every open because browsers may clear site storage. If the entry is gone, show the normal Download Model view; never crash or silently download.

---

## Acceptance criteria

- Opening the app first shows a model-checking animation.
- A valid cached model skips the download view.
- A missing or corrupt model shows a Download Model button.
- Download UI shows smooth animation, percentage, downloaded data, and network speed.
- The model is saved and verified in IndexedDB.
- Future starts load MoveNet from IndexedDB and do not fetch it remotely.
- Start requests camera permission without downloading the model.
- After permission, the app speaks live placement instructions.
- The face target is in the top 20–30% camera area.
- A face that is too close receives “go back one step.”
- Poor lighting receives a lighting message only during positioning.
- Optional phone tilt accepts approximately 80–90° upright placement.
- Missing sensor data never blocks the user.
- Correct placement turns the target green and speaks “stop in your place.”
- No “hold still for calibration” instruction exists.
- Countdown runs from 5 through 0 only after correct placement.
- Leaving the correct placement during countdown cancels it safely.
- After zero, every setup check and setup message stops.
- Ruku and Sujud never reopen positioning guidance.
- Existing standing detection and Rak’ah counting behavior remains unchanged after tracking begins.

## Important technical notes

- The stored database is IndexedDB, accessed through TensorFlow.js using the `indexeddb://` model URL.
- The remote MoveNet version must be pinned. Do not use an unversioned “latest” model because a new model requires a new IndexedDB key and new verification.
- TensorFlow.js libraries are still loaded by the web application. Packaging all libraries for fully offline APK use belongs to the later Android packaging step.
- Browser phone-angle values are sensor estimates, not guaranteed hardware measurements. Face placement remains the main requirement; angle is an optional extra check.
- The setup overlay is not a permanent prayer guide. It exists only before the countdown and disappears completely during prayer.
