# Simplified Face Guide and Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the useful face-distance check, replace the confusing face circle with a clear highlighted area at the top of the camera, remove lighting and phone-angle checks, and add a saved Settings page for language, voice, and Quiet Mode.

**Architecture:** Keep the existing model-download flow and prayer counter unchanged. Simplify `setup-guide.js` so it decides only whether a face is visible, correctly sized, and inside the top face area. Add a small `settings-manager.js` module that owns language, speech voice, Quiet Mode, translations, and localStorage persistence; show Settings as an in-app page so opening it does not reload the application.

**Tech Stack:** HTML, CSS, browser JavaScript, TensorFlow.js MoveNet, Web Speech API, localStorage, Node.js built-in test runner, PowerShell structural tests

## Global Constraints

- Create a new Git backup commit and annotated tag before changing application code.
- Do not implement any application change before that backup succeeds.
- Keep the existing IndexedDB AI-model download, verification, and reuse behavior.
- Keep face-distance checking.
- Distance is an estimate from the face width in the camera image; do not claim that it is a measurement in meters.
- Remove the oval/circle face target completely.
- Replace it with one highlighted horizontal face area at the top of the camera.
- While the face is outside the highlighted area, show “Your face should be here” inside that area in the selected language.
- When the face enters the accepted area at an accepted distance, hide that message.
- Keep the highlighted area visible and green during the 5-to-0 countdown, then remove it when prayer tracking begins.
- Remove all phone-orientation permission, listeners, values, messages, and blocking rules.
- Remove all lighting canvas sampling, brightness calculations, messages, and blocking rules.
- Add a Settings button and an in-app Settings page with a Back button.
- Default language is Arabic. English is also available.
- Language selection controls both visible interface text and spoken instructions.
- Let the user select a speech voice from voices available through `speechSynthesis.getVoices()`.
- Put voices matching the selected language first; keep other device voices available below them.
- Add Quiet Mode to turn all application speech off or on. Default is off, meaning speech is enabled.
- Save language, selected voice, and Quiet Mode in localStorage.
- Do not add vibration, volume testing, recalibration, wake lock, APK/WebView packaging, or a first-use tutorial in this implementation.
- Do not change the standing detector or Rak’ah counting rules.

---

## Final user flow

```text
OPEN APP
  -> existing model check/download flow
  -> MAIN_READY
      -> Settings button -> SETTINGS -> Back -> MAIN_READY
      -> Start button -> camera permission -> POSITIONING

POSITIONING
  -> no reliable face -> show face-area prompt
  -> face too close -> keep area highlighted + say/show “Move back one step”
  -> face too far -> keep area highlighted + say/show “Move closer one step”
  -> face above/below area -> show “Your face should be here” inside the top area
  -> correct face area + correct distance for 800 ms
      -> hide prompt
      -> make top area green
      -> count 5, 4, 3, 2, 1, 0
      -> TRACKING_PRAYER

TRACKING_PRAYER
  -> remove the entire positioning guide
  -> run the existing standing detector and Rak’ah counter only
```

## File structure

- Create `settings-manager.js`: defaults, validation, localStorage persistence, translations, voice ordering, and preferred-voice selection.
- Create `tests/settings-manager.test.js`: settings, persistence, translation, and voice-selection tests.
- Modify `setup-guide.js`: keep face feature extraction, face-size distance estimation, and face-area classification; remove brightness and orientation code.
- Modify `tests/setup-guide.test.js`: remove lighting/angle tests and cover the simplified classifier.
- Modify `index.html`: remove the lighting canvas and oval target; add the top face band, Settings button, and Settings page.
- Modify `styles.css`: remove circle styles and add the top highlighted band and Settings page styling.
- Modify `app.js`: remove lighting/orientation behavior; connect the simplified guide, settings page, translations, selected speech voice, and Quiet Mode.
- Modify `tests/verify-split.ps1`: enforce the new files and markup, and reject the removed lighting/orientation/circle features.
- Modify `start-https-server.ps1`: include `settings-manager.js` in local/public verification.

## Stable interfaces

`setup-guide.js` must expose:

```javascript
SetupGuide.SETUP_CONFIG
SetupGuide.extractSetupFeatures(keypoints, videoWidth, videoHeight, config)
SetupGuide.classifySetup(features, config)
```

`settings-manager.js` must expose:

```javascript
SettingsManager.DEFAULT_SETTINGS
SettingsManager.loadSettings(storage)
SettingsManager.saveSettings(settings, storage)
SettingsManager.normalizeSettings(value)
SettingsManager.translate(key, language, replacements)
SettingsManager.sortVoices(voices, language)
SettingsManager.findVoice(voices, voiceURI, language)
```

---

### Task 1: Create the required Git safety point

**Files:**
- No application files may be modified in this task.

**Interfaces:**
- Produces: one backup commit and one annotated backup tag pointing to the exact working application before this plan is implemented.

- [ ] **Step 1: Confirm the current repository state**

Run:

```powershell
git status --short
git branch --show-current
```

Expected: the current branch and every existing modified/untracked project file are visible. Do not include unrelated `.tools/` content.

- [ ] **Step 2: Stage only the current application version**

Run `git add` with an explicit list of existing project files. Verify with:

```powershell
git diff --cached --name-only
```

Expected: only the application, tests, and implementation-plan files that belong to the current working version are staged.

- [ ] **Step 3: Create and verify the backup**

```powershell
git commit -m "chore: back up app before simplified guide and settings"
git tag -a backup-before-settings-guide -m "Working app before simplified guide and settings"
git show --no-patch --oneline HEAD
git tag --list backup-before-settings-guide
```

Expected: the commit succeeds and the tag exists. Stop immediately if either operation fails; no following task is allowed to begin.

---

### Task 2: Simplify face placement and distance logic

**Files:**
- Modify: `setup-guide.js`
- Modify: `tests/setup-guide.test.js`

**Interfaces:**
- Consumes: MoveNet face keypoints plus video width and height.
- Produces: only `FACE_NOT_VISIBLE`, `MOVE_BACK_ONE_STEP`, `MOVE_CLOSER_ONE_STEP`, `FACE_OUTSIDE_TARGET`, or `POSITION_CORRECT`.

- [ ] **Step 1: Replace the setup tests first**

Tests must cover these exact cases:

```javascript
test('returns FACE_NOT_VISIBLE when fewer than two reliable face points exist', () => {});
test('returns MOVE_BACK_ONE_STEP when the face looks too large', () => {});
test('returns MOVE_CLOSER_ONE_STEP when the face looks too small', () => {});
test('returns FACE_OUTSIDE_TARGET when the face center is below the top area', () => {});
test('returns FACE_OUTSIDE_TARGET when the face center is above the top area', () => {});
test('returns POSITION_CORRECT for correct distance and top position', () => {});
test('does not require lighting information', () => {});
test('does not require orientation information', () => {});
```

Delete tests for `IMPROVE_LIGHTING`, `FIX_PHONE_ANGLE`, brightness samples, lighting monitoring, and phone-angle normalization.

- [ ] **Step 2: Run the new tests and verify RED**

```powershell
node --test tests/setup-guide.test.js
```

Expected: FAIL because the old classifier still returns lighting, angle, and separate high/low results.

- [ ] **Step 3: Reduce the central setup configuration**

Replace `SETUP_CONFIG` with:

```javascript
const SETUP_CONFIG = Object.freeze({
    faceConfidence: 0.35,
    targetBandTop: 0.08,
    targetBandBottom: 0.30,
    minimumFaceWidth: 0.055,
    maximumFaceWidth: 0.16,
    validPositionMs: 800,
    invalidCountdownGraceMs: 250,
    instructionSpeechCooldownMs: 2000
});
```

Keep these numbers centralized because real-phone testing may tune them later.

- [ ] **Step 4: Keep distance estimation honest and simple**

Continue extracting reliable `nose`, eye, and ear keypoints. Calculate:

```javascript
const faceCenterY = median(facePoints.map(point => point.y)) / videoHeight;
const faceWidth = (maximumFaceX - minimumFaceX) / videoWidth;
```

`faceWidth` is only an image-size estimate:

```javascript
if (faceWidth > config.maximumFaceWidth) return 'MOVE_BACK_ONE_STEP';
if (faceWidth < config.minimumFaceWidth) return 'MOVE_CLOSER_ONE_STEP';
```

- [ ] **Step 5: Implement one position result for the highlighted area**

```javascript
function classifySetup(features, config = SETUP_CONFIG) {
    if (!features.faceVisible) return 'FACE_NOT_VISIBLE';
    if (features.faceWidth > config.maximumFaceWidth) return 'MOVE_BACK_ONE_STEP';
    if (features.faceWidth < config.minimumFaceWidth) return 'MOVE_CLOSER_ONE_STEP';

    const insideTarget = features.faceCenterY >= config.targetBandTop
        && features.faceCenterY <= config.targetBandBottom;

    return insideTarget ? 'POSITION_CORRECT' : 'FACE_OUTSIDE_TARGET';
}
```

Delete `measureBrightness`, `createLightingMonitor`, `normalizePhoneAngle`, and their exports.

- [ ] **Step 6: Run the tests and verify GREEN**

```powershell
node --test tests/setup-guide.test.js
```

Expected: all simplified setup-guide tests pass.

- [ ] **Step 7: Commit the isolated logic change**

```powershell
git add setup-guide.js tests/setup-guide.test.js
git commit -m "refactor: simplify pre-prayer face checks"
```

---

### Task 3: Replace the face circle with a highlighted top area

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `app.js`
- Modify: `tests/verify-split.ps1`

**Interfaces:**
- Consumes: simplified setup results from Task 2.
- Produces: `#face-position-band`, `#face-position-label`, and `#setup-message` behavior.

- [ ] **Step 1: Write failing structural checks**

Require:

```powershell
$requiredGuideMarkup = @(
    'id="positioning-overlay"',
    'id="face-position-band"',
    'id="face-position-label"',
    'id="setup-message"'
)
```

Reject removed markup:

```powershell
$forbiddenGuideMarkup = @(
    'id="face-target"',
    'id="lighting-sample"'
)
```

Also require `.face-position-band` in `styles.css` and reject `.face-target` and `.lighting-sample`.

- [ ] **Step 2: Run the structural test and verify RED**

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/verify-split.ps1
```

Expected: FAIL because the old circle and lighting canvas still exist.

- [ ] **Step 3: Replace the positioning markup**

Use this structure inside `#positioning-overlay`:

```html
<div id="face-position-band" class="face-position-band is-waiting">
    <span id="face-position-label" class="face-position-label" data-i18n="face_here">
        يجب أن يكون وجهك هنا
    </span>
</div>
<div id="countdown-display" class="countdown-display" hidden></div>
<div id="setup-message" class="setup-message" aria-live="polite"></div>
```

Completely remove the old `#face-target`, check mark, and hidden lighting canvas.

- [ ] **Step 4: Style the top area as a band, not a face outline**

```css
.face-position-band {
    position: absolute;
    top: 8%;
    left: 5%;
    width: 90%;
    height: 22%;
    display: grid;
    place-items: center;
    border: 2px solid #facc15;
    border-radius: 18px;
    background: rgba(250, 204, 21, 0.18);
    box-shadow: 0 0 24px rgba(250, 204, 21, 0.30);
    transition: background 180ms ease, border-color 180ms ease, opacity 180ms ease;
}

.face-position-band.is-correct {
    border-color: #22c55e;
    background: rgba(34, 197, 94, 0.16);
    box-shadow: 0 0 24px rgba(34, 197, 94, 0.32);
}

.face-position-band.is-correct .face-position-label {
    opacity: 0;
}
```

Do not use an oval, head outline, or moving circle animation.

- [ ] **Step 5: Connect exact UI behavior**

Use this result mapping:

```javascript
const GUIDE_MESSAGE_KEYS = Object.freeze({
    FACE_NOT_VISIBLE: 'face_here',
    FACE_OUTSIDE_TARGET: 'face_here',
    MOVE_BACK_ONE_STEP: 'move_back',
    MOVE_CLOSER_ONE_STEP: 'move_closer'
});
```

- `FACE_NOT_VISIBLE` or `FACE_OUTSIDE_TARGET`: yellow band; show “Your face should be here” inside it.
- `MOVE_BACK_ONE_STEP`: yellow band; show the distance correction in `#setup-message` and speak it with cooldown.
- `MOVE_CLOSER_ONE_STEP`: yellow band; show the distance correction in `#setup-message` and speak it with cooldown.
- `POSITION_CORRECT`: green band; clear both guide messages; begin the existing 800 ms stable-position timer.
- `COUNTDOWN`: keep the band green and its label hidden.
- `TRACKING_PRAYER`: hide the entire positioning overlay.

- [ ] **Step 6: Run structural and setup tests**

```powershell
node --test tests/setup-guide.test.js
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/verify-split.ps1
```

Expected: both commands pass.

- [ ] **Step 7: Commit the guide replacement**

```powershell
git add index.html styles.css app.js tests/verify-split.ps1
git commit -m "feat: replace face circle with top position band"
```

---

### Task 4: Remove lighting and phone-orientation behavior from the application

**Files:**
- Modify: `app.js`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `tests/verify-split.ps1`

**Interfaces:**
- Consumes: Task 2 simplified `SetupGuide` API.
- Produces: positioning that depends only on face visibility, image face size, and face center.

- [ ] **Step 1: Add forbidden-code checks**

Make `tests/verify-split.ps1` fail if `app.js`, `setup-guide.js`, or `index.html` contains any of these feature tokens:

```powershell
$removedFeatureTokens = @(
    'lighting-sample',
    'lightingCanvas',
    'lightingContext',
    'lightingMonitor',
    'sampleLighting',
    'deviceorientation',
    'DeviceOrientationEvent',
    'orientationListenerActive',
    'startOrientationMonitoring',
    'stopOrientationMonitoring',
    'FIX_PHONE_ANGLE',
    'IMPROVE_LIGHTING'
)
```

- [ ] **Step 2: Run the structural test and verify RED**

Expected: FAIL while old lighting and orientation code remains.

- [ ] **Step 3: Delete the removed feature lifecycle**

From `app.js`, remove:

- Lighting canvas/context variables.
- Lighting-monitor creation and reset calls.
- Brightness sampling and its 250 ms timer.
- Orientation values and listener state.
- Orientation permission requests.
- Orientation start/stop functions and event handler.
- Lighting and angle feature properties passed to `classifySetup()`.
- Lighting and phone-angle messages.

The setup call must become:

```javascript
const features = SetupGuide.extractSetupFeatures(
    pose?.keypoints || [],
    video.videoWidth,
    video.videoHeight
);
const result = SetupGuide.classifySetup(features);
```

- [ ] **Step 4: Verify that Start asks only for camera permission**

`startApp()` may call `navigator.mediaDevices.getUserMedia()`. It must not request motion/orientation permission and must not create a lighting canvas.

- [ ] **Step 5: Run all current tests**

```powershell
node --test tests/model-manager.test.js tests/setup-guide.test.js tests/standing-detector.test.js
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/verify-split.ps1
node --check app.js
node --check setup-guide.js
```

Expected: all tests and syntax checks pass.

- [ ] **Step 6: Commit the removal**

```powershell
git add app.js index.html styles.css setup-guide.js tests/setup-guide.test.js tests/verify-split.ps1
git commit -m "refactor: remove lighting and orientation setup checks"
```

---

### Task 5: Add persistent settings and translations

**Files:**
- Create: `settings-manager.js`
- Create: `tests/settings-manager.test.js`
- Modify: `index.html`

**Interfaces:**
- Produces: the `SettingsManager` API defined above.
- Consumes: browser localStorage and SpeechSynthesisVoice-like objects.

- [ ] **Step 1: Write failing settings tests**

```javascript
test('uses Arabic, system voice, and speech enabled by default', () => {});
test('normalizes unknown language back to Arabic', () => {});
test('loads valid settings from localStorage', () => {});
test('returns defaults when stored JSON is corrupt', () => {});
test('saves only normalized settings', () => {});
test('translates a message into Arabic and English', () => {});
test('places matching-language voices before other voices', () => {});
test('finds the saved voice by voiceURI', () => {});
test('falls back to a matching-language default voice', () => {});
```

Use an in-memory storage fake; tests must not depend on a real browser.

- [ ] **Step 2: Run tests and verify RED**

```powershell
node --test tests/settings-manager.test.js
```

Expected: FAIL because `settings-manager.js` does not exist.

- [ ] **Step 3: Define normalized saved settings**

```javascript
const STORAGE_KEY = 'racat-settings-v1';

const DEFAULT_SETTINGS = Object.freeze({
    language: 'ar',
    voiceURI: '',
    quietMode: false
});

function normalizeSettings(value) {
    return {
        language: value?.language === 'en' ? 'en' : 'ar',
        voiceURI: typeof value?.voiceURI === 'string' ? value.voiceURI : '',
        quietMode: value?.quietMode === true
    };
}
```

`loadSettings()` must catch invalid JSON or blocked localStorage and return defaults. `saveSettings()` must normalize before writing and return the normalized value.

- [ ] **Step 4: Add exact Arabic and English text keys**

```javascript
const TEXT = Object.freeze({
    ar: {
        settings: 'الإعدادات',
        settings_title: 'إعدادات التطبيق',
        back: 'رجوع',
        language: 'اللغة',
        arabic: 'العربية',
        english: 'English',
        voice: 'الصوت',
        system_voice: 'الصوت الافتراضي للجهاز',
        quiet_mode: 'الوضع الهادئ',
        quiet_description: 'إيقاف جميع التعليمات الصوتية',
        start_prayer: 'ابدأ الصلاة الآن',
        current_rakat: 'الركعة الحالية',
        model_ready: 'النموذج جاهز',
        tap_start: 'اضغط على زر البدء لتشغيل الكاميرا',
        face_here: 'يجب أن يكون وجهك هنا',
        move_back: 'ارجع خطوة واحدة إلى الخلف',
        move_closer: 'اقترب خطوة واحدة',
        position_correct: 'ممتاز، توقف في مكانك',
        camera_denied: 'يجب السماح للكاميرا حتى يعمل عداد الركعات',
        reset: 'إعادة الضبط',
        rakat_number: 'الركعة {count}'
    },
    en: {
        settings: 'Settings',
        settings_title: 'Application Settings',
        back: 'Back',
        language: 'Language',
        arabic: 'Arabic',
        english: 'English',
        voice: 'Voice',
        system_voice: 'Device default voice',
        quiet_mode: 'Quiet Mode',
        quiet_description: 'Turn off all spoken instructions',
        start_prayer: 'Start prayer now',
        current_rakat: 'Current Rak’ah',
        model_ready: 'Model ready',
        tap_start: 'Press Start to turn on the camera',
        face_here: 'Your face should be here',
        move_back: 'Move back one step',
        move_closer: 'Move closer one step',
        position_correct: 'Great, stop in your place',
        camera_denied: 'Camera permission is required for the counter',
        reset: 'Reset',
        rakat_number: 'Rak’ah {count}'
    }
});
```

`translate()` must fall back to Arabic and replace `{count}` safely.

- [ ] **Step 5: Sort and choose browser voices**

```javascript
function sortVoices(voices, language) {
    const prefix = language === 'en' ? 'en' : 'ar';
    return [...voices].sort((left, right) => {
        const leftMatch = left.lang?.toLowerCase().startsWith(prefix) ? 0 : 1;
        const rightMatch = right.lang?.toLowerCase().startsWith(prefix) ? 0 : 1;
        return leftMatch - rightMatch || left.name.localeCompare(right.name);
    });
}

function findVoice(voices, voiceURI, language) {
    if (voiceURI) {
        const saved = voices.find(voice => voice.voiceURI === voiceURI);
        if (saved) return saved;
    }
    const prefix = language === 'en' ? 'en' : 'ar';
    return voices.find(voice => voice.default && voice.lang?.toLowerCase().startsWith(prefix))
        || voices.find(voice => voice.lang?.toLowerCase().startsWith(prefix))
        || null;
}
```

- [ ] **Step 6: Load the module before `app.js`**

```html
<script src="model-manager.js"></script>
<script src="setup-guide.js"></script>
<script src="standing-detector.js"></script>
<script src="settings-manager.js"></script>
<script src="app.js"></script>
```

- [ ] **Step 7: Run tests and verify GREEN**

```powershell
node --test tests/settings-manager.test.js
node --check settings-manager.js
```

Expected: all settings tests and syntax checks pass.

- [ ] **Step 8: Commit the settings foundation**

```powershell
git add settings-manager.js tests/settings-manager.test.js index.html
git commit -m "feat: add persistent language and voice settings"
```

---

### Task 6: Build the Settings page and Back navigation

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `app.js`
- Modify: `tests/verify-split.ps1`

**Interfaces:**
- Consumes: `SettingsManager.loadSettings()`, `saveSettings()`, `sortVoices()`, and `translate()`.
- Produces: `openSettings()`, `closeSettings()`, `renderSettings()`, `populateVoiceOptions()`, and `applyLanguage()`.

- [ ] **Step 1: Add failing structural requirements**

Require these IDs:

```powershell
$requiredSettingsMarkup = @(
    'id="settingsBtn"',
    'id="settings-view"',
    'id="settingsBackBtn"',
    'id="languageSelect"',
    'id="voiceSelect"',
    'id="quietModeToggle"'
)
```

Require `settings-manager.js` before `app.js` and require a new `SETTINGS` application state.

- [ ] **Step 2: Run the structural test and verify RED**

Expected: FAIL because the Settings page is not present.

- [ ] **Step 3: Add the Settings button and page**

Add a gear button to the main Start screen and this separate in-app view:

```html
<section id="settings-view" class="app-view settings-view" hidden>
    <div class="settings-card">
        <header class="settings-header">
            <button id="settingsBackBtn" class="settings-back" type="button" onclick="closeSettings()">
                <span aria-hidden="true">←</span>
                <span data-i18n="back">رجوع</span>
            </button>
            <h1 data-i18n="settings_title">إعدادات التطبيق</h1>
        </header>

        <label class="setting-row" for="languageSelect">
            <span data-i18n="language">اللغة</span>
            <select id="languageSelect">
                <option value="ar">العربية</option>
                <option value="en">English</option>
            </select>
        </label>

        <label class="setting-row" for="voiceSelect">
            <span data-i18n="voice">الصوت</span>
            <select id="voiceSelect"></select>
        </label>

        <label class="setting-toggle-row" for="quietModeToggle">
            <span>
                <strong data-i18n="quiet_mode">الوضع الهادئ</strong>
                <small data-i18n="quiet_description">إيقاف جميع التعليمات الصوتية</small>
            </span>
            <input id="quietModeToggle" type="checkbox">
        </label>
    </div>
</section>
```

Do not add vibration, volume-test, recalibration, or wake-lock controls.

- [ ] **Step 4: Add Settings view state**

Add:

```javascript
SETTINGS: 'SETTINGS'
```

`openSettings()` is allowed only from `MAIN_READY`. It hides `#main-view`, shows `#settings-view`, and renders current values. `closeSettings()` saves current values and returns to `MAIN_READY`. It must not restart, download, or dispose the AI model.

- [ ] **Step 5: Populate voices reliably**

Call `speechSynthesis.getVoices()` immediately and also listen for `voiceschanged`, because Android/WebView voices may appear after page load. Add the system-default option first, then language-matching voices, then other voices. Save the selected `voiceURI`, not the visible voice name.

- [ ] **Step 6: Save every setting change**

```javascript
function readSettingsForm() {
    return {
        language: document.getElementById('languageSelect').value,
        voiceURI: document.getElementById('voiceSelect').value,
        quietMode: document.getElementById('quietModeToggle').checked
    };
}
```

On `change`, normalize and save the new object. Language changes must immediately update text direction (`rtl` for Arabic and `ltr` for English), visible text, and voice ordering.

- [ ] **Step 7: Style the page for a phone**

Use the existing dark background and green accent. The Back button must be easy to reach, select controls must be at least 48 px high, the Quiet Mode row must be one large touch target, and the layout must fit a narrow Android screen without horizontal scrolling.

- [ ] **Step 8: Run structural verification**

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/verify-split.ps1
```

Expected: PASS with the Settings button, page, controls, script order, and no forbidden controls.

- [ ] **Step 9: Commit the Settings interface**

```powershell
git add index.html styles.css app.js tests/verify-split.ps1
git commit -m "feat: add application settings page"
```

---

### Task 7: Apply language, selected voice, and Quiet Mode everywhere

**Files:**
- Modify: `app.js`
- Modify: `index.html`
- Modify: `tests/settings-manager.test.js`

**Interfaces:**
- Consumes: current normalized settings and translated message keys.
- Produces: translated UI and speech that uses the chosen device voice.

- [ ] **Step 1: Add tests for speech decisions**

Add pure tests proving:

```javascript
test('Quiet Mode prevents an utterance from being created', () => {});
test('Arabic selects the saved Arabic voice', () => {});
test('English selects the saved English voice', () => {});
test('missing saved voice falls back without breaking speech', () => {});
```

Expose a pure `createSpeechRequest(messageKey, settings, voices, replacements)` helper from `settings-manager.js`. It must return `null` in Quiet Mode or this object otherwise:

```javascript
{
    text: 'translated text',
    language: 'ar-SA',
    voice: selectedVoiceOrNull
}
```

- [ ] **Step 2: Run tests and verify RED**

Expected: FAIL because speech requests do not yet use settings.

- [ ] **Step 3: Replace literal speech with message keys**

Change the application speech wrapper to:

```javascript
function speak(messageKey, replacements = {}) {
    const request = SettingsManager.createSpeechRequest(
        messageKey,
        currentSettings,
        availableVoices,
        replacements
    );
    if (!request) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(request.text);
    utterance.lang = request.language;
    if (request.voice) utterance.voice = request.voice;
    window.speechSynthesis.speak(utterance);
}
```

Countdown words must exist in Arabic and English. Rak’ah announcements must use `rakat_number` with `{count}` replacement.

- [ ] **Step 4: Apply language to visible UI**

Add `data-i18n` keys to static labels. `applyLanguage()` must translate every `[data-i18n]` element, update dynamic status messages, and set:

```javascript
document.documentElement.lang = currentSettings.language;
document.documentElement.dir = currentSettings.language === 'ar' ? 'rtl' : 'ltr';
```

- [ ] **Step 5: Confirm Quiet Mode affects speech only**

Quiet Mode must not hide visual instructions, stop the countdown, change the counter, or disable camera processing. It only prevents calls to `speechSynthesis.speak()`.

- [ ] **Step 6: Run tests and commit**

```powershell
node --test tests/settings-manager.test.js tests/setup-guide.test.js tests/standing-detector.test.js
node --check settings-manager.js
node --check app.js
```

Expected: all tests and syntax checks pass.

```powershell
git add settings-manager.js tests/settings-manager.test.js app.js index.html
git commit -m "feat: apply saved language voice and quiet mode"
```

---

### Task 8: Update HTTPS verification and perform regression testing

**Files:**
- Modify: `start-https-server.ps1`
- Modify: `tests/verify-split.ps1`

**Interfaces:**
- Consumes: all final application assets.
- Produces: complete static and real-browser verification.

- [ ] **Step 1: Verify the new local/public asset**

`start-https-server.ps1` must request both:

```text
/settings-manager.js
/app.js
```

It must verify that public HTML references `settings-manager.js` before `app.js`, and that the settings asset contains `racat-settings-v1`.

- [ ] **Step 2: Run every automated check**

```powershell
node --test tests/model-manager.test.js tests/setup-guide.test.js tests/settings-manager.test.js tests/standing-detector.test.js
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/verify-split.ps1
node --check model-manager.js
node --check setup-guide.js
node --check settings-manager.js
node --check standing-detector.js
node --check app.js
```

Expected: every command passes with zero failing tests.

- [ ] **Step 3: Browser-test Settings**

1. Open the app with the existing cached model.
2. Confirm the Settings gear is visible before Start.
3. Open Settings and confirm Back, Language, Voice, and Quiet Mode exist.
4. Confirm vibration, volume test, recalibration, and wake-lock options do not exist.
5. Select English; confirm the page direction and labels change immediately.
6. Select an available English voice and go Back.
7. Reload; confirm English and the selected voice remain saved.
8. Enable Quiet Mode; confirm visual instructions remain but no speech plays.
9. Disable Quiet Mode; confirm speech returns.

- [ ] **Step 4: Real-phone-test the simplified guide**

1. Confirm no phone-angle permission is requested.
2. Test in poor lighting and confirm no lighting warning appears.
3. Put the face outside the top area; confirm the highlighted area says the face should be there.
4. Put the face visually inside the highlighted area; confirm the message disappears.
5. Move too close; confirm “Move back one step.”
6. Move too far; confirm “Move closer one step.”
7. Hold a correct position for 800 ms; confirm the area becomes green and countdown starts.
8. Move out for more than 250 ms during countdown; confirm it safely returns to positioning.
9. Complete the countdown; confirm the whole highlighted area disappears.
10. Complete Ruku, Sujud, and sitting movements; confirm the existing Rak’ah behavior is unchanged and setup messages never return.

- [ ] **Step 5: Final diff review**

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors and no unrelated files included.

---

## Acceptance criteria

- A Git backup exists from before this implementation.
- The AI model download and IndexedDB cache still work exactly as before.
- Distance checking remains active before prayer.
- The application explains distance only as “move back” or “move closer”; it does not show fake meters.
- The oval/circle face target is completely removed.
- A clearly highlighted rectangular area appears at the top of the camera.
- The area says “Your face should be here” while the face is outside it.
- The area message disappears when the face is correctly placed.
- Correct placement turns the area green and starts the existing 5-to-0 flow after 800 ms.
- The guide disappears completely when prayer tracking begins.
- No lighting calculation, warning, canvas, or blocking rule remains.
- No phone-angle permission, listener, warning, or blocking rule remains.
- A visible Settings button opens an in-app Settings page.
- Back returns to the Start page without reloading the AI model.
- Arabic is the default language and English is available.
- Changing language updates visible text and spoken instructions.
- Available device voices appear in the voice list, with matching-language voices first.
- The selected voice, language, and Quiet Mode survive reloads through localStorage.
- Quiet Mode turns speech off without stopping visual guidance or tracking.
- No vibration, volume test, recalibration, wake-lock, tutorial, or APK work is added.
- Existing standing detection and Rak’ah counting rules remain unchanged.

## Important technical notes

- Distance is inferred from normalized face width. Different cameras, lenses, clothing, head turns, and partially missing face keypoints can affect it, so the thresholds must be tuned with real-phone tests.
- The highlighted band and the classifier share the exact same `8%` top and `30%` bottom limits. This prevents the old problem where the visual circle and the real accepted area disagreed.
- Browser voices belong to the device. Some Android devices may have only one Arabic or English voice, and voice lists can arrive after the page opens.
- localStorage saves user preferences only. The AI model remains in IndexedDB.
- Settings is an in-app page rather than a second HTML document, so returning does not reload the model or lose the ready detector.
