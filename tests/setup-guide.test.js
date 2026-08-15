const test = require('node:test');
const assert = require('node:assert/strict');

const api = require('../js/setup-guide.js');

function goodKeypoints(overrides = {}) {
    const points = {
        nose: { name: 'nose', x: 500, y: 200, score: 0.95 },
        left_eye: { name: 'left_eye', x: 470, y: 190, score: 0.9 },
        right_eye: { name: 'right_eye', x: 530, y: 190, score: 0.9 },
        left_shoulder: { name: 'left_shoulder', x: 350, y: 430, score: 0.95 },
        right_shoulder: { name: 'right_shoulder', x: 650, y: 430, score: 0.95 }
    };
    for (const [name, patch] of Object.entries(overrides)) {
        if (patch === null) delete points[name];
        else points[name] = { ...points[name], ...patch };
    }
    return Object.values(points);
}

function features(overrides = {}) {
    return {
        faceVisible: true,
        faceCenterX: 0.5,
        faceCenterY: 0.2,
        faceWidth: 0.06,
        leftShoulderVisible: true,
        rightShoulderVisible: true,
        leftShoulderSafe: true,
        rightShoulderSafe: true,
        leftShoulderX: 0.35,
        rightShoulderX: 0.65,
        shoulderCenterX: 0.5,
        horizontalBodyCenterX: 0.5,
        ...overrides
    };
}

test('Plan 8 setup defaults use 1% through 50% and shoulder framing defaults', () => {
    assert.equal(api.SETUP_CONFIG.targetBandTop, 0.01);
    assert.equal(api.SETUP_CONFIG.targetBandBottom, 0.50);
    assert.equal(api.SETUP_CONFIG.shoulderConfidence, 0.35);
    assert.equal(api.SETUP_CONFIG.shoulderEdgeMargin, 0.02);
    assert.equal(api.SETUP_CONFIG.bodySafeLeft, 0.25);
    assert.equal(api.SETUP_CONFIG.bodySafeRight, 0.75);
    assert.equal(api.SETUP_CONFIG.horizontalGuidanceConfirmMs, 1000);
});

test('face and both reliable shoulders can pass setup', () => {
    const result = api.extractSetupFeatures(goodKeypoints(), 1000, 1000);
    assert.equal(result.faceVisible, true);
    assert.equal(result.leftShoulderSafe, true);
    assert.equal(result.rightShoulderSafe, true);
    assert.equal(api.classifySetup(result), 'POSITION_CORRECT');
});

test('missing left shoulder cannot pass setup', () => {
    const result = api.extractSetupFeatures(goodKeypoints({ left_shoulder: null }), 1000, 1000);
    assert.equal(result.leftShoulderSafe, false);
    assert.notEqual(api.classifySetup(result), 'POSITION_CORRECT');
});

test('missing right shoulder cannot pass setup', () => {
    const result = api.extractSetupFeatures(goodKeypoints({ right_shoulder: null }), 1000, 1000);
    assert.equal(result.rightShoulderSafe, false);
    assert.notEqual(api.classifySetup(result), 'POSITION_CORRECT');
});

test('low-confidence shoulder does not count', () => {
    const result = api.extractSetupFeatures(
        goodKeypoints({ left_shoulder: { score: 0.34 } }),
        1000,
        1000
    );
    assert.equal(result.leftShoulderSafe, false);
    assert.notEqual(api.classifySetup(result), 'POSITION_CORRECT');
});

test('out-of-frame shoulder does not count', () => {
    const result = api.extractSetupFeatures(
        goodKeypoints({ left_shoulder: { x: -20 } }),
        1000,
        1000
    );
    assert.equal(result.leftShoulderVisible, false);
    assert.equal(result.leftShoulderSafe, false);
});

test('shoulder inside frame but inside the edge margin is not safely framed', () => {
    const result = api.extractSetupFeatures(
        goodKeypoints({ left_shoulder: { x: 10 } }),
        1000,
        1000
    );
    assert.equal(result.leftShoulderVisible, true);
    assert.equal(result.leftShoulderSafe, false);
});

test('ambiguous missing shoulder returns SHOULDERS_NOT_VISIBLE', () => {
    assert.equal(api.classifySetup(features({
        leftShoulderVisible: false,
        leftShoulderSafe: false,
        leftShoulderX: null,
        horizontalBodyCenterX: 0.5
    })), 'SHOULDERS_NOT_VISIBLE');
});

test('raw body too far left gives isolated physical MOVE_LEFT mapping', () => {
    const value = api.classifySetup(features({
        leftShoulderSafe: false,
        leftShoulderX: 0.01,
        horizontalBodyCenterX: 0.20
    }));
    assert.equal(value, 'MOVE_LEFT');
    assert.equal(api.mapRawHorizontalSideToInstruction('RAW_LEFT'), 'MOVE_LEFT');
});

test('raw body too far right gives isolated physical MOVE_RIGHT mapping', () => {
    const value = api.classifySetup(features({
        rightShoulderSafe: false,
        rightShoulderX: 0.99,
        horizontalBodyCenterX: 0.80
    }));
    assert.equal(value, 'MOVE_RIGHT');
    assert.equal(api.mapRawHorizontalSideToInstruction('RAW_RIGHT'), 'MOVE_RIGHT');
});

test('distance checks still apply after shoulder framing passes', () => {
    assert.equal(api.classifySetup(features({ faceWidth: 0.21 })), 'MOVE_BACK_ONE_STEP');
    assert.equal(api.classifySetup(features({ faceWidth: 0.019 })), 'MOVE_CLOSER_ONE_STEP');
});

test('vertical range accepts exact 1% and 50% boundaries', () => {
    assert.equal(api.classifySetup(features({ faceCenterY: 0.01 })), 'POSITION_CORRECT');
    assert.equal(api.classifySetup(features({ faceCenterY: 0.50 })), 'POSITION_CORRECT');
});

test('vertical range rejects values just outside 1% and 50%', () => {
    assert.equal(api.classifySetup(features({ faceCenterY: 0.009 })), 'FACE_OUTSIDE_TARGET');
    assert.equal(api.classifySetup(features({ faceCenterY: 0.501 })), 'FACE_OUTSIDE_TARGET');
});

test('one clearly off-side shoulder can give direction even when the face is not visible', () => {
    const result = api.extractSetupFeatures([
        { name: 'left_shoulder', x: 990, y: 430, score: 0.95 }
    ], 1000, 1000);

    assert.equal(result.faceVisible, false);
    assert.equal(api.classifySetup(result), 'MOVE_RIGHT');
});

test('one ambiguous shoulder without a face does not guess a direction', () => {
    const result = api.extractSetupFeatures([
        { name: 'left_shoulder', x: 500, y: 430, score: 0.95 }
    ], 1000, 1000);

    assert.equal(result.faceVisible, false);
    assert.equal(api.classifySetup(result), 'FACE_NOT_VISIBLE');
});

test('face must still have at least two reliable points', () => {
    const result = api.extractSetupFeatures([
        { name: 'nose', x: 500, y: 200, score: 0.9 },
        { name: 'left_shoulder', x: 350, y: 430, score: 0.95 },
        { name: 'right_shoulder', x: 650, y: 430, score: 0.95 }
    ], 1000, 1000);
    assert.equal(result.faceVisible, false);
    assert.equal(api.classifySetup(result), 'FACE_NOT_VISIBLE');
});

test('runtime shoulder confidence and margin overrides change behavior', () => {
    const config = {
        ...api.SETUP_CONFIG,
        shoulderConfidence: 0.8,
        shoulderEdgeMargin: 0.10
    };
    const result = api.extractSetupFeatures(
        goodKeypoints({
            left_shoulder: { x: 80, score: 0.79 },
            right_shoulder: { score: 0.95 }
        }),
        1000,
        1000,
        config
    );
    assert.equal(result.leftShoulderSafe, false);
});
