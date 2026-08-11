(function initializeSetupGuide(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.SetupGuide = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createSetupGuideApi() {
    const FACE_NAMES = new Set([
        'nose',
        'left_eye',
        'right_eye',
        'left_ear',
        'right_ear'
    ]);

    const SETUP_CONFIG = Object.freeze({
        faceConfidence: 0.35,
        targetBandTop: 0.08,
        targetBandBottom: 0.30,
        minimumFaceWidth: 0.055,
        maximumFaceWidth: 0.16,
        validPositionMs: 800,
        invalidCountdownGraceMs: 250,
        instructionSpeechCooldownMs: 2000
    });

    function median(values) {
        if (values.length === 0) return null;
        const sorted = [...values].sort((left, right) => left - right);
        const middle = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 1
            ? sorted[middle]
            : (sorted[middle - 1] + sorted[middle]) / 2;
    }

    function extractSetupFeatures(keypoints, videoWidth, videoHeight, config = SETUP_CONFIG) {
        if (!Array.isArray(keypoints) || videoWidth <= 0 || videoHeight <= 0) {
            return { faceVisible: false, faceCenterY: null, faceWidth: null };
        }

        const facePoints = keypoints.filter(point => (
            FACE_NAMES.has(point.name)
            && Number.isFinite(point.x)
            && Number.isFinite(point.y)
            && Number.isFinite(point.score)
            && point.score >= config.faceConfidence
        ));

        if (facePoints.length < 2) {
            return { faceVisible: false, faceCenterY: null, faceWidth: null };
        }

        const xValues = facePoints.map(point => point.x);
        const yValues = facePoints.map(point => point.y);

        return {
            faceVisible: true,
            faceCenterY: median(yValues) / videoHeight,
            faceWidth: (Math.max(...xValues) - Math.min(...xValues)) / videoWidth
        };
    }

    function classifySetup(features, config = SETUP_CONFIG) {
        if (!features.faceVisible) return 'FACE_NOT_VISIBLE';
        if (features.faceWidth > config.maximumFaceWidth) return 'MOVE_BACK_ONE_STEP';
        if (features.faceWidth < config.minimumFaceWidth) return 'MOVE_CLOSER_ONE_STEP';

        const insideTarget = features.faceCenterY >= config.targetBandTop
            && features.faceCenterY <= config.targetBandBottom;

        return insideTarget ? 'POSITION_CORRECT' : 'FACE_OUTSIDE_TARGET';
    }

    return {
        SETUP_CONFIG,
        classifySetup,
        extractSetupFeatures
    };
}));
