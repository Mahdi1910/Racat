let detector;
let video;
let canvas;
let ctx;

let rakatCount = 1;
let standReturnCount = 0;
let isCurrentlyDown = false;
let isRunning = false;
let standingDetector = StandingDetection.createStandingDetector();
let trackingPhase = 'IDLE';
let calibrationStartedAt = null;
let setupRunId = 0;

const COUNTDOWN_WORDS = {
    5: 'خمسة',
    4: 'أربعة',
    3: 'ثلاثة',
    2: 'اثنان',
    1: 'واحد',
    0: 'صفر'
};

async function startApp() {
    const btn = document.getElementById('startBtn');
    const statusText = document.getElementById('status');
    const statusDot = document.getElementById('status-dot');
    const resetBtn = document.getElementById('resetBtn');
    const subStatus = document.getElementById('sub-status');

    btn.style.display = 'none';
    statusText.innerText = "جاري الاتصال بالكاميرا...";
    subStatus.innerText = "برجاء السماح بالوصول إلى الكاميرا...";

    try {
        await setupCamera();
        statusText.innerText = "تحميل الذكاء الاصطناعي...";
        await loadModel();

        statusText.innerText = "الكاميرا جاهزة";
        statusDot.classList.add('active');
        resetBtn.style.display = 'block';

        isRunning = true;
        renderResult();
        await beginStandingSetup();

    } catch (error) {
        alert("خطأ أثناء البدء: " + error.message);
        btn.style.display = 'flex';
        statusText.innerText = "حدث خطأ";
        statusDot.classList.remove('active');
    }
}

function resetApp() {
    rakatCount = 1;
    standReturnCount = 0;
    isCurrentlyDown = false;
    standingDetector.reset();
    document.getElementById('counter-display').innerText = rakatCount;

    if (isRunning) {
        beginStandingSetup();
    }
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
    return new Promise((resolve) => {
        video.onloadedmetadata = () => {
            video.play();
            resolve(video);
        };
    });
}

async function loadModel() {
    const model = poseDetection.SupportedModels.MoveNet;
    detector = await poseDetection.createDetector(model, {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
    });
}

function speak(text) {
    if ('speechSynthesis' in window && text !== "") {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ar-SA';
        window.speechSynthesis.speak(utterance);
    }
}

async function beginStandingSetup() {
    const currentRunId = ++setupRunId;
    trackingPhase = 'COUNTDOWN';
    calibrationStartedAt = null;
    standingDetector.reset();

    await StandingDetection.runCountdown({
        from: StandingDetection.DEFAULT_CONFIG.countdownFrom,
        onTick: value => {
            if (currentRunId !== setupRunId) return;
            document.getElementById('status').innerText = "البدء خلال: " + value;
            document.getElementById('sub-status').innerText = "قف في مكان الصلاة وانظر إلى الكاميرا";
        },
        speakValue: value => {
            if (currentRunId !== setupRunId) return;
            speak(COUNTDOWN_WORDS[value]);
        }
    });

    if (currentRunId !== setupRunId) return;

    trackingPhase = 'CALIBRATING';
    document.getElementById('status').innerText = "معايرة وضع الوقوف...";
    document.getElementById('sub-status').innerText = "ابق واقفاً وثبت وجهك باتجاه الكاميرا";
}

function processCalibration(faceY, timestamp) {
    const statusText = document.getElementById('status');
    const subStatus = document.getElementById('sub-status');

    if (faceY === null) {
        calibrationStartedAt = null;
        standingDetector.clearCalibrationSamples();
        statusText.innerText = "بانتظار رؤية الوجه...";
        subStatus.innerText = "ابق واقفاً وانظر إلى الكاميرا";
        return;
    }

    if (calibrationStartedAt === null) {
        calibrationStartedAt = timestamp;
        standingDetector.clearCalibrationSamples();
    }

    standingDetector.addCalibrationSample(faceY);
    statusText.innerText = "معايرة وضع الوقوف...";

    if (timestamp - calibrationStartedAt < StandingDetection.DEFAULT_CONFIG.calibrationDurationMs) {
        return;
    }

    const calibration = standingDetector.finishCalibration();
    if (!calibration.ok) {
        calibrationStartedAt = null;
        standingDetector.clearCalibrationSamples();
        statusText.innerText = "حافظ على ثبات الوجه...";
        subStatus.innerText = "سنحاول معايرة الوقوف مرة أخرى";
        return;
    }

    trackingPhase = 'TRACKING';
    statusText.innerText = "الوضع: وقوف";
    subStatus.innerText = "تم حفظ مكان الوقوف، ابدأ الصلاة";
    speak("تم تحديد وضع الوقوف، ابدأ الصلاة");
}

function handleStandingTransition(transition) {
    const subStatus = document.getElementById('sub-status');

    if (transition === 'LEFT_STANDING') {
        isCurrentlyDown = true;
        subStatus.innerText = "تم رصد مغادرة وضع الوقوف";
        return;
    }

    if (transition === 'RETURNED_TO_STANDING' && isCurrentlyDown) {
        standReturnCount++;
        isCurrentlyDown = false;

        if (standReturnCount === 2) {
            rakatCount++;
            standReturnCount = 0;
            document.getElementById('counter-display').innerText = rakatCount;
            subStatus.innerText = "تم إكمال الركعة السابقة! الركعة " + rakatCount;
            speak("الركعة " + rakatCount);
        } else {
            subStatus.innerText = "تم رصد العودة من الركوع.. بانتظار السجود";
        }
    }
}

function processFaceObservation(faceY, timestamp) {
    if (trackingPhase === 'COUNTDOWN') return;

    if (trackingPhase === 'CALIBRATING') {
        processCalibration(faceY, timestamp);
        return;
    }

    if (trackingPhase !== 'TRACKING') return;

    const result = standingDetector.update(faceY, timestamp);
    document.getElementById('status').innerText = result.state === StandingDetection.StandingState.STANDING
        ? "الوضع: وقوف"
        : "الوضع: ليس وقوفاً";

    if (result.transition) {
        handleStandingTransition(result.transition);
    }
}

function processPose(keypoints) {
    const faceY = StandingDetection.extractFaceY(keypoints, video.videoHeight);
    processFaceObservation(faceY, performance.now());
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

        for (let point of keypoints) {
            if (point.score > 0.3) {
                ctx.beginPath();
                ctx.arc(point.x, point.y, 8, 0, 2 * Math.PI);
                ctx.fillStyle = (point.name === 'nose') ? "#22c55e" : "#3b82f6";
                ctx.fill();
                    }
                }
            } else {
                processFaceObservation(null, performance.now());
            }
    requestAnimationFrame(renderResult);
}
