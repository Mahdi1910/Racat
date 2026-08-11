$ErrorActionPreference = 'Stop'

function Assert-Condition {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw "Verification failed: $Message"
    }
}

$projectDir = Split-Path -Parent $PSScriptRoot
$htmlPath = Join-Path $projectDir 'index.html'
$cssPath = Join-Path $projectDir 'styles.css'
$jsPath = Join-Path $projectDir 'app.js'
$detectorPath = Join-Path $projectDir 'standing-detector.js'
$modelManagerPath = Join-Path $projectDir 'model-manager.js'
$setupGuidePath = Join-Path $projectDir 'setup-guide.js'
$launcherPath = Join-Path $projectDir 'start-https-server.ps1'

Assert-Condition (Test-Path -LiteralPath $htmlPath) 'index.html is missing.'
Assert-Condition (Test-Path -LiteralPath $cssPath) 'styles.css is missing.'
Assert-Condition (Test-Path -LiteralPath $jsPath) 'app.js is missing.'
Assert-Condition (Test-Path -LiteralPath $detectorPath) 'standing-detector.js is missing.'
Assert-Condition (Test-Path -LiteralPath $modelManagerPath) 'model-manager.js is missing.'
Assert-Condition (Test-Path -LiteralPath $setupGuidePath) 'setup-guide.js is missing.'
Assert-Condition (Test-Path -LiteralPath $launcherPath) 'start-https-server.ps1 is missing.'

$html = Get-Content -LiteralPath $htmlPath -Raw -Encoding utf8
$css = Get-Content -LiteralPath $cssPath -Raw -Encoding utf8
$js = Get-Content -LiteralPath $jsPath -Raw -Encoding utf8
$detector = Get-Content -LiteralPath $detectorPath -Raw -Encoding utf8
$modelManager = Get-Content -LiteralPath $modelManagerPath -Raw -Encoding utf8
$setupGuide = Get-Content -LiteralPath $setupGuidePath -Raw -Encoding utf8
$launcher = Get-Content -LiteralPath $launcherPath -Raw -Encoding utf8

Assert-Condition ($html.Contains('<link rel="stylesheet" href="styles.css">')) 'index.html does not load styles.css.'
Assert-Condition ($html.Contains('<script src="model-manager.js"></script>')) 'index.html does not load model-manager.js.'
Assert-Condition ($html.Contains('<script src="setup-guide.js"></script>')) 'index.html does not load setup-guide.js.'
Assert-Condition ($html.Contains('<script src="standing-detector.js"></script>')) 'index.html does not load standing-detector.js.'
Assert-Condition ($html.Contains('<script src="app.js"></script>')) 'index.html does not load app.js.'
Assert-Condition ($html.IndexOf('<script src="model-manager.js"></script>') -lt $html.IndexOf('<script src="app.js"></script>')) 'model-manager.js must load before app.js.'
Assert-Condition ($html.IndexOf('<script src="setup-guide.js"></script>') -lt $html.IndexOf('<script src="app.js"></script>')) 'setup-guide.js must load before app.js.'
Assert-Condition ($html.IndexOf('<script src="standing-detector.js"></script>') -lt $html.IndexOf('<script src="app.js"></script>')) 'standing-detector.js must load before app.js.'
Assert-Condition ($html -notmatch '<style(?:\s[^>]*)?>') 'index.html still contains an embedded style block.'
Assert-Condition ($html -notmatch '<script>\s*let detector;') 'index.html still contains the embedded application script.'

$requiredMarkup = @(
    'id="model-view"',
    'id="model-checking"',
    'id="model-download-panel"',
    'id="downloadModelBtn"',
    'id="retryModelBtn"',
    'id="model-progress"',
    'id="model-percentage"',
    'id="model-downloaded"',
    'id="model-speed"',
    'id="main-view"',
    'id="positioning-overlay"',
    'id="face-position-band"',
    'id="face-position-label"',
    'id="setup-message"',
    'id="startBtn"',
    'onclick="startApp()"',
    'id="counter-display"',
    'id="status-dot"',
    'id="status"',
    'id="resetBtn"',
    'onclick="resetApp()"',
    'id="sub-status"',
    'id="video"',
    'id="output"'
)
foreach ($token in $requiredMarkup) {
    Assert-Condition ($html.Contains($token)) "index.html lost required markup: $token"
}

$requiredVendors = @(
    'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-core',
    'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-converter',
    'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-webgl',
    'https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection'
)
foreach ($url in $requiredVendors) {
    Assert-Condition ($html.Contains($url)) "index.html lost required vendor script: $url"
}

$requiredSelectors = @(
    '#app-container',
    '#canvas-wrapper',
    '.overlay-layer',
    '.counter-badge',
    '.status-pill',
    '.start-btn-container',
    'button.btn-primary',
    '.reset-btn',
    '.bottom-bar',
    '.model-card',
    '.ai-check-animation',
    '.download-progress-track',
    '.positioning-overlay',
    '.face-position-band',
    '@media (prefers-reduced-motion: reduce)',
    '@media (max-width: 768px), (pointer: coarse)'
)
foreach ($selector in $requiredSelectors) {
    Assert-Condition ($css.Contains($selector)) "styles.css lost required selector: $selector"
}

$requiredBehavior = @(
    'const AppState = Object.freeze({',
    "CHECKING_MODEL: 'CHECKING_MODEL'",
    "MODEL_REQUIRED: 'MODEL_REQUIRED'",
    "DOWNLOADING_MODEL: 'DOWNLOADING_MODEL'",
    "VERIFYING_MODEL: 'VERIFYING_MODEL'",
    "MAIN_READY: 'MAIN_READY'",
    "REQUESTING_CAMERA: 'REQUESTING_CAMERA'",
    "POSITIONING: 'POSITIONING'",
    "COUNTDOWN: 'COUNTDOWN'",
    "TRACKING_PRAYER: 'TRACKING_PRAYER'",
    "ERROR: 'ERROR'",
    'let rakatCount = 1;',
    'let standReturnCount = 0;',
    'let isCurrentlyDown = false;',
    'async function startApp()',
    'async function initializeApplication()',
    'async function downloadModel()',
    'function setAppState(nextState)',
    'function resetApp()',
    'async function setupCamera()',
    'function speak(text)',
    'function processPose(keypoints)',
    'async function renderResult()',
    "facingMode: 'user'",
    'ModelManager.createModelManager({',
    'SetupGuide.classifySetup(',
    "result === 'FACE_NOT_VISIBLE'",
    "result === 'MOVE_BACK_ONE_STEP'",
    "result === 'MOVE_CLOSER_ONE_STEP'",
    "result === 'FACE_OUTSIDE_TARGET'",
    "result === 'POSITION_CORRECT'",
    'StandingDetection.createStandingDetector()',
    'StandingDetection.runCountdown({',
    'StandingDetection.extractFaceY(',
    "transition === 'LEFT_STANDING'",
    "transition === 'RETURNED_TO_STANDING'",
    'if (standReturnCount === 2)',
    "utterance.lang = 'ar-SA';",
    'requestAnimationFrame(renderResult);'
)
foreach ($token in $requiredBehavior) {
    Assert-Condition ($js.Contains($token)) "app.js lost behavior-critical code: $token"
}

$requiredDetectorBehavior = @(
    "nose",
    "left_eye",
    "right_eye",
    "left_ear",
    "right_ear",
    "UNCALIBRATED",
    "STANDING",
    "NOT_STANDING",
    "missingFaceConfirmMs: 400",
    "returnToStandingConfirmMs: 600"
)
foreach ($token in $requiredDetectorBehavior) {
    Assert-Condition ($detector.Contains($token)) "standing-detector.js lost required behavior: $token"
}

$requiredModelManagerBehavior = @(
    'indexeddb://racat-movenet-singlepose-lightning-v4',
    'async function hasValidModel()',
    'async function downloadModel(onProgress = () => {})',
    'function createDetector()',
    'enableSmoothing: true'
)
foreach ($token in $requiredModelManagerBehavior) {
    Assert-Condition ($modelManager.Contains($token)) "model-manager.js lost required behavior: $token"
}

$requiredSetupGuideBehavior = @(
    'targetBandBottom: 0.30',
    'function classifySetup(features, config = SETUP_CONFIG)',
    "return 'FACE_NOT_VISIBLE'",
    "'POSITION_CORRECT'"
)
foreach ($token in $requiredSetupGuideBehavior) {
    Assert-Condition ($setupGuide.Contains($token)) "setup-guide.js lost required behavior: $token"
}

$removedGuideMarkup = @(
    'id="face-target"',
    'id="lighting-sample"'
)
foreach ($token in $removedGuideMarkup) {
    Assert-Condition (-not $html.Contains($token)) "index.html still contains removed guide markup: $token"
}

$removedGuideSelectors = @(
    '.face-target',
    '.lighting-sample'
)
foreach ($token in $removedGuideSelectors) {
    Assert-Condition (-not $css.Contains($token)) "styles.css still contains removed guide selector: $token"
}

$removedFeatureTokens = @(
    'lightingCanvas',
    'lightingContext',
    'lightingMonitor',
    'sampleLighting',
    'deviceorientation',
    'DeviceOrientationEvent',
    'orientationListenerActive',
    'startOrientationMonitoring',
    'stopOrientationMonitoring',
    'FIX_PHONE_ANGLE',
    'IMPROVE_LIGHTING'
)
foreach ($token in $removedFeatureTokens) {
    Assert-Condition (-not $js.Contains($token)) "app.js still contains removed setup behavior: $token"
    Assert-Condition (-not $setupGuide.Contains($token)) "setup-guide.js still contains removed setup behavior: $token"
}

$requiredLauncherBehavior = @(
    '$localAppResponse = Invoke-WebRequest',
    '$publicAppResponse = Invoke-WebRequest',
    '$localModelManagerResponse = Invoke-WebRequest',
    '$publicModelManagerResponse = Invoke-WebRequest',
    '$localModelManagerResponse.Content -notmatch ''poseDetection.SupportedModels.MoveNet''',
    '$publicModelManagerResponse.Content -notmatch ''poseDetection.SupportedModels.MoveNet''',
    '$response.Content -notmatch ''href="styles.css"''',
    '$response.Content -notmatch ''src="model-manager.js"''',
    '$response.Content -notmatch ''src="setup-guide.js"''',
    '$response.Content -notmatch ''src="app.js"''',
    '$publicResponse.Content -notmatch ''href="styles.css"''',
    '$publicResponse.Content -notmatch ''src="model-manager.js"''',
    '$publicResponse.Content -notmatch ''src="setup-guide.js"''',
    '$publicResponse.Content -notmatch ''src="app.js"'''
)
foreach ($token in $requiredLauncherBehavior) {
    Assert-Condition ($launcher.Contains($token)) "HTTPS launcher does not verify the split assets: $token"
}

Write-Host 'Static asset split verification passed.' -ForegroundColor Green
