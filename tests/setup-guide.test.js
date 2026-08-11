const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const modulePath = path.join(__dirname, '..', 'setup-guide.js');
const moduleExists = fs.existsSync(modulePath);
const api = moduleExists ? require(modulePath) : {};

test('setup guide module exists', () => {
    assert.equal(moduleExists, true);
});

function correctFeatures(overrides = {}) {
    return {
        faceVisible: true,
        lightingGood: true,
        angleAvailable: false,
        angleGood: true,
        faceWidth: 0.10,
        faceCenterY: 0.20,
        ...overrides
    };
}

const classificationCases = [
    ['FACE_NOT_VISIBLE', { faceVisible: false }],
    ['IMPROVE_LIGHTING', { lightingGood: false }],
    ['FIX_PHONE_ANGLE', { angleAvailable: true, angleGood: false }],
    ['MOVE_BACK_ONE_STEP', { faceWidth: 0.20 }],
    ['MOVE_CLOSER_ONE_STEP', { faceWidth: 0.03 }],
    ['FACE_TOO_LOW', { faceCenterY: 0.40 }],
    ['FACE_TOO_HIGH', { faceCenterY: 0.02 }],
    ['POSITION_CORRECT', {}]
];

for (const [expected, overrides] of classificationCases) {
    test(`classifies ${expected}`, () => {
        assert.equal(typeof api.classifySetup, 'function');
        assert.equal(api.classifySetup(correctFeatures(overrides)), expected);
    });
}

test('missing orientation data does not block correct placement', () => {
    assert.equal(api.classifySetup(correctFeatures({
        angleAvailable: false,
        angleGood: false
    })), 'POSITION_CORRECT');
});

test('extracts normalized face center and width from reliable face points', () => {
    assert.equal(typeof api.extractSetupFeatures, 'function');
    const result = api.extractSetupFeatures([
        { name: 'left_eye', x: 400, y: 160, score: 0.9 },
        { name: 'right_eye', x: 600, y: 180, score: 0.9 },
        { name: 'nose', x: 500, y: 170, score: 0.9 },
        { name: 'left_shoulder', x: 200, y: 500, score: 0.99 }
    ], 1000, 1000);

    assert.equal(result.faceVisible, true);
    assert.equal(result.faceCenterY, 0.17);
    assert.equal(result.faceWidth, 0.20);
});

test('requires at least two reliable face points', () => {
    const result = api.extractSetupFeatures([
        { name: 'nose', x: 500, y: 170, score: 0.9 },
        { name: 'left_eye', x: 400, y: 160, score: 0.1 }
    ], 1000, 1000);

    assert.equal(result.faceVisible, false);
});

test('measures average image luminance', () => {
    assert.equal(typeof api.measureBrightness, 'function');
    const brightness = api.measureBrightness({
        data: new Uint8ClampedArray([
            100, 100, 100, 255,
            200, 200, 200, 255
        ])
    });

    assert.equal(Math.round(brightness), 150);
});

test('one dark frame does not immediately report bad lighting', () => {
    assert.equal(typeof api.createLightingMonitor, 'function');
    const monitor = api.createLightingMonitor({ requiredDarkSamples: 3 });

    assert.equal(monitor.update(20), true);
    assert.equal(monitor.update(20), true);
    assert.equal(monitor.update(20), false);
    assert.equal(monitor.update(100), true);
});

test('normalizes a nearly upright phone angle', () => {
    assert.equal(typeof api.normalizePhoneAngle, 'function');
    assert.deepEqual(api.normalizePhoneAngle({ beta: 90, gamma: 5 }), {
        angleAvailable: true,
        angleGood: true,
        beta: 90,
        gamma: 5
    });
});

test('unavailable phone angle remains optional', () => {
    assert.deepEqual(api.normalizePhoneAngle({ beta: null, gamma: null }), {
        angleAvailable: false,
        angleGood: true,
        beta: null,
        gamma: null
    });
});
