(function initializeStandingDetection(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.StandingDetection = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createStandingDetectionApi() {
    const FACE_LANDMARK_NAMES = new Set([
        'nose',
        'left_eye',
        'right_eye',
        'left_ear',
        'right_ear'
    ]);

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
        maximumCalibrationSpread: 0.04,
        standingZoneRadius: 0.07,
        leaveStandingConfirmMs: 250,
        missingFaceConfirmMs: 400,
        returnToStandingConfirmMs: 600
    });

    function median(values) {
        if (values.length === 0) return null;

        const sorted = [...values].sort((left, right) => left - right);
        const middle = Math.floor(sorted.length / 2);

        if (sorted.length % 2 === 1) return sorted[middle];
        return (sorted[middle - 1] + sorted[middle]) / 2;
    }

    function extractFaceY(keypoints, videoHeight, config = DEFAULT_CONFIG) {
        if (!Array.isArray(keypoints) || !Number.isFinite(videoHeight) || videoHeight <= 0) {
            return null;
        }

        const facePositions = keypoints
            .filter(point => (
                FACE_LANDMARK_NAMES.has(point.name)
                && Number.isFinite(point.y)
                && Number.isFinite(point.score)
                && point.score >= config.faceConfidence
            ))
            .map(point => point.y);

        const faceCenterY = median(facePositions);
        return faceCenterY === null ? null : faceCenterY / videoHeight;
    }

    function createStandingDetector(options = {}) {
        const config = { ...DEFAULT_CONFIG, ...options };
        let state = StandingState.UNCALIBRATED;
        let standingFaceY = null;
        let calibrationSamples = [];
        let candidateState = null;
        let candidateSince = null;

        function clearCandidate() {
            candidateState = null;
            candidateSince = null;
        }

        function clearCalibrationSamples() {
            calibrationSamples = [];
        }

        function addCalibrationSample(faceY) {
            if (!Number.isFinite(faceY)) return false;
            calibrationSamples.push(faceY);
            return true;
        }

        function finishCalibration() {
            if (calibrationSamples.length < config.minimumCalibrationSamples) {
                return { ok: false, reason: 'NOT_ENOUGH_SAMPLES' };
            }

            const lowest = Math.min(...calibrationSamples);
            const highest = Math.max(...calibrationSamples);
            if (highest - lowest > config.maximumCalibrationSpread) {
                return { ok: false, reason: 'FACE_NOT_STABLE' };
            }

            standingFaceY = median(calibrationSamples);
            state = StandingState.STANDING;
            clearCandidate();
            return { ok: true, standingFaceY };
        }

        function update(faceY, timestamp) {
            if (state === StandingState.UNCALIBRATED || standingFaceY === null) {
                return { state, transition: null };
            }

            const hasFace = Number.isFinite(faceY);
            const isInsideStandingArea = hasFace
                && Math.abs(faceY - standingFaceY) <= config.standingZoneRadius;
            const desiredState = isInsideStandingArea
                ? StandingState.STANDING
                : StandingState.NOT_STANDING;

            if (desiredState === state) {
                clearCandidate();
                return { state, transition: null };
            }

            if (candidateState !== desiredState) {
                candidateState = desiredState;
                candidateSince = timestamp;
                return { state, transition: null };
            }

            const requiredTime = desiredState === StandingState.STANDING
                ? config.returnToStandingConfirmMs
                : (hasFace ? config.leaveStandingConfirmMs : config.missingFaceConfirmMs);

            if (timestamp - candidateSince < requiredTime) {
                return { state, transition: null };
            }

            const previousState = state;
            state = desiredState;
            clearCandidate();

            return {
                state,
                transition: previousState === StandingState.STANDING
                    ? 'LEFT_STANDING'
                    : 'RETURNED_TO_STANDING'
            };
        }

        function reset() {
            state = StandingState.UNCALIBRATED;
            standingFaceY = null;
            clearCalibrationSamples();
            clearCandidate();
        }

        function getSnapshot() {
            return {
                state,
                standingFaceY,
                calibrationSampleCount: calibrationSamples.length,
                candidateState,
                candidateSince
            };
        }

        return {
            addCalibrationSample,
            clearCalibrationSamples,
            finishCalibration,
            getSnapshot,
            reset,
            update
        };
    }

    async function runCountdown({
        from = DEFAULT_CONFIG.countdownFrom,
        onTick = () => {},
        speakValue = () => {},
        wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
    } = {}) {
        for (let value = from; value >= 0; value--) {
            onTick(value);
            speakValue(value);

            if (value > 0) {
                await wait(1000);
            }
        }
    }

    return {
        DEFAULT_CONFIG,
        StandingState,
        createStandingDetector,
        extractFaceY,
        runCountdown
    };
}));
