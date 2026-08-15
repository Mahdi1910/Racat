const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const SettingsManager = require(path.join(__dirname, '..', 'js', 'settings-manager.js'));
const RealStandingDetection = require(path.join(__dirname, '..', 'js', 'standing-detector.js'));
const DeveloperSettings = require(path.join(__dirname, '..', 'js', 'developer-settings.js'));

function createClassList() {
    const values = new Set();
    return {
        add(value) { values.add(value); },
        remove(value) { values.delete(value); },
        toggle(value, force) {
            if (force === true) values.add(value);
            else if (force === false) values.delete(value);
            else if (values.has(value)) values.delete(value);
            else values.add(value);
        },
        contains(value) { return values.has(value); }
    };
}

function createStyle() {
    return {
        display: '',
        setProperty(name, value) {
            this[name] = value;
        }
    };
}

function createElement(id) {
    const listeners = {};
    return {
        id,
        hidden: false,
        innerText: '',
        textContent: '',
        value: '',
        checked: false,
        dataset: {},
        style: createStyle(),
        className: '',
        classList: createClassList(),
        children: [],
        parentElement: { setAttribute() {} },
        addEventListener(name, callback) { listeners[name] = callback; },
        replaceChildren(...children) { this.children = children; },
        appendChild(child) { this.children.push(child); },
        setAttribute(name, value) { this[name] = value; },
        getContext() {
            return {
                clearRect() {}, beginPath() {}, arc() {}, fill() {}, fillStyle: ''
            };
        },
        _listeners: listeners
    };
}

function createStorage() {
    const values = new Map();
    return {
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            values.set(key, String(value));
        },
        snapshot() {
            return Object.fromEntries(values);
        }
    };
}

function createSetupGuide() {
    const SETUP_CONFIG = Object.freeze({
        faceConfidence: 0.35,
        targetBandTop: 0.01,
        targetBandBottom: 0.30,
        minimumFaceWidth: 0.02,
        maximumFaceWidth: 0.20,
        validPositionMs: 800,
        invalidCountdownGraceMs: 1500,
        instructionSpeechCooldownMs: 2000
    });

    return {
        SETUP_CONFIG,
        extractSetupFeatures(keypoints) {
            return keypoints?.setupFeatures || {
                faceVisible: true,
                faceCenterY: 0.2,
                faceWidth: 0.1
            };
        },
        classifySetup(features, config = SETUP_CONFIG) {
            if (features.result) return features.result;
            if (!features.faceVisible) return 'FACE_NOT_VISIBLE';
            if (features.faceWidth > config.maximumFaceWidth) return 'MOVE_BACK_ONE_STEP';
            if (features.faceWidth < config.minimumFaceWidth) return 'MOVE_CLOSER_ONE_STEP';
            return features.faceCenterY >= config.targetBandTop
                && features.faceCenterY <= config.targetBandBottom
                ? 'POSITION_CORRECT'
                : 'FACE_OUTSIDE_TARGET';
        }
    };
}

function createStandingDetection(countdownValues, useRealStandingDetection = false) {
    if (useRealStandingDetection) {
        return {
            ...RealStandingDetection,
            async runCountdown({
                from = RealStandingDetection.DEFAULT_CONFIG.countdownFrom,
                onTick,
                speakValue
            }) {
                for (let value = from; value >= 0; value--) {
                    countdownValues.push(value);
                    onTick(value);
                    speakValue(value);
                }
            }
        };
    }

    const StandingState = Object.freeze({
        UNCALIBRATED: 'UNCALIBRATED',
        STANDING: 'STANDING',
        NOT_STANDING: 'NOT_STANDING'
    });

    const DEFAULT_CONFIG = Object.freeze({
        faceConfidence: 0.35,
        countdownFrom: 5,
        calibrationDurationMs: 1000,
        minimumCalibrationSamples: 10,
        standingZoneRadius: 0.07,
        leaveStandingConfirmMs: 250,
        missingFaceConfirmMs: 400,
        returnToStandingConfirmMs: 600
    });

    function createStandingDetector(options = {}) {
        const config = { ...DEFAULT_CONFIG, ...options };
        let state = StandingState.UNCALIBRATED;
        let standingFaceY = null;
        let samples = [];

        return {
            reset() {
                state = StandingState.UNCALIBRATED;
                standingFaceY = null;
                samples = [];
            },
            clearCalibrationSamples() { samples = []; },
            addCalibrationSample(value) {
                if (!Number.isFinite(value)) return false;
                samples.push(value);
                return true;
            },
            finishCalibration() {
                if (samples.length < config.minimumCalibrationSamples) {
                    return { ok: false, reason: 'NOT_ENOUGH_SAMPLES' };
                }
                const sorted = [...samples].sort((a, b) => a - b);
                const middle = Math.floor(sorted.length / 2);
                standingFaceY = sorted.length % 2
                    ? sorted[middle]
                    : (sorted[middle - 1] + sorted[middle]) / 2;
                state = StandingState.STANDING;
                return { ok: true, standingFaceY };
            },
            getSnapshot() {
                return {
                    state,
                    standingFaceY,
                    calibrationSampleCount: samples.length,
                    config: { ...config }
                };
            },
            update() { return { state, transition: null }; }
        };
    }

    return {
        DEFAULT_CONFIG,
        StandingState,
        createStandingDetector,
        extractFaceY(keypoints, videoHeight, config = DEFAULT_CONFIG) {
            const reliable = (keypoints || []).filter(point => (
                Number.isFinite(point.y)
                && Number.isFinite(point.score)
                && point.score >= config.faceConfidence
            ));
            if (reliable.length === 0) return null;
            return reliable[0].y / videoHeight;
        },
        async runCountdown({ from = DEFAULT_CONFIG.countdownFrom, onTick, speakValue }) {
            for (let value = from; value >= 0; value--) {
                countdownValues.push(value);
                onTick(value);
                speakValue(value);
            }
        }
    };
}

function createHarness(options = {}) {
    const elementIds = [
        'model-view', 'main-view', 'settings-view', 'model-checking',
        'model-download-panel', 'downloadModelBtn', 'download-progress-panel',
        'retryModelBtn', 'startBtn', 'settingsBtn', 'resetBtn',
        'positioning-overlay', 'countdown-display', 'model-status-text',
        'model-error', 'model-download-description', 'status', 'status-dot',
        'sub-status', 'counter-display', 'setup-message', 'face-position-band',
        'face-position-label', 'video', 'output', 'languageSelect', 'voiceSelect',
        'quietModeToggle', 'model-progress', 'model-percentage', 'model-downloaded',
        'model-speed', 'developer-settings-list', 'developer-settings-error',
        'developerRestoreDefaultsBtn', 'developerSaveTestBtn'
    ];
    const elements = Object.fromEntries(elementIds.map(id => [id, createElement(id)]));
    elements.video.videoWidth = 1000;
    elements.video.videoHeight = 1000;
    elements.video.play = async () => {};

    const countdownValues = [];
    const calls = {
        getUserMedia: 0,
        createModelManager: 0,
        createDetector: 0,
        animationFrames: 0
    };
    let domReadyCallback = null;
    const localStorage = createStorage();

    const cameraError = options.cameraError;
    const navigatorValue = options.cameraUnsupported
        ? {}
        : {
            mediaDevices: {
                async getUserMedia() {
                    calls.getUserMedia++;
                    if (cameraError) throw cameraError;
                    return options.stream || { id: 'stream-1' };
                }
            }
        };

    const modelDetector = { id: 'movenet', estimatePoses: async () => [] };
    const modelManagerDouble = {
        createModelManager() {
            calls.createModelManager++;
            return {
                async hasValidModel() {
                    if (options.modelStartupError) throw options.modelStartupError;
                    return true;
                },
                async createDetector() {
                    calls.createDetector++;
                    return modelDetector;
                },
                async downloadModel() {}
            };
        },
        formatBytes() { return '0 MB'; },
        formatSpeed() { return '0 KB/s'; }
    };

    const context = {
        console,
        performance: { now: () => 0 },
        requestAnimationFrame() { calls.animationFrames++; },
        setTimeout,
        clearTimeout,
        navigator: navigatorValue,
        localStorage,
        tf: {},
        poseDetection: {},
        ModelManager: modelManagerDouble,
        SettingsManager,
        DeveloperSettings,
        SetupGuide: createSetupGuide(),
        StandingDetection: createStandingDetection(
            countdownValues,
            options.useRealStandingDetection === true
        ),
        SpeechSynthesisUtterance: function SpeechSynthesisUtterance(text) { this.text = text; },
        document: {
            documentElement: { lang: 'ar', dir: 'rtl' },
            title: '',
            getElementById(id) { return elements[id]; },
            querySelectorAll() { return []; },
            createElement(tag) { return createElement(tag); }
        },
        window: {
            addEventListener(name, callback) {
                if (name === 'DOMContentLoaded') domReadyCallback = callback;
            },
            speechSynthesis: {
                getVoices() { return []; },
                addEventListener() {},
                cancel() {},
                speak() {}
            }
        }
    };
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(appSource, context, { filename: 'app.js' });

    return {
        context,
        elements,
        calls,
        countdownValues,
        localStorage,
        modelDetector,
        getDomReadyCallback: () => domReadyCallback,
        evaluate(expression) { return vm.runInContext(expression, context); }
    };
}

function enterTracking(harness) {
    harness.evaluate('setAppState(AppState.TRACKING_PRAYER)');
    harness.evaluate('for (let i = 0; i < runtimeStandingConfig.minimumCalibrationSamples; i++) standingDetector.addCalibrationSample(0.2); standingDetector.finishCalibration()');
    harness.elements.video.srcObject = { id: 'existing-stream' };
    harness.evaluate("video = document.getElementById('video'); isRunning = true");
}

function setupResultPoints(result) {
    const points = [];
    points.setupFeatures = { result };
    return points;
}

test('Reset from tracking returns to positioning, clears calibration, and resets the counter', () => {
    const harness = createHarness();
    enterTracking(harness);
    harness.evaluate('rakatCount = 3; standReturnCount = 1; isCurrentlyDown = true');
    harness.elements['counter-display'].innerText = '3';

    harness.context.resetApp();

    assert.equal(harness.evaluate('appState'), 'POSITIONING');
    assert.equal(harness.evaluate('rakatCount'), 1);
    assert.equal(harness.evaluate('standReturnCount'), 0);
    assert.equal(harness.evaluate('isCurrentlyDown'), false);
    assert.equal(harness.elements['counter-display'].innerText, 1);
    assert.equal(harness.evaluate('standingDetector.getSnapshot().standingFaceY'), null);
    assert.equal(harness.evaluate('standingDetector.getSnapshot().state'), 'UNCALIBRATED');
    assert.equal(harness.elements.resetBtn.style.display, 'none');
    assert.equal(harness.elements['positioning-overlay'].hidden, false);
});

test('Reset does not recreate the model, detector, render loop, or camera stream', () => {
    const stream = { id: 'existing-stream' };
    const harness = createHarness({ stream });
    enterTracking(harness);
    harness.elements.video.srcObject = stream;

    harness.context.resetApp();

    assert.equal(harness.calls.createModelManager, 0);
    assert.equal(harness.calls.createDetector, 0);
    assert.equal(harness.calls.getUserMedia, 0);
    assert.equal(harness.elements.video.srcObject, stream);
    assert.equal(harness.evaluate('isRunning'), true);
});

test('Reset outside TRACKING_PRAYER is ignored', () => {
    const harness = createHarness();
    harness.evaluate('setAppState(AppState.MAIN_READY); rakatCount = 4');
    harness.elements['counter-display'].innerText = '4';

    harness.context.resetApp();

    assert.equal(harness.evaluate('appState'), 'MAIN_READY');
    assert.equal(harness.evaluate('rakatCount'), 4);
    assert.equal(harness.elements['counter-display'].innerText, '4');
});

test('Reset clears partial old-session return progress', () => {
    const harness = createHarness();
    enterTracking(harness);
    harness.context.handleStandingTransition('LEFT_STANDING');
    harness.context.handleStandingTransition('RETURNED_TO_STANDING');
    assert.equal(harness.evaluate('standReturnCount'), 1);

    harness.context.resetApp();
    harness.evaluate('for (let i = 0; i < runtimeStandingConfig.minimumCalibrationSamples; i++) standingDetector.addCalibrationSample(0.2); standingDetector.finishCalibration(); setAppState(AppState.TRACKING_PRAYER)');
    harness.context.handleStandingTransition('LEFT_STANDING');
    harness.context.handleStandingTransition('RETURNED_TO_STANDING');

    assert.equal(harness.evaluate('rakatCount'), 1);
    assert.equal(harness.evaluate('standReturnCount'), 1);
});

test('After Reset, a fresh valid position runs 5 through 0 and resumes tracking after calibration', async () => {
    const harness = createHarness();
    enterTracking(harness);
    harness.context.resetApp();

    const validPoints = [{ name: 'nose', y: 200, score: 0.9 }];
    for (let timestamp = 0; timestamp <= 900; timestamp += 100) {
        harness.context.processSetupFrame(validPoints, timestamp);
    }
    await new Promise(resolve => setImmediate(resolve));

    assert.deepEqual(harness.countdownValues, [5, 4, 3, 2, 1, 0]);
    assert.equal(harness.evaluate('appState'), 'TRACKING_PRAYER');
    assert.equal(harness.evaluate('standingDetector.getSnapshot().state'), 'STANDING');
    assert.equal(harness.elements.resetBtn.style.display, 'block');
    assert.equal(harness.elements['positioning-overlay'].hidden, true);
});

test('varied calibration samples complete the first countdown without a spread restart', () => {
    const harness = createHarness({ useRealStandingDetection: true });
    harness.evaluate('standingDetector = StandingDetection.createStandingDetector({ minimumCalibrationSamples: 10 })');
    const values = [0.10, 0.20, 0.11, 0.21, 0.12, 0.22, 0.13, 0.23, 0.14, 0.24];
    harness.evaluate(`(${JSON.stringify(values)}).forEach(value => standingDetector.addCalibrationSample(value))`);
    const result = harness.evaluate('standingDetector.finishCalibration()');

    assert.equal(result.ok, true);
    assert.equal(harness.evaluate('standingDetector.getSnapshot().state'), 'STANDING');
    assert.equal(harness.evaluate('standingDetector.getSnapshot().standingFaceY'), 0.17);
});

test('invalid positioning for less than 1500 ms does not cancel countdown', () => {
    const harness = createHarness();
    harness.evaluate('video = document.getElementById("video"); setAppState(AppState.COUNTDOWN)');
    const invalid = setupResultPoints('FACE_OUTSIDE_TARGET');

    harness.context.processSetupFrame(invalid, 1000);
    harness.context.processSetupFrame(invalid, 2499);

    assert.equal(harness.evaluate('appState'), 'COUNTDOWN');
});

test('continuous invalid positioning cancels countdown at 1500 ms', () => {
    const harness = createHarness();
    harness.evaluate('video = document.getElementById("video"); setAppState(AppState.COUNTDOWN)');
    const invalid = setupResultPoints('FACE_OUTSIDE_TARGET');

    harness.context.processSetupFrame(invalid, 1000);
    harness.context.processSetupFrame(invalid, 2499);
    assert.equal(harness.evaluate('appState'), 'COUNTDOWN');
    harness.context.processSetupFrame(invalid, 2500);

    assert.equal(harness.evaluate('appState'), 'POSITIONING');
    assert.equal(harness.elements['countdown-display'].innerText, '');
});

test('a valid result resets the continuous invalid countdown timer', () => {
    const harness = createHarness();
    harness.evaluate('video = document.getElementById("video"); setAppState(AppState.COUNTDOWN)');
    const invalid = setupResultPoints('FACE_OUTSIDE_TARGET');
    const valid = setupResultPoints('POSITION_CORRECT');

    harness.context.processSetupFrame(invalid, 1000);
    harness.context.processSetupFrame(invalid, 2000);
    harness.context.processSetupFrame(valid, 2100);
    harness.context.processSetupFrame(invalid, 2200);
    harness.context.processSetupFrame(invalid, 3699);

    assert.equal(harness.evaluate('appState'), 'COUNTDOWN');
    harness.context.processSetupFrame(invalid, 3700);
    assert.equal(harness.evaluate('appState'), 'POSITIONING');
});

test('countdown cancellation does not recreate camera or AI resources', () => {
    const harness = createHarness();
    harness.evaluate('video = document.getElementById("video"); setAppState(AppState.COUNTDOWN)');
    const invalid = setupResultPoints('FACE_OUTSIDE_TARGET');

    harness.context.processSetupFrame(invalid, 1000);
    harness.context.processSetupFrame(invalid, 2500);

    assert.equal(harness.evaluate('appState'), 'POSITIONING');
    assert.equal(harness.calls.getUserMedia, 0);
    assert.equal(harness.calls.createModelManager, 0);
    assert.equal(harness.calls.createDetector, 0);
});

test('Settings are accessible during active tracking and pause recognition state', () => {
    const harness = createHarness();
    enterTracking(harness);
    const beforeRunId = harness.evaluate('setupRunId');

    harness.context.openSettings();

    assert.equal(harness.evaluate('appState'), 'SETTINGS');
    assert.equal(harness.evaluate('settingsReturnState'), 'TRACKING_PRAYER');
    assert.equal(harness.evaluate('setupRunId'), beforeRunId + 1);
    assert.equal(harness.evaluate('isRunning'), true);
});

test('Save & Test applies runtime values, resets session, and reuses camera and MoveNet', async () => {
    const harness = createHarness();
    const stream = { id: 'existing-stream' };
    enterTracking(harness);
    harness.elements.video.srcObject = stream;
    harness.evaluate('detector = ({ id: "movenet-existing" }); rakatCount = 4; standReturnCount = 1; isCurrentlyDown = true');
    harness.elements['counter-display'].innerText = '4';

    harness.context.openSettings();
    harness.evaluate('developerInputElements.get("targetBandTopPct").value = "5"');
    harness.evaluate('developerInputElements.get("targetBandBottomPct").value = "35"');
    harness.evaluate('developerInputElements.get("minimumFaceWidthPct").value = "4"');
    harness.evaluate('developerInputElements.get("maximumFaceWidthPct").value = "24"');
    harness.evaluate('developerInputElements.get("validPositionSeconds").value = "0.2"');
    harness.evaluate('developerInputElements.get("invalidCountdownGraceSeconds").value = "2.4"');
    harness.evaluate('developerInputElements.get("trackingFaceConfidencePct").value = "50"');
    harness.evaluate('developerInputElements.get("countdownFrom").value = "3"');
    harness.evaluate('developerInputElements.get("minimumCalibrationSamples").value = "2"');
    harness.evaluate('developerInputElements.get("standingZoneRadiusPct").value = "9"');
    harness.evaluate('developerInputElements.get("leaveStandingConfirmSeconds").value = "0.4"');
    harness.evaluate('developerInputElements.get("missingFaceConfirmSeconds").value = "0.8"');
    harness.evaluate('developerInputElements.get("returnToStandingConfirmSeconds").value = "0.9"');

    const result = await harness.context.saveAndTestDeveloperSettings();

    assert.equal(result, true);
    assert.equal(harness.evaluate('appState'), 'POSITIONING');
    assert.equal(harness.evaluate('rakatCount'), 1);
    assert.equal(harness.evaluate('standReturnCount'), 0);
    assert.equal(harness.evaluate('isCurrentlyDown'), false);
    assert.equal(harness.elements['counter-display'].innerText, 1);
    assert.equal(harness.elements.video.srcObject, stream);
    assert.equal(harness.evaluate('detector.id'), 'movenet-existing');
    assert.equal(harness.calls.getUserMedia, 0);
    assert.equal(harness.calls.createModelManager, 0);
    assert.equal(harness.calls.createDetector, 0);
    assert.equal(harness.calls.animationFrames, 0);

    assert.equal(harness.evaluate('runtimeSetupConfig.targetBandTop'), 0.05);
    assert.equal(harness.evaluate('runtimeSetupConfig.targetBandBottom'), 0.35);
    assert.equal(harness.evaluate('runtimeSetupConfig.minimumFaceWidth'), 0.04);
    assert.equal(harness.evaluate('runtimeSetupConfig.maximumFaceWidth'), 0.24);
    assert.equal(harness.evaluate('runtimeSetupConfig.validPositionMs'), 200);
    assert.equal(harness.evaluate('runtimeSetupConfig.invalidCountdownGraceMs'), 2400);
    assert.equal(harness.evaluate('runtimeStandingConfig.faceConfidence'), 0.5);
    assert.equal(harness.evaluate('runtimeStandingConfig.countdownFrom'), 3);
    assert.equal(harness.evaluate('runtimeStandingConfig.minimumCalibrationSamples'), 2);
    assert.equal(harness.evaluate('standingDetector.getSnapshot().config.standingZoneRadius'), 0.09);
    assert.equal(harness.elements['face-position-band'].style['--face-band-top'], '5%');
    assert.equal(harness.elements['face-position-band'].style['--face-band-height'], '30%');

    const validPoints = [{ name: 'nose', y: 200, score: 0.9 }];
    harness.context.processSetupFrame(validPoints, 0);
    harness.context.processSetupFrame(validPoints, 200);
    await new Promise(resolve => setImmediate(resolve));

    assert.deepEqual(harness.countdownValues, [3, 2, 1, 0]);
    assert.equal(harness.evaluate('appState'), 'TRACKING_PRAYER');
});

test('Save & Test rejects invalid developer relationships without restarting', async () => {
    const harness = createHarness();
    enterTracking(harness);
    harness.context.openSettings();

    harness.evaluate('developerInputElements.get("targetBandTopPct").value = "40"');
    harness.evaluate('developerInputElements.get("targetBandBottomPct").value = "20"');
    const oldRunId = harness.evaluate('setupRunId');

    const result = await harness.context.saveAndTestDeveloperSettings();

    assert.equal(result, false);
    assert.equal(harness.evaluate('appState'), 'SETTINGS');
    assert.equal(harness.evaluate('setupRunId'), oldRunId);
    assert.equal(harness.evaluate('runtimeSetupConfig.targetBandTop'), 0.01);
    assert.equal(harness.elements['developer-settings-error'].hidden, false);
});

test('Restore Current Defaults changes the form but does not apply until Save & Test', () => {
    const harness = createHarness();
    harness.evaluate('setAppState(AppState.MAIN_READY)');
    harness.context.openSettings();

    harness.evaluate('developerInputElements.get("targetBandTopPct").value = "9"');
    harness.context.restoreDeveloperDefaults();

    assert.equal(harness.evaluate('developerInputElements.get("targetBandTopPct").value'), '1');
    assert.equal(harness.evaluate('runtimeSetupConfig.targetBandTop'), 0.01);
});

test('Back from active Settings discards unsaved developer edits and restarts positioning safely', () => {
    const harness = createHarness();
    const stream = { id: 'existing-stream' };
    enterTracking(harness);
    harness.elements.video.srcObject = stream;
    harness.evaluate('rakatCount = 3');
    harness.context.openSettings();
    harness.evaluate('developerInputElements.get("targetBandTopPct").value = "12"');

    harness.context.closeSettings();

    assert.equal(harness.evaluate('appState'), 'POSITIONING');
    assert.equal(harness.evaluate('runtimeSetupConfig.targetBandTop'), 0.01);
    assert.equal(harness.evaluate('rakatCount'), 1);
    assert.equal(harness.elements.video.srcObject, stream);
    assert.equal(harness.calls.getUserMedia, 0);
});

const cameraCases = [
    ['NotAllowedError', 'CAMERA_PERMISSION_DENIED'],
    ['PermissionDeniedError', 'CAMERA_PERMISSION_DENIED'],
    ['SecurityError', 'CAMERA_PERMISSION_DENIED'],
    ['NotFoundError', 'CAMERA_NOT_FOUND'],
    ['DevicesNotFoundError', 'CAMERA_NOT_FOUND'],
    ['NotReadableError', 'CAMERA_BUSY'],
    ['TrackStartError', 'CAMERA_BUSY'],
    ['OverconstrainedError', 'CAMERA_CONSTRAINTS'],
    ['ConstraintNotSatisfiedError', 'CAMERA_CONSTRAINTS'],
    ['AbortError', 'CAMERA_START_FAILED'],
    ['UnknownError', 'CAMERA_START_FAILED']
];

for (const [name, expected] of cameraCases) {
    test(`camera error ${name} maps to ${expected}`, () => {
        const harness = createHarness();
        assert.equal(harness.context.classifyCameraError({ name }), expected);
    });
}

test('unsupported camera API uses CAMERA_UNSUPPORTED', async () => {
    const harness = createHarness({ cameraUnsupported: true });

    await assert.rejects(
        harness.context.setupCamera(),
        error => error.code === 'CAMERA_UNSUPPORTED'
    );
});

test('camera permission denial shows the permission-specific message and returns to MAIN_READY', async () => {
    const error = new Error('denied');
    error.name = 'NotAllowedError';
    const harness = createHarness({ cameraError: error });

    await harness.context.startApp();

    assert.equal(harness.evaluate('appState'), 'MAIN_READY');
    assert.equal(
        harness.elements['sub-status'].innerText,
        SettingsManager.translate('camera_permission_denied', 'ar')
    );
    assert.equal(harness.elements.startBtn.style.display, 'flex');
});

test('uncoded model startup errors fall back to UNKNOWN instead of storage/network', async () => {
    const harness = createHarness({ modelStartupError: new Error('unexpected') });

    await harness.context.initializeApplication();

    assert.equal(harness.evaluate('appState'), 'ERROR');
    assert.equal(
        harness.elements['model-error'].innerText,
        SettingsManager.translate('error_unknown', 'ar')
    );
});
