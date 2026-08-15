const test = require('node:test');
const assert = require('node:assert/strict');

const DeveloperSettings = require('../js/developer-settings.js');

const setupDefaults = {
    faceConfidence: 0.35,
    targetBandTop: 0.01,
    targetBandBottom: 0.30,
    minimumFaceWidth: 0.02,
    maximumFaceWidth: 0.20,
    validPositionMs: 800,
    invalidCountdownGraceMs: 1500,
    instructionSpeechCooldownMs: 2000
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

const defaults = DeveloperSettings.createDefaults(setupDefaults, standingDefaults);

test('developer defaults match Plan 5 and Plan 6 runtime defaults', () => {
    assert.deepEqual(defaults, {
        setupFaceConfidencePct: 35,
        targetBandTopPct: 1,
        targetBandBottomPct: 30,
        minimumFaceWidthPct: 2,
        maximumFaceWidthPct: 20,
        validPositionSeconds: 0.8,
        invalidCountdownGraceSeconds: 1.5,
        instructionSpeechCooldownSeconds: 2,
        trackingFaceConfidencePct: 35,
        countdownFrom: 5,
        minimumCalibrationSamples: 10,
        standingZoneRadiusPct: 7,
        leaveStandingConfirmSeconds: 0.25,
        missingFaceConfirmSeconds: 0.4,
        returnToStandingConfirmSeconds: 0.6
    });
});

test('human-friendly percentages and seconds convert to runtime values', () => {
    const values = {
        ...defaults,
        setupFaceConfidencePct: 42,
        targetBandTopPct: 5,
        targetBandBottomPct: 35,
        minimumFaceWidthPct: 3,
        maximumFaceWidthPct: 25,
        validPositionSeconds: 1.2,
        invalidCountdownGraceSeconds: 2.3,
        instructionSpeechCooldownSeconds: 1.7,
        trackingFaceConfidencePct: 51,
        countdownFrom: 7,
        minimumCalibrationSamples: 14,
        standingZoneRadiusPct: 9,
        leaveStandingConfirmSeconds: 0.4,
        missingFaceConfirmSeconds: 0.8,
        returnToStandingConfirmSeconds: 0.9
    };

    const setup = DeveloperSettings.buildSetupConfig(values, setupDefaults);
    const standing = DeveloperSettings.buildStandingConfig(values, standingDefaults);

    assert.equal(setup.faceConfidence, 0.42);
    assert.equal(setup.targetBandTop, 0.05);
    assert.equal(setup.targetBandBottom, 0.35);
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

test('developer settings save and reload from separate temporary storage key', () => {
    const storage = createStorage();
    const edited = { ...defaults, targetBandTopPct: 4, countdownFrom: 3 };

    const saved = DeveloperSettings.saveSettings(edited, defaults, storage);
    assert.equal(saved.ok, true);

    const raw = storage.snapshot()[DeveloperSettings.STORAGE_KEY];
    assert.ok(raw);
    assert.equal(DeveloperSettings.STORAGE_KEY, 'racat-developer-settings-v1');

    const loaded = DeveloperSettings.loadSettings(defaults, storage);
    assert.equal(loaded.targetBandTopPct, 4);
    assert.equal(loaded.countdownFrom, 3);
});

test('malformed or invalid stored settings safely fall back to defaults', () => {
    const malformed = createStorage({
        [DeveloperSettings.STORAGE_KEY]: '{bad json'
    });
    assert.deepEqual(DeveloperSettings.loadSettings(defaults, malformed), defaults);

    const invalid = createStorage({
        [DeveloperSettings.STORAGE_KEY]: JSON.stringify({
            ...defaults,
            targetBandTopPct: 50,
            targetBandBottomPct: 20
        })
    });
    assert.deepEqual(DeveloperSettings.loadSettings(defaults, invalid), defaults);
});

test('blank or non-numeric values are rejected', () => {
    const result = DeveloperSettings.validateSettings(
        { ...defaults, targetBandTopPct: '' },
        defaults
    );
    assert.equal(result.ok, false);
    assert.equal(result.errorKey, 'developer_error_numbers');
});

test('top position must be lower than bottom position', () => {
    const result = DeveloperSettings.validateSettings(
        { ...defaults, targetBandTopPct: 30, targetBandBottomPct: 30 },
        defaults
    );
    assert.equal(result.ok, false);
    assert.equal(result.errorKey, 'developer_error_vertical');
});

test('minimum face size must stay below maximum face size', () => {
    const result = DeveloperSettings.validateSettings(
        { ...defaults, minimumFaceWidthPct: 20, maximumFaceWidthPct: 20 },
        defaults
    );
    assert.equal(result.ok, false);
    assert.equal(result.errorKey, 'developer_error_face_size');
});

test('countdown and calibration samples must be positive integers', () => {
    let result = DeveloperSettings.validateSettings(
        { ...defaults, countdownFrom: 2.5 },
        defaults
    );
    assert.equal(result.ok, false);
    assert.equal(result.errorKey, 'developer_error_integer');

    result = DeveloperSettings.validateSettings(
        { ...defaults, minimumCalibrationSamples: 0 },
        defaults
    );
    assert.equal(result.ok, false);
    assert.equal(result.errorKey, 'developer_error_integer');
});

test('negative timing and invalid tolerance are rejected', () => {
    let result = DeveloperSettings.validateSettings(
        { ...defaults, invalidCountdownGraceSeconds: -0.1 },
        defaults
    );
    assert.equal(result.ok, false);
    assert.equal(result.errorKey, 'developer_error_timing');

    result = DeveloperSettings.validateSettings(
        { ...defaults, standingZoneRadiusPct: 0 },
        defaults
    );
    assert.equal(result.ok, false);
    assert.equal(result.errorKey, 'developer_error_tolerance');
});

test('translations exist for both developer languages', () => {
    assert.match(DeveloperSettings.translate('developer_title', 'en'), /Developer Options/);
    assert.match(DeveloperSettings.translate('developer_title', 'ar'), /المطور/);
});
