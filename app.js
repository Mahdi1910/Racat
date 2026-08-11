let detector;
let video;
let canvas;
let ctx;

let rakatCount = 1;
let standReturnCount = 0;
let isCurrentlyDown = false;
let isRunning = false;

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

        statusText.innerText = "جاهز! ابدأ الصلاة";
        statusDot.classList.add('active');
        subStatus.innerText = "سيتم العد آلياً بعد العودة من السجود";
        resetBtn.style.display = 'block';

        isRunning = true;
        renderResult();
        speak("بدأت الصلاة، الركعة الأولى");

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
    document.getElementById('counter-display').innerText = rakatCount;
    document.getElementById('sub-status').innerText = "تم إعادة الضبط، جاهز للركعة الأولى";
    speak("تم إعادة الضبط، الركعة الأولى");
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

function processPose(keypoints) {
    const nose = keypoints.find(k => k.name === 'nose');
    if (!nose || nose.score < 0.3) return;

    const noseY_ratio = nose.y / video.videoHeight;
    let currentPose = "غير محدد";

    if (noseY_ratio < 0.35) {
        currentPose = "وقوف";
    } else if (noseY_ratio > 0.60) {
        currentPose = "نزول";
    }

    if (currentPose === "نزول") {
        isCurrentlyDown = true;
    }

    if (currentPose === "وقوف" && isCurrentlyDown) {
        standReturnCount++;
        isCurrentlyDown = false;

        if (standReturnCount === 2) {
            rakatCount++;
            standReturnCount = 0;

            document.getElementById('counter-display').innerText = rakatCount;
            document.getElementById('sub-status').innerText = "تم إكمال الركعة السابقة! الركعة " + rakatCount;
            speak("الركعة " + rakatCount);
        } else {
            document.getElementById('sub-status').innerText = "تم رصد الركوع.. بانتظار السجود";
        }
    }

    document.getElementById('status').innerText = "الوضع: " + currentPose;
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
    }
    requestAnimationFrame(renderResult);
}
