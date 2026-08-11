const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const modulePath = path.join(__dirname, '..', 'js', 'setup-guide.js');
const moduleExists = fs.existsSync(modulePath);
const api = moduleExists ? require(modulePath) : {};

test('setup guide module exists', () => {
    assert.equal(moduleExists, true);
});

function correctFeatures(overrides = {}) {
    return {
        faceVisible: true,
        faceWidth: 0.10,
        faceCenterY: 0.20,
        ...overrides
    };
}

const classificationCases = [
    ['FACE_NOT_VISIBLE', { faceVisible: false }],
    ['MOVE_BACK_ONE_STEP', { faceWidth: 0.20 }],
    ['MOVE_CLOSER_ONE_STEP', { faceWidth: 0.03 }],
    ['FACE_OUTSIDE_TARGET', { faceCenterY: 0.40 }],
    ['FACE_OUTSIDE_TARGET', { faceCenterY: 0.02 }],
    ['POSITION_CORRECT', {}]
];

for (const [expected, overrides] of classificationCases) {
    test(`classifies ${expected}`, () => {
        assert.equal(typeof api.classifySetup, 'function');
        assert.equal(api.classifySetup(correctFeatures(overrides)), expected);
    });
}

test('does not require lighting information', () => {
    assert.equal(api.classifySetup(correctFeatures()), 'POSITION_CORRECT');
});

test('does not require orientation information', () => {
    assert.equal(api.classifySetup(correctFeatures()), 'POSITION_CORRECT');
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

test('removed setup checks are no longer exported', () => {
    assert.equal(api.measureBrightness, undefined);
    assert.equal(api.createLightingMonitor, undefined);
    assert.equal(api.normalizePhoneAngle, undefined);
});
