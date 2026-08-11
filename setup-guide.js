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
        faceBandTop: 0.08,
        faceBandBottom: 0.30,
        minimumFaceWidth: 0.055,
        maximumFaceWidth: 0.16,
        minimumBrightness: 45,
        validPositionMs: 800,
        invalidCountdownGraceMs: 250,
        instructionSpeechCooldownMs: 2000,
        minimumPhoneBeta: 75,
        maximumPhoneBeta: 105,
        maximumPhoneGamma: 20
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

    function measureBrightness(imageData) {
        if (!imageData || !imageData.data || imageData.data.length === 0) return 0;

        let total = 0;
        let pixelCount = 0;
        for (let index = 0; index < imageData.data.length; index += 4) {
            const red = imageData.data[index];
            const green = imageData.data[index + 1];
            const blue = imageData.data[index + 2];
            total += 0.2126 * red + 0.7152 * green + 0.0722 * blue;
            pixelCount++;
        }

        return pixelCount > 0 ? total / pixelCount : 0;
    }

    function createLightingMonitor({
        minimumBrightness = SETUP_CONFIG.minimumBrightness,
        requiredDarkSamples = 3
    } = {}) {
        let consecutiveDarkSamples = 0;

        function update(brightness) {
            if (brightness < minimumBrightness) {
                consecutiveDarkSamples++;
            } else {
                consecutiveDarkSamples = 0;
            }

            return consecutiveDarkSamples < requiredDarkSamples;
        }

        function reset() {
            consecutiveDarkSamples = 0;
        }

        return { reset, update };
    }

    function normalizePhoneAngle(orientation, config = SETUP_CONFIG) {
        const beta = orientation?.beta;
        const gamma = orientation?.gamma;

        if (!Number.isFinite(beta) || !Number.isFinite(gamma)) {
            return {
                angleAvailable: false,
                angleGood: true,
                beta: null,
                gamma: null
            };
        }

        return {
            angleAvailable: true,
            angleGood: beta >= config.minimumPhoneBeta
                && beta <= config.maximumPhoneBeta
                && Math.abs(gamma) <= config.maximumPhoneGamma,
            beta,
            gamma
        };
    }

    function classifySetup(features, config = SETUP_CONFIG) {
        if (!features.faceVisible) return 'FACE_NOT_VISIBLE';
        if (!features.lightingGood) return 'IMPROVE_LIGHTING';
        if (features.angleAvailable && !features.angleGood) return 'FIX_PHONE_ANGLE';
        if (features.faceWidth > config.maximumFaceWidth) return 'MOVE_BACK_ONE_STEP';
        if (features.faceWidth < config.minimumFaceWidth) return 'MOVE_CLOSER_ONE_STEP';
        if (features.faceCenterY > config.faceBandBottom) return 'FACE_TOO_LOW';
        if (features.faceCenterY < config.faceBandTop) return 'FACE_TOO_HIGH';
        return 'POSITION_CORRECT';
    }

    return {
        SETUP_CONFIG,
        classifySetup,
        createLightingMonitor,
        extractSetupFeatures,
        measureBrightness,
        normalizePhoneAngle
    };
}));
