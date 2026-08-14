const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const SettingsManager = require(path.join(__dirname, '..', 'js', 'settings-manager.js'));

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

function createElement(id) {
    return {
        id,
        hidden: false,
        innerText: '',
        textContent: '',
        value: '',
        checked: false,
        dataset: {},
        style: { display: '' },
        classList: createClassList(),
        children: [],
        parentElement: { setAttribute() {} },
        addEventListener() {},
        replaceChildren(...children) { this.children = children; },
        appendChild(child) { this.children.push(child); },
        setAttribute() {},
        getContext() {
            return {
                clearRect() {}, beginPath() {}, arc() {}, fill() {}, fillStyle: ''
            };
        }
    };
}

function createStandingDetection(countdownValues) {
    const StandingState = Object.freeze({
        UNCALIBRATED: 'UNCALIBRATED',
        STANDING: 'STANDING',
        NOT_STANDING: 'NOT_STANDING'
    });

    function createStandingDetector() {
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
                if (samples.length < 10) return { ok: false, reason: 'NOT_ENOUGH_SAMPLES' };
                standingFaceY = 0.2;
                state = StandingState.STANDING;
                return { ok: true, standingFaceY };
            },
            getSnapshot() {
                return { state, standingFaceY, calibrationSampleCount: samples.length };
            },
            update() { return { state, transition: null }; }
        };
    }

    return {
        DEFAULT_CONFIG: { countdownFrom: 5 },
        StandingState,
        createStandingDetector,
        extractFaceY(keypoints) { return keypoints.length ? 0.2 : null; },
        async runCountdown({ from = 5, onTick, speakValue }) {
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
        'model-speed'
    ];
    const elements = Object.fromEntries(elementIds.map(id => [id, createElement(id)]));
    elements.video.videoWidth = 1000;
    elements.video.videoHeight = 1000;
    elements.video.play = async () => {};

    const countdownValues = [];
    const calls = { getUserMedia: 0, createModelManager: 0, createDetector: 0 };
    let domReadyCallback = null;

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
                    return { estimatePoses: async () => [] };
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
        requestAnimationFrame() {},
        setTimeout,
        clearTimeout,
        navigator: navigatorValue,
        tf: {},
        poseDetection: {},
        ModelManager: modelManagerDouble,
        SettingsManager,
        SetupGuide: {
            SETUP_CONFIG: {
                validPositionMs: 800,
                invalidCountdownGraceMs: 250,
                instructionSpeechCooldownMs: 2000
            },
            extractSetupFeatures(keypoints) {
                return keypoints?.setupFeatures || {
                    faceVisible: true,
                    faceCenterY: 0.2,
                    faceWidth: 0.1
                };
            },
            classifySetup(features) {
                return features.result || 'POSITION_CORRECT';
            }
        },
        StandingDetection: createStandingDetection(countdownValues),
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
        getDomReadyCallback: () => domReadyCallback,
        evaluate(expression) { return vm.runInContext(expression, context); }
    };
}

function enterTracking(harness) {
    harness.evaluate('setAppState(AppState.TRACKING_PRAYER)');
    harness.evaluate('for (let i = 0; i < 10; i++) standingDetector.addCalibrationSample(0.2); standingDetector.finishCalibration()');
    harness.elements.video.srcObject = { id: 'existing-stream' };
    harness.evaluate("video = document.getElementById('video'); isRunning = true");
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
    harness.evaluate('for (let i = 0; i < 10; i++) standingDetector.addCalibrationSample(0.2); standingDetector.finishCalibration(); setAppState(AppState.TRACKING_PRAYER)');
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
