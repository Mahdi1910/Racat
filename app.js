let detector;
let video;
let canvas;
let ctx;
let modelManager;

let rakatCount = 1;
let standReturnCount = 0;
let isCurrentlyDown = false;
let isRunning = false;
let appState = null;
let standingDetector = StandingDetection.createStandingDetector();
let setupRunId = 0;
let correctPositionSince = null;
let invalidCountdownSince = null;
let lastSetupResult = null;
let lastSpokenResult = null;
let lastInstructionSpokenAt = -Infinity;

const AppState = Object.freeze({
    CHECKING_MODEL: 'CHECKING_MODEL',
    MODEL_REQUIRED: 'MODEL_REQUIRED',
    DOWNLOADING_MODEL: 'DOWNLOADING_MODEL',
    VERIFYING_MODEL: 'VERIFYING_MODEL',
    MAIN_READY: 'MAIN_READY',
    REQUESTING_CAMERA: 'REQUESTING_CAMERA',
    POSITIONING: 'POSITIONING',
    COUNTDOWN: 'COUNTDOWN',
    TRACKING_PRAYER: 'TRACKING_PRAYER',
    ERROR: 'ERROR'
});

const COUNTDOWN_WORDS = Object.freeze({
    5: 'خمسة',
    4: 'أربعة',
    3: 'ثلاثة',
    2: 'اثنان',
    1: 'واحد',
    0: 'صفر'
});

const SETUP_MESSAGES = Object.freeze({
    FACE_NOT_VISIBLE: 'الوجه غير ظاهر، انظر إلى الكاميرا',
    MOVE_BACK_ONE_STEP: 'ارجع خطوة واحدة إلى الخلف',
    MOVE_CLOSER_ONE_STEP: 'اقترب خطوة واحدة',
    POSITION_CORRECT: 'ممتاز، توقف في مكانك'
});

const UserError = Object.freeze({
    NETWORK: 'تعذر تنزيل النموذج، تحقق من الإنترنت وحاول مرة أخرى',
    STORAGE: 'تعذر حفظ النموذج على الجهاز، وفر مساحة وحاول مرة أخرى',
    MODEL_INVALID: 'ملف الذكاء الاصطناعي غير صالح، أعد تنزيله',
    CAMERA_DENIED: 'يجب السماح للكاميرا حتى يعمل عداد الركعات',
    UNKNOWN: 'حدث خطأ غير متوقع، حاول مرة أخرى'
});

function setAppState(nextState) {
    appState = nextState;

    const modelStates = new Set([
        AppState.CHECKING_MODEL,
        AppState.MODEL_REQUIRED,
        AppState.DOWNLOADING_MODEL,
        AppState.VERIFYING_MODEL,
        AppState.ERROR
    ]);
    const modelView = document.getElementById('model-view');
    const mainView = document.getElementById('main-view');
    const modelChecking = document.getElementById('model-checking');
    const downloadPanel = document.getElementById('model-download-panel');
    const downloadButton = document.getElementById('downloadModelBtn');
    const progressPanel = document.getElementById('download-progress-panel');
    const retryButton = document.getElementById('retryModelBtn');
    const startButton = document.getElementById('startBtn');
    const resetButton = document.getElementById('resetBtn');
    const positioningOverlay = document.getElementById('positioning-overlay');
    const countdownDisplay = document.getElementById('countdown-display');

    const showingModelView = modelStates.has(nextState);
    modelView.hidden = !showingModelView;
    mainView.hidden = showingModelView;

    modelChecking.hidden = ![
        AppState.CHECKING_MODEL,
        AppState.VERIFYING_MODEL
    ].includes(nextState);
    downloadPanel.hidden = ![
        AppState.MODEL_REQUIRED,
        AppState.DOWNLOADING_MODEL,
        AppState.ERROR
    ].includes(nextState);
    downloadButton.hidden = nextState !== AppState.MODEL_REQUIRED;
    progressPanel.hidden = nextState !== AppState.DOWNLOADING_MODEL;
    retryButton.hidden = nextState !== AppState.ERROR;

    startButton.style.display = nextState === AppState.MAIN_READY ? 'flex' : 'none';
    resetButton.style.display = nextState === AppState.TRACKING_PRAYER ? 'block' : 'none';
    positioningOverlay.hidden = ![
        AppState.POSITIONING,
        AppState.COUNTDOWN
    ].includes(nextState);
    countdownDisplay.hidden = nextState !== AppState.COUNTDOWN;

    if (nextState === AppState.VERIFYING_MODEL) {
        document.getElementById('model-status-text').innerText = 'جاري التحقق من النموذج وحفظه...';
    } else if (nextState === AppState.CHECKING_MODEL) {
        document.getElementById('model-status-text').innerText = 'جاري التحقق من النموذج...';
    }
}

function showModelError(errorCode) {
    const errorElement = document.getElementById('model-error');
    errorElement.innerText = UserError[errorCode] || UserError.UNKNOWN;
    errorElement.hidden = false;
    document.getElementById('model-download-description').hidden = true;
    setAppState(AppState.ERROR);
}

async function initializeApplication() {
    setAppState(AppState.CHECKING_MODEL);
    document.getElementById('model-error').hidden = true;
    document.getElementById('model-download-description').hidden = false;

    try {
        modelManager = ModelManager.createModelManager({ tf, poseDetection });
        const hasModel = await modelManager.hasValidModel();

        if (!hasModel) {
            setAppState(AppState.MODEL_REQUIRED);
            return;
        }

        detector = await modelManager.createDetector();
        setAppState(AppState.MAIN_READY);
    } catch (error) {
        showModelError(error.code || 'STORAGE');
    }
}

async function downloadModel() {
    setAppState(AppState.DOWNLOADING_MODEL);
    document.getElementById('model-error').hidden = true;

    try {
        await modelManager.downloadModel(progress => {
            const progressBar = document.getElementById('model-progress');
            progressBar.style.width = `${progress.percentage}%`;
            progressBar.parentElement.setAttribute('aria-valuenow', String(progress.percentage));
            document.getElementById('model-percentage').innerText = `${progress.percentage}%`;
            document.getElementById('model-downloaded').innerText = ModelManager.formatBytes(progress.downloadedBytes);
            document.getElementById('model-speed').innerText = ModelManager.formatSpeed(progress.bytesPerSecond);

            if (progress.percentage === 100) {
                setAppState(AppState.VERIFYING_MODEL);
            }
        });

        detector = await modelManager.createDetector();
        setAppState(AppState.MAIN_READY);
    } catch (error) {
        showModelError(error.code || 'NETWORK');
    }
}

async function startApp() {
    const statusText = document.getElementById('status');
    const statusDot = document.getElementById('status-dot');
    const subStatus = document.getElementById('sub-status');

    setAppState(AppState.REQUESTING_CAMERA);
    statusText.innerText = 'جاري الاتصال بالكاميرا...';
    subStatus.innerText = 'يرجى السماح بالوصول إلى الكاميرا';

    try {
        await setupCamera();
        statusDot.classList.add('active');
        isRunning = true;
        beginPositioning();
        renderResult();
    } catch (error) {
        statusDot.classList.remove('active');
        statusText.innerText = 'تعذر تشغيل الكاميرا';
        subStatus.innerText = UserError.CAMERA_DENIED;
        setAppState(AppState.MAIN_READY);
    }
}

function resetApp() {
    rakatCount = 1;
    standReturnCount = 0;
    isCurrentlyDown = false;
    document.getElementById('counter-display').innerText = rakatCount;
    document.getElementById('sub-status').innerText = 'تمت إعادة عداد الركعات';
    speak('تمت إعادة عداد الركعات');
}

async function setupCamera() {
    video = document.getElementById('video');
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
        }
    });

    video.srcObject = stream;
    await new Promise(resolve => {
        video.onloadedmetadata = resolve;
    });
    await video.play();
}

function speak(text) {
    if ('speechSynthesis' in window && text !== '') {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ar-SA';
        window.speechSynthesis.speak(utterance);
    }
}

function beginPositioning() {
    setupRunId++;
    standingDetector.reset();
    correctPositionSince = null;
    invalidCountdownSince = null;
    lastSetupResult = null;
    lastSpokenResult = null;
    lastInstructionSpokenAt = -Infinity;

    setAppState(AppState.POSITIONING);
    document.getElementById('status').innerText = 'تجهيز مكان الوقوف';
    document.getElementById('sub-status').innerText = 'اتبع التعليمات حتى يصبح إطار الوجه أخضر';
    document.getElementById('setup-message').innerText = '';
    document.getElementById('face-position-band').classList.remove('is-correct');
    document.getElementById('face-position-label').hidden = false;
    speak(SETUP_MESSAGES.FACE_NOT_VISIBLE);
}

function setupMessageForResult(result) {
    if (result === 'FACE_NOT_VISIBLE') return SETUP_MESSAGES.FACE_NOT_VISIBLE;
    if (result === 'FACE_OUTSIDE_TARGET') return SETUP_MESSAGES.FACE_NOT_VISIBLE;
    if (result === 'MOVE_BACK_ONE_STEP') return SETUP_MESSAGES.MOVE_BACK_ONE_STEP;
    if (result === 'MOVE_CLOSER_ONE_STEP') return SETUP_MESSAGES.MOVE_CLOSER_ONE_STEP;
    if (result === 'POSITION_CORRECT') return SETUP_MESSAGES.POSITION_CORRECT;
    return SETUP_MESSAGES.FACE_NOT_VISIBLE;
}

function speakSetupInstruction(result, timestamp) {
    if (result === 'POSITION_CORRECT') return;

    const resultChanged = result !== lastSpokenResult;
    const cooldownFinished = timestamp - lastInstructionSpokenAt
        >= SetupGuide.SETUP_CONFIG.instructionSpeechCooldownMs;

    if (resultChanged || cooldownFinished) {
        speak(setupMessageForResult(result));
        lastSpokenResult = result;
        lastInstructionSpokenAt = timestamp;
    }
}

function cancelCountdown(result, timestamp) {
    setupRunId++;
    setAppState(AppState.POSITIONING);
    standingDetector.clearCalibrationSamples();
    correctPositionSince = null;
    invalidCountdownSince = null;
    document.getElementById('countdown-display').innerText = '';
    speakSetupInstruction(result, timestamp);
}

function processSetupFrame(keypoints, timestamp) {
    const features = SetupGuide.extractSetupFeatures(
        keypoints,
        video.videoWidth,
        video.videoHeight
    );
    const result = SetupGuide.classifySetup(features);
    const facePositionBand = document.getElementById('face-position-band');
    const facePositionLabel = document.getElementById('face-position-label');
    const setupMessage = document.getElementById('setup-message');

    const distanceResult = result === 'MOVE_BACK_ONE_STEP'
        || result === 'MOVE_CLOSER_ONE_STEP';
    setupMessage.innerText = distanceResult ? setupMessageForResult(result) : '';
    facePositionLabel.hidden = result === 'POSITION_CORRECT';
    facePositionBand.classList.toggle('is-correct', result === 'POSITION_CORRECT');

    if (result === 'POSITION_CORRECT') {
        invalidCountdownSince = null;
        const faceY = StandingDetection.extractFaceY(keypoints, video.videoHeight);
        standingDetector.addCalibrationSample(faceY);

        if (correctPositionSince === null) {
            correctPositionSince = timestamp;
        }

        if (appState === AppState.POSITIONING
            && timestamp - correctPositionSince >= SetupGuide.SETUP_CONFIG.validPositionMs) {
            speak(SETUP_MESSAGES.POSITION_CORRECT);
            beginCountdown();
        }
    } else {
        correctPositionSince = null;
        speakSetupInstruction(result, timestamp);

        if (appState === AppState.POSITIONING) {
            standingDetector.clearCalibrationSamples();
        }

        if (appState === AppState.COUNTDOWN) {
            if (invalidCountdownSince === null) invalidCountdownSince = timestamp;
            if (timestamp - invalidCountdownSince >= SetupGuide.SETUP_CONFIG.invalidCountdownGraceMs) {
                cancelCountdown(result, timestamp);
            }
        }
    }

    lastSetupResult = result;
}

async function beginCountdown() {
    if (appState !== AppState.POSITIONING) return;

    const currentRunId = ++setupRunId;
    setAppState(AppState.COUNTDOWN);
    document.getElementById('setup-message').innerText = '';

    await StandingDetection.runCountdown({
        from: StandingDetection.DEFAULT_CONFIG.countdownFrom,
        onTick: value => {
            if (currentRunId !== setupRunId || appState !== AppState.COUNTDOWN) return;
            document.getElementById('countdown-display').innerText = value;
            document.getElementById('status').innerText = `البدء خلال: ${value}`;
        },
        speakValue: value => {
            if (currentRunId !== setupRunId || appState !== AppState.COUNTDOWN) return;
            speak(COUNTDOWN_WORDS[value]);
        }
    });

    if (currentRunId !== setupRunId || appState !== AppState.COUNTDOWN) return;

    const calibration = standingDetector.finishCalibration();
    if (!calibration.ok) {
        standingDetector.clearCalibrationSamples();
        setAppState(AppState.POSITIONING);
        correctPositionSince = null;
        document.getElementById('setup-message').innerText = 'أعد ضبط مكانك داخل الإطار';
        speak('أعد ضبط مكانك داخل الإطار');
        return;
    }

    enterPrayerTracking();
}

function enterPrayerTracking() {
    setupRunId++;
    setAppState(AppState.TRACKING_PRAYER);
    document.getElementById('setup-message').innerText = '';
    document.getElementById('status').innerText = 'الوضع: وقوف';
    document.getElementById('sub-status').innerText = 'بدأ تتبع الصلاة';
}

function handleStandingTransition(transition) {
    const subStatus = document.getElementById('sub-status');

    if (transition === 'LEFT_STANDING') {
        isCurrentlyDown = true;
        subStatus.innerText = 'تم رصد مغادرة وضع الوقوف';
        return;
    }

    if (transition === 'RETURNED_TO_STANDING' && isCurrentlyDown) {
        standReturnCount++;
        isCurrentlyDown = false;

        if (standReturnCount === 2) {
            rakatCount++;
            standReturnCount = 0;
            document.getElementById('counter-display').innerText = rakatCount;
            subStatus.innerText = `تم إكمال الركعة السابقة! الركعة ${rakatCount}`;
            speak(`الركعة ${rakatCount}`);
        } else {
            subStatus.innerText = 'تم رصد العودة من الركوع.. بانتظار السجود';
        }
    }
}

function processPrayerFrame(keypoints, timestamp) {
    const faceY = StandingDetection.extractFaceY(keypoints, video.videoHeight);
    const result = standingDetector.update(faceY, timestamp);
    document.getElementById('status').innerText = result.state === StandingDetection.StandingState.STANDING
        ? 'الوضع: وقوف'
        : 'الوضع: ليس وقوفاً';

    if (result.transition) handleStandingTransition(result.transition);
}

function processPose(keypoints) {
    const timestamp = performance.now();
    if (appState === AppState.POSITIONING || appState === AppState.COUNTDOWN) {
        processSetupFrame(keypoints, timestamp);
        return;
    }

    if (appState === AppState.TRACKING_PRAYER) {
        processPrayerFrame(keypoints, timestamp);
    }
}

async function renderResult() {
    if (!isRunning) return;

    canvas = document.getElementById('output');
    ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;

    const poses = await detector.estimatePoses(video);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (poses.length > 0) {
        const keypoints = poses[0].keypoints;
        processPose(keypoints);

        for (const point of keypoints) {
            if (point.score > 0.3) {
                ctx.beginPath();
                ctx.arc(point.x, point.y, 8, 0, 2 * Math.PI);
                ctx.fillStyle = point.name === 'nose' ? '#22c55e' : '#3b82f6';
                ctx.fill();
            }
        }
    } else if (appState === AppState.POSITIONING || appState === AppState.COUNTDOWN) {
        processSetupFrame([], performance.now());
    } else if (appState === AppState.TRACKING_PRAYER) {
        processPrayerFrame([], performance.now());
    }

    requestAnimationFrame(renderResult);
}

window.addEventListener('DOMContentLoaded', initializeApplication);
