let detector;
let video;
let canvas;
let ctx;
let modelManager;
let currentSettings = SettingsManager.loadSettings();
let availableVoices = [];

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
    SETTINGS: 'SETTINGS',
    REQUESTING_CAMERA: 'REQUESTING_CAMERA',
    POSITIONING: 'POSITIONING',
    COUNTDOWN: 'COUNTDOWN',
    TRACKING_PRAYER: 'TRACKING_PRAYER',
    ERROR: 'ERROR'
});

const COUNTDOWN_WORDS = Object.freeze({
    5: 'countdown_5',
    4: 'countdown_4',
    3: 'countdown_3',
    2: 'countdown_2',
    1: 'countdown_1',
    0: 'countdown_0'
});

const SETUP_MESSAGE_KEYS = Object.freeze({
    FACE_NOT_VISIBLE: 'face_not_visible',
    FACE_OUTSIDE_TARGET: 'face_here',
    MOVE_BACK_ONE_STEP: 'move_back',
    MOVE_CLOSER_ONE_STEP: 'move_closer',
    POSITION_CORRECT: 'position_correct'
});

const UserError = Object.freeze({
    NETWORK: 'error_network',
    STORAGE: 'error_storage',
    MODEL_INVALID: 'error_model_invalid',
    CAMERA_DENIED: 'camera_denied',
    UNKNOWN: 'error_unknown'
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
    const settingsView = document.getElementById('settings-view');
    const modelChecking = document.getElementById('model-checking');
    const downloadPanel = document.getElementById('model-download-panel');
    const downloadButton = document.getElementById('downloadModelBtn');
    const progressPanel = document.getElementById('download-progress-panel');
    const retryButton = document.getElementById('retryModelBtn');
    const startButton = document.getElementById('startBtn');
    const settingsButton = document.getElementById('settingsBtn');
    const resetButton = document.getElementById('resetBtn');
    const positioningOverlay = document.getElementById('positioning-overlay');
    const countdownDisplay = document.getElementById('countdown-display');

    const showingModelView = modelStates.has(nextState);
    modelView.hidden = !showingModelView;
    mainView.hidden = showingModelView || nextState === AppState.SETTINGS;
    settingsView.hidden = nextState !== AppState.SETTINGS;

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
    settingsButton.style.display = nextState === AppState.MAIN_READY ? 'inline-flex' : 'none';
    resetButton.style.display = nextState === AppState.TRACKING_PRAYER ? 'block' : 'none';
    positioningOverlay.hidden = ![
        AppState.POSITIONING,
        AppState.COUNTDOWN
    ].includes(nextState);
    countdownDisplay.hidden = nextState !== AppState.COUNTDOWN;

    if (nextState === AppState.VERIFYING_MODEL) {
        document.getElementById('model-status-text').innerText = textFor('verifying_model');
    } else if (nextState === AppState.CHECKING_MODEL) {
        document.getElementById('model-status-text').innerText = textFor('checking_model');
    }
}

function textFor(key, replacements = {}) {
    return SettingsManager.translate(key, currentSettings.language, replacements);
}

function applyLanguage() {
    const language = currentSettings.language;
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.title = textFor('app_title');

    for (const element of document.querySelectorAll('[data-i18n]')) {
        element.textContent = textFor(element.dataset.i18n);
    }

    if (appState === AppState.MAIN_READY) {
        document.getElementById('status').innerText = textFor('model_ready');
        document.getElementById('sub-status').innerText = textFor('tap_start');
    }
}

function populateVoiceOptions() {
    const voiceSelect = document.getElementById('voiceSelect');
    if (!voiceSelect || !('speechSynthesis' in window)) return;

    availableVoices = window.speechSynthesis.getVoices();
    const sortedVoices = SettingsManager.sortVoices(availableVoices, currentSettings.language);
    voiceSelect.replaceChildren();

    const systemOption = document.createElement('option');
    systemOption.value = '';
    systemOption.textContent = textFor('system_voice');
    voiceSelect.appendChild(systemOption);

    for (const voice of sortedVoices) {
        const option = document.createElement('option');
        option.value = voice.voiceURI;
        option.textContent = `${voice.name} — ${voice.lang}`;
        voiceSelect.appendChild(option);
    }

    const savedVoiceExists = sortedVoices.some(voice => voice.voiceURI === currentSettings.voiceURI);
    voiceSelect.value = savedVoiceExists ? currentSettings.voiceURI : '';
}

function renderSettings() {
    document.getElementById('languageSelect').value = currentSettings.language;
    document.getElementById('quietModeToggle').checked = currentSettings.quietMode;
    applyLanguage();
    populateVoiceOptions();
}

function saveSettingsForm() {
    currentSettings = SettingsManager.saveSettings({
        language: document.getElementById('languageSelect').value,
        voiceURI: document.getElementById('voiceSelect').value,
        quietMode: document.getElementById('quietModeToggle').checked
    });
    return currentSettings;
}

function handleLanguageChange() {
    saveSettingsForm();
    applyLanguage();
    populateVoiceOptions();
}

function openSettings() {
    if (appState !== AppState.MAIN_READY) return;
    setAppState(AppState.SETTINGS);
    renderSettings();
}

function closeSettings() {
    saveSettingsForm();
    applyLanguage();
    setAppState(AppState.MAIN_READY);
    document.getElementById('status').innerText = textFor('model_ready');
    document.getElementById('sub-status').innerText = textFor('tap_start');
}

function initializeSettings() {
    currentSettings = SettingsManager.loadSettings();
    document.getElementById('languageSelect').addEventListener('change', handleLanguageChange);
    document.getElementById('voiceSelect').addEventListener('change', saveSettingsForm);
    document.getElementById('quietModeToggle').addEventListener('change', saveSettingsForm);

    if ('speechSynthesis' in window) {
        window.speechSynthesis.addEventListener('voiceschanged', populateVoiceOptions);
    }

    applyLanguage();
    populateVoiceOptions();
}

function showModelError(errorCode) {
    const errorElement = document.getElementById('model-error');
    errorElement.innerText = textFor(UserError[errorCode] || UserError.UNKNOWN);
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
    statusText.innerText = textFor('connecting_camera');
    subStatus.innerText = textFor('allow_camera');

    try {
        await setupCamera();
        statusDot.classList.add('active');
        isRunning = true;
        beginPositioning();
        renderResult();
    } catch (error) {
        statusDot.classList.remove('active');
        statusText.innerText = textFor('camera_failed');
        subStatus.innerText = textFor('camera_denied');
        setAppState(AppState.MAIN_READY);
    }
}

function resetApp() {
    rakatCount = 1;
    standReturnCount = 0;
    isCurrentlyDown = false;
    document.getElementById('counter-display').innerText = rakatCount;
    document.getElementById('sub-status').innerText = textFor('counter_reset');
    speak('counter_reset');
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

function speak(messageKey, replacements = {}) {
    if (!('speechSynthesis' in window)) return;

    const request = SettingsManager.createSpeechRequest(
        messageKey,
        currentSettings,
        availableVoices,
        replacements
    );
    if (!request) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(request.text);
    utterance.lang = request.language;
    if (request.voice) utterance.voice = request.voice;
    window.speechSynthesis.speak(utterance);
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
    document.getElementById('status').innerText = textFor('preparing_position');
    document.getElementById('sub-status').innerText = textFor('follow_guide');
    document.getElementById('setup-message').innerText = '';
    document.getElementById('face-position-band').classList.remove('is-correct');
    document.getElementById('face-position-label').hidden = false;
    speak('face_not_visible');
}

function setupMessageKeyForResult(result) {
    return SETUP_MESSAGE_KEYS[result] || SETUP_MESSAGE_KEYS.FACE_NOT_VISIBLE;
}

function speakSetupInstruction(result, timestamp) {
    if (result === 'POSITION_CORRECT') return;

    const resultChanged = result !== lastSpokenResult;
    const cooldownFinished = timestamp - lastInstructionSpokenAt
        >= SetupGuide.SETUP_CONFIG.instructionSpeechCooldownMs;

    if (resultChanged || cooldownFinished) {
        speak(setupMessageKeyForResult(result));
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
    setupMessage.innerText = distanceResult ? textFor(setupMessageKeyForResult(result)) : '';
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
            speak('position_correct');
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
            document.getElementById('status').innerText = textFor('countdown_status', { count: value });
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
        document.getElementById('setup-message').innerText = textFor('reposition');
        speak('reposition');
        return;
    }

    enterPrayerTracking();
}

function enterPrayerTracking() {
    setupRunId++;
    setAppState(AppState.TRACKING_PRAYER);
    document.getElementById('setup-message').innerText = '';
    document.getElementById('status').innerText = textFor('standing');
    document.getElementById('sub-status').innerText = textFor('tracking_started');
}

function handleStandingTransition(transition) {
    const subStatus = document.getElementById('sub-status');

    if (transition === 'LEFT_STANDING') {
        isCurrentlyDown = true;
        subStatus.innerText = textFor('left_standing');
        return;
    }

    if (transition === 'RETURNED_TO_STANDING' && isCurrentlyDown) {
        standReturnCount++;
        isCurrentlyDown = false;

        if (standReturnCount === 2) {
            rakatCount++;
            standReturnCount = 0;
            document.getElementById('counter-display').innerText = rakatCount;
            subStatus.innerText = textFor('rakat_complete', { count: rakatCount });
            speak('rakat_number', { count: rakatCount });
        } else {
            subStatus.innerText = textFor('returned_from_ruku');
        }
    }
}

function processPrayerFrame(keypoints, timestamp) {
    const faceY = StandingDetection.extractFaceY(keypoints, video.videoHeight);
    const result = standingDetector.update(faceY, timestamp);
    document.getElementById('status').innerText = result.state === StandingDetection.StandingState.STANDING
        ? textFor('standing')
        : textFor('not_standing');

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

function bootApplication() {
    initializeSettings();
    initializeApplication();
}

window.addEventListener('DOMContentLoaded', bootApplication);
