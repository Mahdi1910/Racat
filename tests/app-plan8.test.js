const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SettingsManager = require('../js/settings-manager.js');
const DeveloperSettings = require('../js/developer-settings.js');
const SetupGuide = require('../js/setup-guide.js');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

function createContext() {
    const context = {
        console,
        SettingsManager,
        DeveloperSettings,
        SetupGuide,
        StandingDetection: {
            DEFAULT_CONFIG: { faceConfidence: 0.35, countdownFrom: 5, minimumCalibrationSamples: 10, standingZoneRadius: 0.07, leaveStandingConfirmMs: 250, missingFaceConfirmMs: 400, returnToStandingConfirmMs: 600 },
            StandingState: { STANDING: 'STANDING', NOT_STANDING: 'NOT_STANDING' },
            createStandingDetector() { return { reset() {}, clearCalibrationSamples() {}, addCalibrationSample() {}, finishCalibration() { return { ok: true, standingFaceY: 0.2 }; }, update() { return { state: 'STANDING', transition: null }; } }; },
            extractFaceY() { return 0.2; },
            async runCountdown() {}
        },
        ModelManager: {},
        SpeechSynthesisUtterance: function SpeechSynthesisUtterance() {},
        performance: { now: () => 0 },
        requestAnimationFrame() {},
        navigator: {},
        document: {
            documentElement: {}, title: '', querySelectorAll() { return []; },
            getElementById() { return { hidden: false, innerText: '', textContent: '', value: '', checked: false, dataset: {}, style: { display: '', setProperty() {} }, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, replaceChildren() {}, appendChild() {}, setAttribute() {}, parentElement: { setAttribute() {} } }; },
            createElement() { return { dataset: {}, style: {}, classList: {}, addEventListener() {}, appendChild() {}, setAttribute() {} }; }
        },
        window: { addEventListener() {}, speechSynthesis: { getVoices() { return []; }, addEventListener() {}, cancel() {}, speak() {} } }
    };
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(appSource, context, { filename: 'app.js' });
    return context;
}

test('left/right speech waits for the configured one-second confirmation', () => {
    const context = createContext();
    assert.equal(context.directionalInstructionReady('MOVE_LEFT', 1000), false);
    assert.equal(context.directionalInstructionReady('MOVE_LEFT', 1999), false);
    assert.equal(context.directionalInstructionReady('MOVE_LEFT', 2000), true);
});

test('changing horizontal direction starts a fresh confirmation window', () => {
    const context = createContext();
    assert.equal(context.directionalInstructionReady('MOVE_LEFT', 1000), false);
    assert.equal(context.directionalInstructionReady('MOVE_LEFT', 2000), true);
    assert.equal(context.directionalInstructionReady('MOVE_RIGHT', 2100), false);
    assert.equal(context.directionalInstructionReady('MOVE_RIGHT', 3099), false);
    assert.equal(context.directionalInstructionReady('MOVE_RIGHT', 3100), true);
});

test('a non-direction result resets the horizontal confirmation timer', () => {
    const context = createContext();
    context.directionalInstructionReady('MOVE_LEFT', 1000);
    assert.equal(context.directionalInstructionReady('SHOULDERS_NOT_VISIBLE', 1500), true);
    assert.equal(context.directionalInstructionReady('MOVE_LEFT', 1600), false);
});

test('app maps all Plan 8 setup results to translated message keys', () => {
    const context = createContext();
    assert.equal(context.setupMessageKeyForResult('SHOULDERS_NOT_VISIBLE'), 'shoulders_not_visible');
    assert.equal(context.setupMessageKeyForResult('MOVE_LEFT'), 'move_left');
    assert.equal(context.setupMessageKeyForResult('MOVE_RIGHT'), 'move_right');
});

test('prayer tracking stays face-based and does not classify shoulders', () => {
    const match = appSource.match(/function processPrayerFrame\(keypoints, timestamp\) \{([\s\S]*?)\n\}/);
    assert.ok(match);
    assert.match(match[1], /StandingDetection\.extractFaceY/);
    assert.doesNotMatch(match[1], /shoulder/i);
    assert.doesNotMatch(match[1], /SetupGuide/);
});

test('Plan 6 calibration spread rejection is not restored in app source', () => {
    assert.doesNotMatch(appSource, /maximumCalibrationSpread/);
    assert.doesNotMatch(appSource, /FACE_NOT_STABLE/);
});

test('new setup instructions have Arabic and English translations', () => {
    for (const key of ['shoulders_not_visible', 'move_left', 'move_right']) {
        const en = SettingsManager.translate(key, 'en');
        const ar = SettingsManager.translate(key, 'ar');
        assert.notEqual(en, key);
        assert.notEqual(ar, key);
        assert.notEqual(en, ar);
    }
});
