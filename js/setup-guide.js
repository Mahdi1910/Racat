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
    });

    function median(values) {
        if (values.length === 0) return null;
        const sorted = [...values].sort((left, right) => left - right);
        const middle = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 1
            ? sorted[middle]
            : (sorted[middle - 1] + sorted[middle]) / 2;
    }

    function reliablePoint(point, confidence) {
        return Boolean(
            point
            && Number.isFinite(point.x)
            && Number.isFinite(point.y)
            && Number.isFinite(point.score)
            && point.score >= confidence
        );
    }

    function normalizedPoint(point, videoWidth, videoHeight) {
        if (!point) return null;
        return {
            x: point.x / videoWidth,
            y: point.y / videoHeight
        };
    }

    function pointInsideFrame(point) {
        return Boolean(
            point
            && point.x >= 0
            && point.x <= 1
            && point.y >= 0
            && point.y <= 1
        );
    }

    function pointInsideShoulderSafeArea(point, margin) {
        return pointInsideFrame(point)
            && point.x >= margin
            && point.x <= 1 - margin;
    }

    function rawHorizontalSideFromFeatures(features, config = SETUP_CONFIG) {
        const shoulderXs = [
            features.leftShoulderX,
            features.rightShoulderX
        ].filter(Number.isFinite);

        const margin = config.shoulderEdgeMargin;
        const touchesLeft = shoulderXs.some(value => value < margin);
        const touchesRight = shoulderXs.some(value => value > 1 - margin);

        if (touchesLeft && !touchesRight) return 'RAW_LEFT';
        if (touchesRight && !touchesLeft) return 'RAW_RIGHT';

        const center = features.horizontalBodyCenterX;
        if (!Number.isFinite(center)) return null;
        if (center < config.bodySafeLeft) return 'RAW_LEFT';
        if (center > config.bodySafeRight) return 'RAW_RIGHT';
        return null;
    }

    function mapRawHorizontalSideToInstruction(rawSide) {
        // MoveNet reads the underlying camera image while the preview is mirrored by CSS.
        // Keep this mapping isolated so real-phone testing can confirm/swap it if needed.
        if (rawSide === 'RAW_LEFT') return 'MOVE_LEFT';
        if (rawSide === 'RAW_RIGHT') return 'MOVE_RIGHT';
        return null;
    }

    function emptyFeatures() {
        return {
            faceVisible: false,
            faceCenterX: null,
            faceCenterY: null,
            faceWidth: null,
            leftShoulderVisible: false,
            rightShoulderVisible: false,
            leftShoulderSafe: false,
            rightShoulderSafe: false,
            leftShoulderX: null,
            rightShoulderX: null,
            shoulderCenterX: null,
            horizontalBodyCenterX: null
        };
    }

    function extractSetupFeatures(keypoints, videoWidth, videoHeight, config = SETUP_CONFIG) {
        if (!Array.isArray(keypoints) || videoWidth <= 0 || videoHeight <= 0) {
            return emptyFeatures();
        }

        const facePoints = keypoints.filter(point => (
            FACE_NAMES.has(point.name)
            && reliablePoint(point, config.faceConfidence)
        ));

        if (facePoints.length < 2) {
            return emptyFeatures();
        }

        const faceXValues = facePoints.map(point => point.x / videoWidth);
        const faceYValues = facePoints.map(point => point.y / videoHeight);
        const leftShoulderPoint = keypoints.find(point => point.name === 'left_shoulder');
        const rightShoulderPoint = keypoints.find(point => point.name === 'right_shoulder');

        const leftShoulderReliable = reliablePoint(leftShoulderPoint, config.shoulderConfidence);
        const rightShoulderReliable = reliablePoint(rightShoulderPoint, config.shoulderConfidence);
        const leftShoulder = leftShoulderReliable
            ? normalizedPoint(leftShoulderPoint, videoWidth, videoHeight)
            : null;
        const rightShoulder = rightShoulderReliable
            ? normalizedPoint(rightShoulderPoint, videoWidth, videoHeight)
            : null;

        const leftShoulderVisible = leftShoulderReliable && pointInsideFrame(leftShoulder);
        const rightShoulderVisible = rightShoulderReliable && pointInsideFrame(rightShoulder);
        const leftShoulderSafe = leftShoulderReliable
            && pointInsideShoulderSafeArea(leftShoulder, config.shoulderEdgeMargin);
        const rightShoulderSafe = rightShoulderReliable
            && pointInsideShoulderSafeArea(rightShoulder, config.shoulderEdgeMargin);

        const reliableUpperBodyXs = [
            ...faceXValues,
            ...(leftShoulderReliable ? [leftShoulder.x] : []),
            ...(rightShoulderReliable ? [rightShoulder.x] : [])
        ];

        return {
            faceVisible: true,
            faceCenterX: median(faceXValues),
            faceCenterY: median(faceYValues),
            faceWidth: Math.max(...faceXValues) - Math.min(...faceXValues),
            leftShoulderVisible,
            rightShoulderVisible,
            leftShoulderSafe,
            rightShoulderSafe,
            leftShoulderX: leftShoulderReliable ? leftShoulder.x : null,
            rightShoulderX: rightShoulderReliable ? rightShoulder.x : null,
            shoulderCenterX: leftShoulderReliable && rightShoulderReliable
                ? median([leftShoulder.x, rightShoulder.x])
                : null,
            horizontalBodyCenterX: median(reliableUpperBodyXs)
        };
    }

    function classifySetup(features, config = SETUP_CONFIG) {
        if (!features.faceVisible) return 'FACE_NOT_VISIBLE';

        const shouldersSafe = features.leftShoulderSafe && features.rightShoulderSafe;
        if (!shouldersSafe) {
            const rawSide = rawHorizontalSideFromFeatures(features, config);
            const movement = mapRawHorizontalSideToInstruction(rawSide);
            return movement || 'SHOULDERS_NOT_VISIBLE';
        }

        if (features.faceWidth > config.maximumFaceWidth) return 'MOVE_BACK_ONE_STEP';
        if (features.faceWidth < config.minimumFaceWidth) return 'MOVE_CLOSER_ONE_STEP';

        const insideTarget = features.faceCenterY >= config.targetBandTop
            && features.faceCenterY <= config.targetBandBottom;

        return insideTarget ? 'POSITION_CORRECT' : 'FACE_OUTSIDE_TARGET';
    }

    return {
        SETUP_CONFIG,
        classifySetup,
        extractSetupFeatures,
        mapRawHorizontalSideToInstruction,
        rawHorizontalSideFromFeatures
    };
}));
