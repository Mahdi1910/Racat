const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const detectorPath = path.join(__dirname, '..', 'js', 'standing-detector.js');
const detectorExists = fs.existsSync(detectorPath);
const api = detectorExists ? require(detectorPath) : {};

test('standing detector module exists', () => {
    assert.equal(detectorExists, true);
});

test('face position uses the median of reliable face landmarks', () => {
    assert.equal(typeof api.extractFaceY, 'function');
    const faceY = api.extractFaceY([
        { name: 'nose', y: 100, score: 0.9 },
        { name: 'left_eye', y: 120, score: 0.8 },
        { name: 'right_ear', y: 800, score: 0.1 },
        { name: 'left_shoulder', y: 500, score: 0.99 }
    ], 1000);

    assert.equal(faceY, 0.11);
});

test('face position is missing when no reliable face landmark is visible', () => {
    assert.equal(typeof api.extractFaceY, 'function');
    const faceY = api.extractFaceY([
        { name: 'nose', y: 100, score: 0.2 },
        { name: 'left_shoulder', y: 200, score: 0.99 }
    ], 1000);

    assert.equal(faceY, null);
});

function createCalibratedDetector() {
    assert.equal(typeof api.createStandingDetector, 'function');
    const detector = api.createStandingDetector();
    [0.20, 0.201, 0.199, 0.202, 0.198, 0.20, 0.201, 0.199, 0.20, 0.20]
        .forEach(faceY => detector.addCalibrationSample(faceY));
    const result = detector.finishCalibration();
    assert.equal(result.ok, true);
    return detector;
}

test('fewer than the minimum calibration samples still fail', () => {
    const detector = api.createStandingDetector();
    [0.20, 0.21, 0.19, 0.22, 0.18, 0.20, 0.21, 0.19, 0.20]
        .forEach(faceY => detector.addCalibrationSample(faceY));

    const result = detector.finishCalibration();

    assert.deepEqual(result, { ok: false, reason: 'NOT_ENOUGH_SAMPLES' });
    assert.equal(detector.getSnapshot().state, api.StandingState.UNCALIBRATED);
});

test('stable face samples create a personal standing position', () => {
    const detector = createCalibratedDetector();
    const snapshot = detector.getSnapshot();

    assert.equal(snapshot.state, api.StandingState.STANDING);
    assert.ok(Math.abs(snapshot.standingFaceY - 0.20) < 0.001);
});

test('widely spread calibration samples now succeed and use the median', () => {
    const detector = api.createStandingDetector();
    [0.10, 0.20, 0.11, 0.21, 0.12, 0.22, 0.13, 0.23, 0.14, 0.24]
        .forEach(faceY => detector.addCalibrationSample(faceY));

    const result = detector.finishCalibration();
    const snapshot = detector.getSnapshot();

    assert.equal(result.ok, true);
    assert.equal(snapshot.state, api.StandingState.STANDING);
    assert.equal(snapshot.standingFaceY, 0.17);
    assert.equal(result.standingFaceY, 0.17);
});

test('reset clears a successful calibration completely', () => {
    const detector = createCalibratedDetector();

    detector.reset();
    const snapshot = detector.getSnapshot();

    assert.equal(snapshot.state, api.StandingState.UNCALIBRATED);
    assert.equal(snapshot.standingFaceY, null);
    assert.equal(snapshot.calibrationSampleCount, 0);
    assert.equal(snapshot.candidateState, null);
    assert.equal(snapshot.candidateSince, null);
});

test('one missing face frame does not change standing state', () => {
    const detector = createCalibratedDetector();

    detector.update(null, 0);
    const result = detector.update(0.20, 100);

    assert.equal(result.state, api.StandingState.STANDING);
    assert.equal(result.transition, null);
});

test('a face missing for the confirmation time becomes not standing', () => {
    const detector = createCalibratedDetector();

    detector.update(null, 0);
    assert.equal(detector.update(null, 399).state, api.StandingState.STANDING);
    const result = detector.update(null, 400);

    assert.equal(result.state, api.StandingState.NOT_STANDING);
    assert.equal(result.transition, 'LEFT_STANDING');
});

test('a lower face becomes not standing after a short confirmation', () => {
    const detector = createCalibratedDetector();

    detector.update(0.42, 0);
    assert.equal(detector.update(0.42, 249).state, api.StandingState.STANDING);
    const result = detector.update(0.42, 250);

    assert.equal(result.state, api.StandingState.NOT_STANDING);
    assert.equal(result.transition, 'LEFT_STANDING');
});

test('a sitting face never becomes standing', () => {
    const detector = createCalibratedDetector();
    detector.update(0.42, 0);
    detector.update(0.42, 250);

    const result = detector.update(0.38, 2000);

    assert.equal(result.state, api.StandingState.NOT_STANDING);
    assert.equal(result.transition, null);
});

test('only a stable return to the calibrated face area becomes standing', () => {
    const detector = createCalibratedDetector();
    detector.update(0.42, 0);
    detector.update(0.42, 250);

    detector.update(0.20, 300);
    assert.equal(detector.update(0.20, 899).state, api.StandingState.NOT_STANDING);
    const result = detector.update(0.20, 900);

    assert.equal(result.state, api.StandingState.STANDING);
    assert.equal(result.transition, 'RETURNED_TO_STANDING');
});

test('countdown reports and speaks 5 through 0 in order', async () => {
    assert.equal(typeof api.runCountdown, 'function');
    const shown = [];
    const spoken = [];
    const waits = [];

    await api.runCountdown({
        from: 5,
        onTick: value => shown.push(value),
        speakValue: value => spoken.push(value),
        wait: milliseconds => {
            waits.push(milliseconds);
            return Promise.resolve();
        }
    });

    assert.deepEqual(shown, [5, 4, 3, 2, 1, 0]);
    assert.deepEqual(spoken, [5, 4, 3, 2, 1, 0]);
    assert.deepEqual(waits, [1000, 1000, 1000, 1000, 1000]);
});
