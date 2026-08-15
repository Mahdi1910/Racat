const test = require('node:test');
const assert = require('node:assert/strict');

const DeveloperSettings = require('../js/developer-settings.js');

const setupDefaults = {
    faceConfidence: 0.35,
    shoulderConfidence: 0.35,
    targetBandTop: 0.01,
    targetBandBottom: 0.50,
    minimumFaceWidth: 0.02,
    maximumFaceWidth: 0.20,
    shoulderEdgeMargin: 0.02,
    bodySafeLeft: 0.25,
    bodySafeRight: 0.75,
    validPositionMs: 800,
    invalidCountdownGraceMs: 1500,
    instructionSpeechCooldownMs: 2000,
    horizontalGuidanceConfirmMs: 1000
};

const standingDefaults = {
    faceConfidence: 0.35,
    countdownFrom: 5,
    calibrationDurationMs: 1000,
    minimumCalibrationSamples: 10,
    standingZoneRadius: 0.07,
    leaveStandingConfirmMs: 250,
    missingFaceConfirmMs: 400,
    returnToStandingConfirmMs: 600
};

function createStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) { values.set(key, String(value)); },
        snapshot() { return Object.fromEntries(values); }
    };
}

const defaults = DeveloperSettings.createDefaults(setupDefaults, standingDefaults);

test('developer defaults match Plan 8 current testing baseline', () => {
    assert.deepEqual(defaults, {
        setupFaceConfidencePct: 35,
        shoulderConfidencePct: 35,
        targetBandTopPct: 1,
        targetBandBottomPct: 50,
        minimumFaceWidthPct: 2,
        maximumFaceWidthPct: 20,
        shoulderEdgeMarginPct: 2,
        bodySafeLeftPct: 25,
        bodySafeRightPct: 75,
        validPositionSeconds: 0.8,
        invalidCountdownGraceSeconds: 1.5,
        instructionSpeechCooldownSeconds: 2,
        horizontalGuidanceConfirmSeconds: 1,
        trackingFaceConfidencePct: 35,
        countdownFrom: 5,
        minimumCalibrationSamples: 10,
        standingZoneRadiusPct: 7,
        leaveStandingConfirmSeconds: 0.25,
        missingFaceConfirmSeconds: 0.4,
        returnToStandingConfirmSeconds: 0.6
    });
});

test('human-friendly shoulder values convert to runtime setup values', () => {
    const values = { ...defaults, shoulderConfidencePct: 48, shoulderEdgeMarginPct: 6, bodySafeLeftPct: 20, bodySafeRightPct: 80, horizontalGuidanceConfirmSeconds: 1.7 };
    const setup = DeveloperSettings.buildSetupConfig(values, setupDefaults);
    assert.equal(setup.shoulderConfidence, 0.48);
    assert.equal(setup.shoulderEdgeMargin, 0.06);
    assert.equal(setup.bodySafeLeft, 0.20);
    assert.equal(setup.bodySafeRight, 0.80);
    assert.equal(setup.horizontalGuidanceConfirmMs, 1700);
});

test('existing percentages and seconds still convert to runtime values', () => {
    const values = { ...defaults, setupFaceConfidencePct: 42, targetBandTopPct: 5, targetBandBottomPct: 55, minimumFaceWidthPct: 3, maximumFaceWidthPct: 25, validPositionSeconds: 1.2, invalidCountdownGraceSeconds: 2.3, instructionSpeechCooldownSeconds: 1.7, trackingFaceConfidencePct: 51, countdownFrom: 7, minimumCalibrationSamples: 14, standingZoneRadiusPct: 9, leaveStandingConfirmSeconds: 0.4, missingFaceConfirmSeconds: 0.8, returnToStandingConfirmSeconds: 0.9 };
    const setup = DeveloperSettings.buildSetupConfig(values, setupDefaults);
    const standing = DeveloperSettings.buildStandingConfig(values, standingDefaults);
    assert.equal(setup.faceConfidence, 0.42);
    assert.equal(setup.targetBandTop, 0.05);
    assert.equal(setup.targetBandBottom, 0.55);
    assert.equal(setup.minimumFaceWidth, 0.03);
    assert.equal(setup.maximumFaceWidth, 0.25);
    assert.equal(setup.validPositionMs, 1200);
    assert.equal(setup.invalidCountdownGraceMs, 2300);
    assert.equal(setup.instructionSpeechCooldownMs, 1700);
    assert.equal(standing.faceConfidence, 0.51);
    assert.equal(standing.countdownFrom, 7);
    assert.equal(standing.minimumCalibrationSamples, 14);
    assert.equal(standing.standingZoneRadius, 0.09);
    assert.equal(standing.leaveStandingConfirmMs, 400);
    assert.equal(standing.missingFaceConfirmMs, 800);
    assert.equal(standing.returnToStandingConfirmMs, 900);
    assert.equal(standing.calibrationDurationMs, 1000);
});

test('old Plan 7 setup config still gets safe defaults for new shoulder controls', () => {
    const oldSetup = { faceConfidence: 0.35, targetBandTop: 0.01, targetBandBottom: 0.30, minimumFaceWidth: 0.02, maximumFaceWidth: 0.20, validPositionMs: 800, invalidCountdownGraceMs: 1500, instructionSpeechCooldownMs: 2000 };
    const migrated = DeveloperSettings.createDefaults(oldSetup, standingDefaults);
    assert.equal(migrated.shoulderConfidencePct, 35);
    assert.equal(migrated.shoulderEdgeMarginPct, 2);
    assert.equal(migrated.bodySafeLeftPct, 25);
    assert.equal(migrated.bodySafeRightPct, 75);
    assert.equal(migrated.horizontalGuidanceConfirmSeconds, 1);
});

test('developer settings save and reload from separate temporary storage key', () => {
    const storage = createStorage();
    const edited = { ...defaults, targetBandBottomPct: 60, shoulderConfidencePct: 45 };
    const saved = DeveloperSettings.saveSettings(edited, defaults, storage);
    assert.equal(saved.ok, true);
    const raw = storage.snapshot()[DeveloperSettings.STORAGE_KEY];
    assert.ok(raw);
    assert.equal(DeveloperSettings.STORAGE_KEY, 'racat-developer-settings-v1');
    const loaded = DeveloperSettings.loadSettings(defaults, storage);
    assert.equal(loaded.targetBandBottomPct, 60);
    assert.equal(loaded.shoulderConfidencePct, 45);
});

test('malformed or invalid stored settings safely fall back to defaults', () => {
    const malformed = createStorage({ [DeveloperSettings.STORAGE_KEY]: '{bad json' });
    assert.deepEqual(DeveloperSettings.loadSettings(defaults, malformed), defaults);
    const invalid = createStorage({ [DeveloperSettings.STORAGE_KEY]: JSON.stringify({ ...defaults, bodySafeLeftPct: 90, bodySafeRightPct: 10 }) });
    assert.deepEqual(DeveloperSettings.loadSettings(defaults, invalid), defaults);
});

test('confidence values reject zero or over 100', () => {
    let result = DeveloperSettings.validateSettings({ ...defaults, shoulderConfidencePct: 0 }, defaults);
    assert.equal(result.ok, false);
    assert.equal(result.errorKey, 'developer_error_confidence');
    result = DeveloperSettings.validateSettings({ ...defaults, shoulderConfidencePct: 101 }, defaults);
    assert.equal(result.ok, false);
    assert.equal(result.errorKey, 'developer_error_confidence');
});

test('shoulder margin must stay below 50%', () => {
    const result = DeveloperSettings.validateSettings({ ...defaults, shoulderEdgeMarginPct: 50 }, defaults);
    assert.equal(result.ok, false);
    assert.equal(result.errorKey, 'developer_error_shoulder_margin');
});

test('body left safe limit must stay below right safe limit', () => {
    const result = DeveloperSettings.validateSettings({ ...defaults, bodySafeLeftPct: 70, bodySafeRightPct: 70 }, defaults);
    assert.equal(result.ok, false);
    assert.equal(result.errorKey, 'developer_error_horizontal_zone');
});

test('horizontal guidance delay cannot be negative', () => {
    const result = DeveloperSettings.validateSettings({ ...defaults, horizontalGuidanceConfirmSeconds: -0.1 }, defaults);
    assert.equal(result.ok, false);
    assert.equal(result.errorKey, 'developer_error_timing');
});

test('existing important validation remains intact', () => {
    let result = DeveloperSettings.validateSettings({ ...defaults, targetBandTopPct: 50, targetBandBottomPct: 50 }, defaults);
    assert.equal(result.ok, false);
    assert.equal(result.errorKey, 'developer_error_vertical');
    result = DeveloperSettings.validateSettings({ ...defaults, minimumFaceWidthPct: 20, maximumFaceWidthPct: 20 }, defaults);
    assert.equal(result.ok, false);
    assert.equal(result.errorKey, 'developer_error_face_size');
    result = DeveloperSettings.validateSettings({ ...defaults, minimumCalibrationSamples: 0 }, defaults);
    assert.equal(result.ok, false);
    assert.equal(result.errorKey, 'developer_error_integer');
});

test('new developer descriptions exist in Arabic and English', () => {
    for (const key of ['shoulder_confidence', 'shoulder_edge_margin', 'body_left_safe_limit', 'body_right_safe_limit', 'horizontal_guidance_confirmation']) {
        assert.notEqual(DeveloperSettings.translate(key, 'en'), key);
        assert.notEqual(DeveloperSettings.translate(key, 'ar'), key);
    }
});
