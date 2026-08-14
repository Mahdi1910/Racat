# Reset Recalibration, Accurate Errors, and TensorFlow Version Lock Implementation Plan

> **Plan ID:** 4
>
> **Scope:** Fix Reset completely, make model/camera error messages describe the real failure, and pin the TensorFlow.js libraries currently used by Racat.
>
> **Explicitly out of scope:** The separate positioning/countdown reliability problem where a user who is still standing can sometimes be classified as outside the allowed position and the 5-second countdown restarts. Do not tune or redesign that behavior in this plan.

## 1. Goal

Implement three reliability fixes without changing the Rak'ah detection algorithm:

1. **Full Reset / recalibration** — pressing Reset during prayer tracking must clear the current Rak'ah session and the saved standing calibration, return to the positioning guide, collect a completely new standing calibration, run the existing 5-to-0 countdown, and then return to prayer tracking.
2. **Accurate user-facing errors** — stop reporting unrelated failures as storage, network, or camera-permission errors. Model startup, model download/save/verification, detector startup, and camera startup must each produce a useful error category and a matching Arabic/English message.
3. **TensorFlow version lock** — replace the four unversioned jsDelivr TensorFlow script URLs with exact versions so a future package release cannot silently change Racat.

The application remains vanilla HTML/CSS/JavaScript and continues to run from the existing static Cloudflare-hosted site. This plan does not add an Android wrapper, bundler, framework, npm build step, or server-side component.

---

## 2. Current application architecture read

### `index.html`

The page currently loads four TensorFlow-related scripts before Racat's own scripts:

```html
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-core"></script>
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-converter"></script>
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-webgl"></script>
<script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection"></script>
```

These URLs are unversioned. They can resolve to a different package release in the future without a Racat code change.

Racat then loads, in order:

```text
js/model-manager.js
js/setup-guide.js
js/standing-detector.js
js/settings-manager.js
js/app.js
```

The existing UI already has everything this plan needs:

- model checking/download/error view,
- `#model-error` and Retry button,
- camera/main view,
- positioning overlay,
- face-position band,
- countdown display,
- Reset button,
- status and sub-status text,
- Settings page.

No new page or modal is required for these fixes.

### `js/app.js`

The current state machine is:

```text
CHECKING_MODEL
MODEL_REQUIRED
DOWNLOADING_MODEL
VERIFYING_MODEL
MAIN_READY
SETTINGS
REQUESTING_CAMERA
POSITIONING
COUNTDOWN
TRACKING_PRAYER
ERROR
```

The important existing reset-related variables are:

```javascript
let rakatCount = 1;
let standReturnCount = 0;
let isCurrentlyDown = false;
let isRunning = false;
let standingDetector = StandingDetection.createStandingDetector();
let setupRunId = 0;
let correctPositionSince = null;
let invalidCountdownSince = null;
let lastSetupResult = null;
let lastSpokenResult = null;
let lastInstructionSpokenAt = -Infinity;
```

The current `resetApp()` only resets:

```text
rakatCount
standReturnCount
isCurrentlyDown
counter display
one status message
```

It does **not** clear `standingDetector`'s saved standing position and does not return the app to positioning/countdown/calibration.

The application already contains the correct reusable calibration entry point:

```javascript
function beginPositioning() {
    setupRunId++;
    standingDetector.reset();
    correctPositionSince = null;
    invalidCountdownSince = null;
    lastSetupResult = null;
    lastSpokenResult = null;
    lastInstructionSpokenAt = -Infinity;
    // ... switch to POSITIONING and reset guide UI
}
```

That function already clears the old standing calibration and setup session. Therefore Reset should reuse `beginPositioning()` instead of creating a second calibration implementation.

The existing setup flow is:

```text
POSITIONING
  -> require valid face position/distance for 800 ms
  -> COUNTDOWN
  -> speak/show 5, 4, 3, 2, 1, 0
  -> finishCalibration()
  -> TRACKING_PRAYER
```

This is exactly the flow Reset should re-enter.

Current model error problems in `app.js`:

```javascript
initializeApplication() catch -> error.code || 'STORAGE'
downloadModel() catch       -> error.code || 'NETWORK'
```

This can mislabel an unknown detector/library problem as storage or network.

Current camera error behavior also treats every camera-start failure as permission denial:

```text
status     -> camera_failed
sub-status -> camera_denied
```

That is wrong for missing cameras, busy cameras, unsupported browser environments, or other camera startup failures.

### `js/model-manager.js`

The MoveNet model itself is already explicitly versioned:

```javascript
remoteUrl: 'https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4'
indexedDbUrl: 'indexeddb://racat-movenet-singlepose-lightning-v4'
modelVersion: 4
```

Do **not** change these values in this plan.

The model manager currently handles:

- IndexedDB model discovery,
- cached-model load validation,
- corrupt-cache removal,
- network model download,
- download progress/speed,
- IndexedDB save,
- post-save validation,
- MoveNet detector creation.

Current typed errors exist only for download/save/validation paths. Detector creation is not wrapped in a typed `ModelManagerError`, and missing TensorFlow dependencies throw a generic `Error`.

### `js/settings-manager.js`

This module already owns Arabic/English translations. It is the correct place to add the new user-facing error strings.

Current relevant messages include:

```text
error_network
error_storage
error_model_invalid
error_unknown
camera_failed
camera_denied
```

These are too broad for the failure types Racat can actually encounter.

### `js/setup-guide.js`

Current setup constants are:

```javascript
faceConfidence: 0.35
targetBandTop: 0.08
targetBandBottom: 0.30
minimumFaceWidth: 0.055
maximumFaceWidth: 0.16
validPositionMs: 800
invalidCountdownGraceMs: 250
instructionSpeechCooldownMs: 2000
```

**Do not change these values in this implementation.** In particular, `invalidCountdownGraceMs: 250` is related to the user's separate false-countdown-restart complaint. That problem is intentionally deferred.

### `js/standing-detector.js`

The detector already exposes the reset primitive needed by this plan:

```javascript
reset()
```

It clears:

- state back to `UNCALIBRATED`,
- `standingFaceY`,
- calibration samples,
- candidate state,
- candidate timer.

Its countdown helper already emits exactly:

```text
5, 4, 3, 2, 1, 0
```

Do not change standing thresholds or transition timing in this plan.

### Current tests

Existing tests cover:

- `tests/model-manager.test.js`
- `tests/settings-manager.test.js`
- `tests/setup-guide.test.js`
- `tests/standing-detector.test.js`
- `tests/verify-split.ps1`
- HTTPS helper tests

The current suite has good unit coverage for the smaller modules, but no behavioral test of `app.js` Reset or camera-error routing. This plan adds that missing regression layer without introducing a browser test framework.

---

## 3. Version-lock baseline

At plan creation on **2026-08-14**, the currently resolved jsDelivr package versions are:

```text
@tensorflow/tfjs-core                  4.22.0
@tensorflow/tfjs-converter             4.22.0
@tensorflow/tfjs-backend-webgl         4.22.0
@tensorflow-models/pose-detection      2.1.3
```

The implementation target is therefore:

```html
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-core@4.22.0"></script>
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-converter@4.22.0"></script>
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-webgl@4.22.0"></script>
<script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@2.1.3"></script>
```

Before editing, verify once that these are still the versions represented by the current production page/runtime. If the unversioned CDN has changed after this plan was written, **stop and review rather than silently pinning a different set**. The purpose is to preserve the currently tested Racat runtime, not to perform a TensorFlow upgrade.

Do not add `latest`, caret ranges, tilde ranges, or versionless URLs.

---

## 4. Non-negotiable behavior and scope boundaries

### Reset must do

```text
TRACKING_PRAYER
    |
    | Reset
    v
clear Rak'ah session counters
clear old standing calibration
invalidate old setup/countdown work
keep current camera stream alive
keep current AI detector/model loaded
    |
    v
POSITIONING
    |
    | valid position for existing 800 ms rule
    v
COUNTDOWN 5 -> 4 -> 3 -> 2 -> 1 -> 0
    |
    v
fresh finishCalibration()
    |
    v
TRACKING_PRAYER
```

### Reset must not do

- Do not reload the page.
- Do not redownload the MoveNet model.
- Do not recreate the TensorFlow model manager.
- Do not request camera permission again.
- Do not stop/reopen the existing camera stream.
- Do not keep the old `standingFaceY`.
- Do not keep an old return count from a partly completed Rak'ah.
- Do not immediately enter tracking without a fresh calibration.
- Do not bypass the existing position guide.

### Detection behavior must not change

Do not change:

- face confidence,
- face target band,
- distance thresholds,
- 800 ms valid-position rule,
- 250 ms countdown invalid-position grace,
- standing-zone radius,
- leave-standing timing,
- missing-face timing,
- return-to-standing timing,
- two-return Rak'ah counting rule.

### Deployment architecture must not change

This plan does not modify the old local Python/Quick-Tunnel development launcher as part of production behavior. The user now tests through the existing permanent Cloudflare static deployment connected to GitHub.

---

# Implementation Tasks

## Task 1 — Create a safety point and prove the baseline

**Files changed:** none in the first step.

### Step 1.1 — Confirm repository state

Before application edits:

```powershell
git status --short
git branch --show-current
git log -1 --oneline
```

Expected:

- correct Racat repository,
- current branch understood,
- no accidental `.tools/` files staged,
- implementation plan ID 4 present.

### Step 1.2 — Create an application backup point

Create one intentional backup commit/tag before changing runtime code. Do not include unrelated `.tools/` content.

Suggested tag:

```text
backup-before-reset-errors-tfjs-pin
```

Verify the tag points to the exact pre-implementation state.

### Step 1.3 — Run the complete current automated baseline

Run:

```powershell
node --test tests/model-manager.test.js tests/settings-manager.test.js tests/setup-guide.test.js tests/standing-detector.test.js
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/https-utils.test.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/verify-split.ps1
node --check js/model-manager.js
node --check js/setup-guide.js
node --check js/standing-detector.js
node --check js/settings-manager.js
node --check js/app.js
```

Expected: all existing checks pass before changes.

If a baseline check fails, do not mix that unrelated failure into this plan without first understanding it.

---

## Task 2 — Add an `app.js` behavior test harness before fixing Reset

**Files:**

- Create: `tests/app-flow.test.js`
- Modify later if needed: `tests/verify-split.ps1`

### Purpose

The Reset bug exists in `app.js`, but the current test suite does not execute that application lifecycle. Add a small Node-only test harness using built-in `node:test`, `assert`, and `vm`; do not add jsdom, Playwright, Puppeteer, npm dependencies, or a browser framework.

### Step 2.1 — Build a lightweight fake DOM

The harness should provide only the properties `app.js` actually touches:

```text
hidden
innerText
textContent
style.display
classList.add()
classList.remove()
classList.toggle()
dataset
replaceChildren()
appendChild()
value
checked
addEventListener()
```

Provide fake elements for at least:

```text
model-view
main-view
settings-view
model-checking
model-download-panel
downloadModelBtn
download-progress-panel
retryModelBtn
startBtn
settingsBtn
resetBtn
positioning-overlay
countdown-display
model-status-text
model-error
model-download-description
status
status-dot
sub-status
counter-display
setup-message
face-position-band
face-position-label
video
output
languageSelect
voiceSelect
quietModeToggle
```

The test harness is not a visual browser emulator. It only proves state transitions and side effects.

### Step 2.2 — Prevent automatic boot

Provide a fake `window.addEventListener('DOMContentLoaded', ...)` that records the callback instead of automatically running the complete model startup.

Inject the real/pure modules where practical and controlled test doubles where browser hardware would otherwise be required.

### Step 2.3 — Write the Reset tests first and verify RED

Add tests that prove the desired behavior and fail against the current `resetApp()`.

Required tests:

```text
1. Reset from TRACKING_PRAYER changes the visible application state to POSITIONING.
2. Reset changes #counter-display back to 1.
3. Reset clears the standing detector calibration.
4. Reset clears any partial stand-return progress from the old Rak'ah.
5. Reset hides the Reset button while positioning is active.
6. Reset shows the positioning overlay again.
7. Reset does not call model initialization/download/detector creation again.
8. Reset does not request the camera again and keeps the existing video stream.
9. After Reset, a newly accepted position enters the existing 5-to-0 countdown path.
10. Tracking resumes only after fresh calibration succeeds.
```

For the partial-return test, create one old-session `LEFT_STANDING -> RETURNED_TO_STANDING` cycle before Reset, reset, then verify one new cycle after Reset is treated only as the first return and does not increase the Rak'ah.

For the countdown-path test, use a controlled countdown stub that records the emitted values and verify:

```text
[5, 4, 3, 2, 1, 0]
```

### Step 2.4 — Verify the tests fail for the correct reason

The current code should fail because `resetApp()` never calls the positioning/calibration reset path.

Do not weaken the tests to make the current behavior pass.

---

## Task 3 — Implement complete Reset by reusing the existing positioning pipeline

**Files:**

- Modify: `js/app.js`
- Modify: `tests/app-flow.test.js`
- Modify: `tests/verify-split.ps1` only if a structural Reset assertion is useful

### Step 3.1 — Keep one calibration implementation

Do **not** copy the internal logic from `beginPositioning()` into `resetApp()`.

`beginPositioning()` already owns:

```text
setupRunId invalidation
standingDetector.reset()
correctPositionSince reset
invalidCountdownSince reset
setup result/speech state reset
POSITIONING state
position-guide UI reset
```

Reset should call that existing function.

### Step 3.2 — Reset the prayer-session counters first

`resetApp()` must reset:

```javascript
rakatCount = 1;
standReturnCount = 0;
isCurrentlyDown = false;
```

Update:

```text
#counter-display -> 1
```

Then enter `beginPositioning()`.

### Step 3.3 — Make Reset valid only during active prayer tracking

The Reset button is currently only visible in `TRACKING_PRAYER`; keep that UI rule.

Also add a defensive state guard so an accidental/programmatic call outside an active tracking session does not create a confusing second setup sequence.

Target rule:

```text
if appState is not TRACKING_PRAYER -> ignore Reset
```

### Step 3.4 — Do not restart hardware or AI

`resetApp()` must not call:

```text
initializeApplication()
downloadModel()
modelManager.createDetector()
setupCamera()
getUserMedia()
renderResult() a second time
```

The existing render loop is already running. After `appState` returns to `POSITIONING`, subsequent frames will automatically be routed by `processPose()` to `processSetupFrame()`.

This is important: Reset is a **session reset**, not an application reboot.

### Step 3.5 — Do not announce a misleading completed reset before positioning

The current `speak('counter_reset')` is not enough because the user is not ready to track after Reset; calibration is still required.

Prefer the existing positioning instruction flow. Avoid two immediate speech calls that cancel one another because `speak()` calls `speechSynthesis.cancel()` before every utterance.

The visual state after Reset should clearly show the positioning guide and the existing `follow_guide` instruction.

### Step 3.6 — Preserve the existing 5-second logic exactly

After Reset:

- do not start the countdown while position is invalid,
- use the existing `validPositionMs: 800`,
- then run the existing countdown from 5 through 0,
- finish a new standing calibration,
- only then enter `TRACKING_PRAYER`.

Do not modify `runCountdown()` or its values.

### Step 3.7 — Run Reset tests and regression tests

Expected: new Reset tests turn GREEN without changing detection thresholds.

---

## Task 4 — Give model failures precise error codes

**Files:**

- Modify: `js/model-manager.js`
- Modify: `tests/model-manager.test.js`
- Modify: `js/app.js`

### Target model error taxonomy

Use stable error codes with one clear meaning:

```text
MODEL_LIBRARY_LOAD   TensorFlow / pose-detection dependency is missing or unavailable
STORAGE_READ         browser cannot inspect/read the saved model store
MODEL_DOWNLOAD       remote MoveNet model could not be fetched/loaded
STORAGE_WRITE        downloaded model could not be saved to IndexedDB
MODEL_INVALID        downloaded/saved model failed validation
DETECTOR_INIT        poseDetection.createDetector() failed
UNKNOWN              unexpected application error without a known code
```

The exact string names may be adjusted during implementation only if every test, translation, and mapping stays consistent. Do not collapse detector initialization back into STORAGE or NETWORK.

### Step 4.1 — Make missing AI libraries typed

Today `createModelManager()` throws a generic error when `tf` or `poseDetection` is missing.

Change it to a typed `ModelManagerError('MODEL_LIBRARY_LOAD', cause)` or equivalent.

In `app.js`, reference the browser globals safely rather than evaluating an undeclared `tf`/`poseDetection` identifier that can itself throw a `ReferenceError` before classification.

Use a safe pattern such as:

```javascript
const tfApi = globalThis.tf;
const poseApi = globalThis.poseDetection;
```

Then pass those values to the model manager.

### Step 4.2 — Classify saved-model store access separately

Wrap `tf.io.listModels()` so IndexedDB/listing failures produce `STORAGE_READ`.

Keep the existing self-healing behavior for a corrupt cached model:

```text
cached record exists
-> cached load fails
-> attempt removeCachedModel()
-> return false
-> UI can offer a clean model download
```

A corrupt cache that can be removed should not become a permanent fatal error.

### Step 4.3 — Keep remote-model failure separate from storage write

Remote `tf.loadGraphModel(MODEL_CONFIG.remoteUrl, ...)` failure -> `MODEL_DOWNLOAD`.

`downloadedModel.save(MODEL_CONFIG.indexedDbUrl)` failure -> `STORAGE_WRITE`.

Post-save validation failure -> `MODEL_INVALID`.

### Step 4.4 — Wrap detector creation

Make `createDetector()` asynchronous if necessary and wrap:

```javascript
poseDetection.createDetector(...)
```

Any failure here must become:

```text
DETECTOR_INIT
```

This fixes the current problem where detector creation after startup can be shown as STORAGE and detector creation after download can be shown as NETWORK.

### Step 4.5 — Remove incorrect default classifications in `app.js`

Replace:

```text
error.code || 'STORAGE'
error.code || 'NETWORK'
```

with:

```text
error.code || 'UNKNOWN'
```

The phase-specific model manager should provide the precise code whenever it knows the cause.

### Step 4.6 — Add model-manager tests first

Required cases:

```text
missing TensorFlow dependency -> MODEL_LIBRARY_LOAD
listModels failure -> STORAGE_READ
remote model load failure -> MODEL_DOWNLOAD
IndexedDB save failure -> STORAGE_WRITE
saved model validation failure -> MODEL_INVALID
detector creation failure -> DETECTOR_INIT
unexpected uncoded app error -> app falls back to UNKNOWN
```

Preserve existing tests for:

- missing cached model,
- valid cached model,
- corrupt-cache removal,
- monotonic download progress,
- speed calculation,
- IndexedDB detector model URL,
- smoothing enabled.

---

## Task 5 — Classify camera errors instead of calling everything permission denial

**Files:**

- Modify: `js/app.js`
- Modify: `tests/app-flow.test.js`
- Modify: `js/settings-manager.js`
- Modify: `tests/settings-manager.test.js`

### Step 5.1 — Add a pure camera-error classifier in `app.js`

Because `tests/app-flow.test.js` already executes `app.js` in a controlled VM, keep this logic small and testable rather than adding another production module solely for a switch statement.

Target categories:

```text
CAMERA_UNSUPPORTED
CAMERA_PERMISSION_DENIED
CAMERA_NOT_FOUND
CAMERA_BUSY
CAMERA_CONSTRAINTS
CAMERA_START_FAILED
```

Recommended browser mapping:

```text
NotAllowedError / PermissionDeniedError / SecurityError
    -> CAMERA_PERMISSION_DENIED

NotFoundError / DevicesNotFoundError
    -> CAMERA_NOT_FOUND

NotReadableError / TrackStartError
    -> CAMERA_BUSY

OverconstrainedError / ConstraintNotSatisfiedError
    -> CAMERA_CONSTRAINTS

AbortError
    -> CAMERA_START_FAILED

navigator.mediaDevices or getUserMedia unavailable
    -> CAMERA_UNSUPPORTED

anything else
    -> CAMERA_START_FAILED
```

### Step 5.2 — Detect unsupported camera API before calling it

`setupCamera()` currently assumes:

```javascript
navigator.mediaDevices.getUserMedia
```

exists.

Add an explicit capability check so an unsupported/insecure WebView/browser receives a useful category rather than an arbitrary `TypeError`.

This is also useful for the future Android WebView wrapper.

### Step 5.3 — Keep the existing retry UX

On camera failure:

- remove the active status dot,
- return to `MAIN_READY`,
- show the Start button again,
- keep the AI model/detector loaded,
- show `camera_failed` as the high-level status,
- show the precise camera error message in `#sub-status`.

Do not route camera problems into the model download/error page.

### Step 5.4 — Add Arabic and English messages

Add paired translation keys for every new model/camera code.

Suggested meaning—not necessarily exact wording:

```text
MODEL_LIBRARY_LOAD
AR: تعذر تحميل ملفات الذكاء الاصطناعي. تحقق من الاتصال وأعد فتح التطبيق.
EN: The AI libraries could not load. Check your connection and reopen the app.

STORAGE_READ
AR: تعذر الوصول إلى نموذج الذكاء الاصطناعي المحفوظ على هذا الجهاز.
EN: The app could not access the saved AI model on this device.

MODEL_DOWNLOAD
AR: تعذر تنزيل نموذج الذكاء الاصطناعي. تحقق من الإنترنت وحاول مرة أخرى.
EN: The AI model could not be downloaded. Check your internet connection and try again.

STORAGE_WRITE
AR: تعذر حفظ نموذج الذكاء الاصطناعي. وفر مساحة تخزين وحاول مرة أخرى.
EN: The AI model could not be saved. Free some storage and try again.

MODEL_INVALID
AR: نموذج الذكاء الاصطناعي الذي تم تنزيله غير صالح. حاول تنزيله مرة أخرى.
EN: The downloaded AI model is invalid. Try downloading it again.

DETECTOR_INIT
AR: تعذر تشغيل محرك التعرف على وضعية الجسم على هذا الجهاز. حاول إعادة فتح التطبيق.
EN: The pose-detection engine could not start on this device. Try reopening the app.

CAMERA_PERMISSION_DENIED
AR: تم رفض إذن الكاميرا. اسمح للتطبيق باستخدام الكاميرا ثم حاول مرة أخرى.
EN: Camera permission was denied. Allow camera access and try again.

CAMERA_NOT_FOUND
AR: لم يتم العثور على كاميرا متاحة على هذا الجهاز.
EN: No available camera was found on this device.

CAMERA_BUSY
AR: تعذر استخدام الكاميرا لأنها مشغولة أو غير متاحة حالياً. أغلق أي تطبيق يستخدمها وحاول مرة أخرى.
EN: The camera is busy or unavailable. Close other apps using it and try again.

CAMERA_CONSTRAINTS
AR: تعذر تشغيل الكاميرا بالإعدادات المطلوبة على هذا الجهاز.
EN: The camera could not start with the requested settings on this device.

CAMERA_UNSUPPORTED
AR: هذا المتصفح أو العرض لا يدعم الوصول المطلوب إلى الكاميرا.
EN: This browser or WebView does not support the required camera access.

CAMERA_START_FAILED
AR: تعذر تشغيل الكاميرا بسبب خطأ غير متوقع. حاول مرة أخرى.
EN: The camera could not start because of an unexpected error. Try again.
```

Keep `error_unknown` for truly uncategorized failures.

### Step 5.5 — Test translation completeness

For every new error key, verify:

- Arabic translation exists,
- English translation exists,
- the translation is not equal to the raw key,
- changing language returns the correct pair.

### Step 5.6 — Test camera classification

Add table-driven cases in `tests/app-flow.test.js` for all DOMException names above plus the unsupported API case and unknown fallback.

---

## Task 6 — Pin the currently used TensorFlow.js libraries

**Files:**

- Modify: `index.html`
- Modify: `tests/verify-split.ps1`

### Step 6.1 — Replace unversioned URLs with exact versions

Target exact script tags:

```html
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-core@4.22.0"></script>
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-converter@4.22.0"></script>
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-webgl@4.22.0"></script>
<script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@2.1.3"></script>
```

Keep their current order.

Do not change Racat to the all-in-one `@tensorflow/tfjs` package in this task. That would be a dependency-architecture change rather than a version lock.

### Step 6.2 — Do not change the MoveNet model version

Leave:

```text
TFHub MoveNet Lightning /4
indexeddb://racat-movenet-singlepose-lightning-v4
modelVersion: 4
```

exactly as they are.

Library version pinning and MoveNet model versioning are separate concerns.

### Step 6.3 — Strengthen structural verification

The current `$requiredVendors` test only checks an unversioned URL substring. A pinned URL would still contain that substring, so the old test would not prove that pinning happened.

Replace it with exact required script tags or exact versioned URLs.

Also add a rejection rule proving the four original unversioned script tags do not exist.

The verification must fail for this:

```html
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-core"></script>
```

and pass only for the explicitly pinned form.

### Step 6.4 — Do not introduce automatic upgrades

Do not use:

```text
@latest
@4
@4.22
^4.22.0
~4.22.0
```

The browser script URL must contain the exact package version.

---

## Task 7 — Strengthen structural regression checks for the agreed scope

**Files:**

- Modify: `tests/verify-split.ps1`

Add/retain checks that prove:

### Reset structure

`app.js` still contains one Reset entry point and the Reset flow is connected to `beginPositioning()` rather than creating duplicate calibration logic.

Do not rely only on string checks for behavior; the real proof belongs in `tests/app-flow.test.js`.

### Error structure

Require the new model error codes and camera classifier/error keys so future refactors cannot silently return to:

```text
all model errors -> STORAGE/NETWORK
all camera errors -> permission denied
```

### TensorFlow structure

Require exact versions and reject unversioned URLs.

### Existing behavior

Preserve all current checks for:

- model views,
- settings,
- positioning guide,
- standing detector,
- MoveNet IndexedDB cache,
- removed lighting/orientation features,
- local launcher structure.

Do not delete existing safeguards simply to make the new implementation easier.

---

## Task 8 — Full automated regression run

Run the final suite:

```powershell
node --test `
  tests/model-manager.test.js `
  tests/settings-manager.test.js `
  tests/setup-guide.test.js `
  tests/standing-detector.test.js `
  tests/app-flow.test.js

powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/https-utils.test.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/verify-split.ps1

node --check js/model-manager.js
node --check js/setup-guide.js
node --check js/standing-detector.js
node --check js/settings-manager.js
node --check js/app.js
```

Expected:

```text
all tests pass
zero syntax errors
zero accidental threshold changes
zero unversioned TensorFlow vendor URLs
```

Also run:

```powershell
git diff --check
git status --short
```

Review the final diff and confirm the scope is limited to the planned files.

---

## Task 9 — Real-phone verification on the permanent Cloudflare URL

This is required because camera permissions, speech, WebGL, IndexedDB, and real body movement cannot be fully validated by Node unit tests.

### Reset test

1. Open the permanent Racat Cloudflare URL on the phone.
2. Confirm the previously cached model still works; this change must not force a new MoveNet model version.
3. Start the camera normally.
4. Complete positioning and the initial 5-to-0 countdown.
5. Enter `TRACKING_PRAYER`.
6. If desired, complete enough movement to create partial old-session progress.
7. Press Reset.
8. Confirm the Rak'ah display immediately returns to `1`.
9. Confirm the positioning band returns.
10. Confirm the Reset button disappears during positioning.
11. Confirm the browser does **not** ask for camera permission again.
12. Confirm the AI model does **not** download again.
13. Move the phone/user enough that the old standing calibration would be inappropriate, then position correctly again.
14. Hold a valid position using the existing setup rules.
15. Confirm the app runs `5, 4, 3, 2, 1, 0` again.
16. Confirm tracking begins only after the fresh calibration completes.
17. Complete a normal Rak'ah and confirm counting starts from the clean session.

### Important note about the known deferred issue

During the test above, the existing positioning/countdown system may still occasionally restart the countdown even when the user believes they are standing still. **Do not tune that behavior as part of this implementation.** The success condition for this plan is that Reset correctly re-enters the same existing positioning/calibration workflow. Sensitivity/reliability tuning is a separate future implementation plan.

### Camera error test

1. Revoke/deny camera permission.
2. Press Start.
3. Confirm the message specifically says permission was denied and explains what to do.
4. Re-enable permission.
5. Retry and confirm the app can start without reloading the model.

Where practical, also test another camera failure condition (for example camera busy on a device/browser that allows reproduction) and confirm it does not say "permission denied".

### TensorFlow pin test

Inspect the deployed HTML/network requests and confirm the four package requests contain:

```text
@tensorflow/tfjs-core@4.22.0
@tensorflow/tfjs-converter@4.22.0
@tensorflow/tfjs-backend-webgl@4.22.0
@tensorflow-models/pose-detection@2.1.3
```

Confirm normal model initialization and pose tracking still work on the phone after pinning.

---

# File-by-file planned changes

## `index.html`

Change only the TensorFlow vendor script URLs to exact versions.

No Reset markup changes are required.

No new error modal is required.

## `js/app.js`

Planned changes:

- make Reset a full session reset,
- call/reuse `beginPositioning()` after clearing Rak'ah progress,
- add defensive Reset state guard,
- keep camera/model/render loop alive during Reset,
- safely access TensorFlow browser globals,
- stop defaulting unknown model startup errors to STORAGE/NETWORK,
- add camera error classification,
- route camera errors to precise user messages.

Do not alter prayer detection thresholds.

## `js/model-manager.js`

Planned changes:

- typed missing-library error,
- typed saved-store read error,
- precise remote-download error,
- precise storage-write error,
- preserve invalid-model error,
- typed detector-initialization error,
- preserve current model download/cache behavior.

## `js/settings-manager.js`

Add Arabic/English strings for the new error categories.

Do not change settings schema, storage key, voice logic, language logic, or Quiet Mode behavior.

## `js/setup-guide.js`

**No behavior change planned.**

Do not tune `invalidCountdownGraceMs` or other setup thresholds.

## `js/standing-detector.js`

**No behavior change planned.**

Its existing `reset()` and countdown functions are reused as-is unless a strictly testability-only correction is proven necessary.

## `css/styles.css`

No styling change should be necessary. Reuse the existing model error block and main status/sub-status UI.

## `tests/app-flow.test.js`

New integration-style Node/VM regression tests for:

- Reset state transition,
- fresh calibration requirement,
- counter/partial-return cleanup,
- no camera/model restart,
- 5-to-0 path after Reset,
- camera error classification.

## `tests/model-manager.test.js`

Add precise model error-code tests while preserving existing cache/download tests.

## `tests/settings-manager.test.js`

Add translation completeness tests for new error messages.

## `tests/verify-split.ps1`

Add structural protections for:

- exact TensorFlow versions,
- no unversioned TensorFlow URLs,
- new error taxonomy,
- Reset connection to the existing setup pipeline.

## Local HTTPS launcher files

No production-path change is planned. Keep them working and keep their existing tests passing, but do not redesign the old Quick Tunnel system in this plan.

---

# Acceptance Criteria

The implementation is complete only when all of the following are true.

## Reset

- Pressing Reset in `TRACKING_PRAYER` sets the Rak'ah display to 1.
- `standReturnCount` is cleared.
- `isCurrentlyDown` is cleared.
- The standing detector returns to `UNCALIBRATED`.
- The old `standingFaceY` is gone.
- Old calibration samples/candidate timers are gone.
- The app returns to `POSITIONING`.
- The positioning overlay becomes visible.
- Reset does not reopen camera permission.
- Reset does not stop/reopen the camera.
- Reset does not reload/redownload the model.
- Reset does not create a second render loop.
- A valid new position enters the existing countdown.
- The countdown remains exactly 5, 4, 3, 2, 1, 0.
- A new calibration is created only from post-Reset samples.
- Prayer tracking resumes only after fresh calibration succeeds.

## Errors

- Missing TensorFlow/pose-detection libraries are not reported as storage failure.
- IndexedDB read/access failure is distinguishable from model download failure.
- Remote model download failure is distinguishable from model save failure.
- Detector creation failure is not reported as network/storage failure.
- Camera permission denial is reported specifically as permission denial.
- Missing camera is not reported as permission denial.
- Busy/unreadable camera is not reported as permission denial.
- Unsupported camera API/WebView has its own message.
- Unknown errors use a neutral unexpected-error message.
- Every new message exists in both Arabic and English.

## TensorFlow lock

- `tfjs-core` is pinned to `4.22.0`.
- `tfjs-converter` is pinned to `4.22.0`.
- `tfjs-backend-webgl` is pinned to `4.22.0`.
- `pose-detection` is pinned to `2.1.3`.
- No unversioned TensorFlow vendor script remains in `index.html`.
- Structural tests fail if a future edit removes those exact pins.
- MoveNet Lightning remains model version 4.
- IndexedDB model cache key remains the v4 key.

## Scope protection

- No setup sensitivity threshold is changed.
- No standing detector threshold is changed.
- The false countdown restart/standing-stability issue is not claimed as fixed.
- No Android WebView wrapper is added.
- No payment/licensing system is added.
- No framework/bundler migration is added.
- Existing Settings behavior remains intact.
- Existing model caching remains intact.
- Existing Rak'ah counting rule remains intact.
- All automated tests and syntax checks pass.
- Final real-phone test succeeds through the permanent Cloudflare deployment.

---

# Expected final flow after this plan

```text
OPEN RACAT
    |
    v
load pinned TensorFlow.js libraries
    |
    v
check cached MoveNet v4
    |
    +-- known model/storage/library error --> precise Arabic/English error
    |
    v
MAIN_READY
    |
    | Start
    v
request camera
    |
    +-- permission/missing/busy/unsupported error --> precise camera message
    |
    v
POSITIONING
    |
    v
5 -> 4 -> 3 -> 2 -> 1 -> 0
    |
    v
fresh standing calibration
    |
    v
TRACKING_PRAYER
    |
    | Reset
    v
clear Rak'ah + old calibration
    |
    v
POSITIONING
    |
    v
5 -> 4 -> 3 -> 2 -> 1 -> 0
    |
    v
fresh standing calibration
    |
    v
TRACKING_PRAYER
```

This plan intentionally fixes **Reset correctness, error accuracy, and dependency stability** while leaving positioning sensitivity tuning for the next dedicated reliability plan.