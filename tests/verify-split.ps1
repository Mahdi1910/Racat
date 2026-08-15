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
$cssPath = Join-Path $projectDir 'css\styles.css'
$developerCssPath = Join-Path $projectDir 'css\developer-settings.css'
$jsPath = Join-Path $projectDir 'js\app.js'
$detectorPath = Join-Path $projectDir 'js\standing-detector.js'
$modelManagerPath = Join-Path $projectDir 'js\model-manager.js'
$setupGuidePath = Join-Path $projectDir 'js\setup-guide.js'
$settingsManagerPath = Join-Path $projectDir 'js\settings-manager.js'
$developerSettingsPath = Join-Path $projectDir 'js\developer-settings.js'
$appFlowTestPath = Join-Path $projectDir 'tests\app-flow.test.js'
$developerSettingsTestPath = Join-Path $projectDir 'tests\developer-settings.test.js'
$plan8AppTestPath = Join-Path $projectDir 'tests\app-plan8.test.js'
$httpsUtilsPath = Join-Path $projectDir 'scripts\https-utils.ps1'
$launcherPath = Join-Path $projectDir 'start-https-server.ps1'

$requiredPaths = @(
    $htmlPath,
    $cssPath,
    $developerCssPath,
    $jsPath,
    $detectorPath,
    $modelManagerPath,
    $setupGuidePath,
    $settingsManagerPath,
    $developerSettingsPath,
    $appFlowTestPath,
    $developerSettingsTestPath,
    $plan8AppTestPath,
    $httpsUtilsPath,
    $launcherPath
)
foreach ($path in $requiredPaths) {
    Assert-Condition (Test-Path -LiteralPath $path) "Required file is missing: $path"
}

$html = Get-Content -LiteralPath $htmlPath -Raw -Encoding utf8
$css = Get-Content -LiteralPath $cssPath -Raw -Encoding utf8
$developerCss = Get-Content -LiteralPath $developerCssPath -Raw -Encoding utf8
$js = Get-Content -LiteralPath $jsPath -Raw -Encoding utf8
$detector = Get-Content -LiteralPath $detectorPath -Raw -Encoding utf8
$modelManager = Get-Content -LiteralPath $modelManagerPath -Raw -Encoding utf8
$setupGuide = Get-Content -LiteralPath $setupGuidePath -Raw -Encoding utf8
$settingsManager = Get-Content -LiteralPath $settingsManagerPath -Raw -Encoding utf8
$developerSettings = Get-Content -LiteralPath $developerSettingsPath -Raw -Encoding utf8
$launcher = Get-Content -LiteralPath $launcherPath -Raw -Encoding utf8

$requiredAssets = @(
    '<link rel="stylesheet" href="css/styles.css">',
    '<link rel="stylesheet" href="css/developer-settings.css">',
    '<script src="js/model-manager.js"></script>',
    '<script src="js/setup-guide.js"></script>',
    '<script src="js/standing-detector.js"></script>',
    '<script src="js/settings-manager.js"></script>',
    '<script src="js/developer-settings.js"></script>',
    '<script src="js/app.js"></script>'
)
foreach ($token in $requiredAssets) {
    Assert-Condition ($html.Contains($token)) "index.html does not load required asset: $token"
}
Assert-Condition ($html.IndexOf('<script src="js/developer-settings.js"></script>') -lt $html.IndexOf('<script src="js/app.js"></script>')) 'developer-settings.js must load before app.js.'
Assert-Condition ($html.IndexOf('<script src="js/setup-guide.js"></script>') -lt $html.IndexOf('<script src="js/developer-settings.js"></script>')) 'setup-guide.js must load before developer-settings.js.'
Assert-Condition ($html.IndexOf('<script src="js/standing-detector.js"></script>') -lt $html.IndexOf('<script src="js/developer-settings.js"></script>')) 'standing-detector.js must load before developer-settings.js.'
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
    'id="settingsBtn"',
    'id="settings-view"',
    'id="settingsBackBtn"',
    'id="languageSelect"',
    'id="voiceSelect"',
    'id="quietModeToggle"',
    'id="developer-options"',
    'id="developer-settings-list"',
    'id="developer-settings-error"',
    'id="developerRestoreDefaultsBtn"',
    'id="developerSaveTestBtn"',
    'onclick="restoreDeveloperDefaults()"',
    'onclick="saveAndTestDeveloperSettings()"',
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
    '<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-core@4.22.0"></script>',
    '<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-converter@4.22.0"></script>',
    '<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-webgl@4.22.0"></script>',
    '<script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@2.1.3"></script>'
)
foreach ($scriptTag in $requiredVendors) {
    Assert-Condition ($html.Contains($scriptTag)) "index.html lost or changed pinned vendor script: $scriptTag"
}

$forbiddenUnversionedVendors = @(
    '<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-core"></script>',
    '<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-converter"></script>',
    '<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-webgl"></script>',
    '<script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection"></script>'
)
foreach ($scriptTag in $forbiddenUnversionedVendors) {
    Assert-Condition (-not $html.Contains($scriptTag)) "index.html still contains unversioned TensorFlow dependency: $scriptTag"
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

$requiredDeveloperSelectors = @(
    '.settings-view',
    '.developer-options',
    '.developer-field',
    '.developer-stepper',
    '.developer-step-button',
    '.developer-settings-error',
    '.developer-actions',
    '--face-band-top',
    '--face-band-height'
)
foreach ($selector in $requiredDeveloperSelectors) {
    Assert-Condition ($developerCss.Contains($selector)) "developer-settings.css lost required selector: $selector"
}

$requiredBehavior = @(
    'const AppState = Object.freeze({',
    "CHECKING_MODEL: 'CHECKING_MODEL'",
    "MODEL_REQUIRED: 'MODEL_REQUIRED'",
    "DOWNLOADING_MODEL: 'DOWNLOADING_MODEL'",
    "VERIFYING_MODEL: 'VERIFYING_MODEL'",
    "MAIN_READY: 'MAIN_READY'",
    "SETTINGS: 'SETTINGS'",
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
    'function openSettings()',
    'function closeSettings()',
    'function saveAndTestDeveloperSettings()',
    'function restoreDeveloperDefaults()',
    'function refreshRuntimeDeveloperConfig(',
    'function applyRuntimeFaceGuide()',
    'function renderDeveloperSettingsForm(',
    'function directionalInstructionReady(',
    'function resetHorizontalGuidance()',
    "SHOULDERS_NOT_VISIBLE: 'shoulders_not_visible'",
    "MOVE_LEFT: 'move_left'",
    "MOVE_RIGHT: 'move_right'",
    'runtimeSetupConfig',
    'runtimeStandingConfig',
    'DeveloperSettings.saveSettings(',
    'DeveloperSettings.buildSetupConfig(',
    'DeveloperSettings.buildStandingConfig(',
    'StandingDetection.createStandingDetector(runtimeStandingConfig)',
    'SetupGuide.extractSetupFeatures(',
    'SetupGuide.classifySetup(features, runtimeSetupConfig)',
    'from: runtimeStandingConfig.countdownFrom',
    'runtimeSetupConfig.validPositionMs',
    'runtimeSetupConfig.invalidCountdownGraceMs',
    'runtimeSetupConfig.instructionSpeechCooldownMs',
    'runtimeSetupConfig.horizontalGuidanceConfirmMs',
    'StandingDetection.extractFaceY(',
    'runtimeStandingConfig',
    'requestAnimationFrame(renderResult);',
    'if (standReturnCount === 2)',
    "transition === 'LEFT_STANDING'",
    "transition === 'RETURNED_TO_STANDING'",
    'const mediaDevices = globalThis.navigator?.mediaDevices;',
    'const tfApi = globalThis.tf;',
    'const poseApi = globalThis.poseDetection;',
    "error.code || 'UNKNOWN'",
    "facingMode: 'user'"
)
foreach ($token in $requiredBehavior) {
    Assert-Condition ($js.Contains($token)) "app.js lost behavior-critical code: $token"
}

$forbiddenErrorFallbacks = @(
    "error.code || 'STORAGE'",
    "error.code || 'NETWORK'",
    "subStatus.innerText = textFor('camera_denied')"
)
foreach ($token in $forbiddenErrorFallbacks) {
    Assert-Condition (-not $js.Contains($token)) "app.js restored an inaccurate broad error fallback: $token"
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
    "minimumCalibrationSamples: 10",
    "standingZoneRadius: 0.07",
    "leaveStandingConfirmMs: 250",
    "missingFaceConfirmMs: 400",
    "returnToStandingConfirmMs: 600",
    'standingFaceY = median(calibrationSamples);'
)
foreach ($token in $requiredDetectorBehavior) {
    Assert-Condition ($detector.Contains($token)) "standing-detector.js lost required behavior: $token"
}
Assert-Condition (-not $detector.Contains('maximumCalibrationSpread')) 'standing-detector.js restored the removed calibration spread threshold.'
Assert-Condition (-not $detector.Contains('FACE_NOT_STABLE')) 'standing-detector.js restored the removed calibration spread rejection.'

$requiredModelManagerBehavior = @(
    'indexeddb://racat-movenet-singlepose-lightning-v4',
    'async function hasValidModel()',
    'async function downloadModel(onProgress = () => {})',
    'async function createDetector()',
    "'MODEL_LIBRARY_LOAD'",
    "'STORAGE_READ'",
    "'MODEL_DOWNLOAD'",
    "'STORAGE_WRITE'",
    "'MODEL_INVALID'",
    "'DETECTOR_INIT'",
    'enableSmoothing: true'
)
foreach ($token in $requiredModelManagerBehavior) {
    Assert-Condition ($modelManager.Contains($token)) "model-manager.js lost required behavior: $token"
}

$requiredSetupGuideBehavior = @(
    'faceConfidence: 0.35',
    'shoulderConfidence: 0.35',
    'targetBandTop: 0.01',
    'targetBandBottom: 0.50',
    'minimumFaceWidth: 0.02',
    'maximumFaceWidth: 0.20',
    'shoulderEdgeMargin: 0.02',
    'bodySafeLeft: 0.25',
    'bodySafeRight: 0.75',
    'validPositionMs: 800',
    'invalidCountdownGraceMs: 1500',
    'instructionSpeechCooldownMs: 2000',
    'horizontalGuidanceConfirmMs: 1000',
    "'left_shoulder'",
    "'right_shoulder'",
    'function classifySetup(features, config = SETUP_CONFIG)',
    'function mapRawHorizontalSideToInstruction(',
    "return 'FACE_NOT_VISIBLE'",
    "'SHOULDERS_NOT_VISIBLE'",
    "'MOVE_LEFT'",
    "'MOVE_RIGHT'",
    "'POSITION_CORRECT'"
)
foreach ($token in $requiredSetupGuideBehavior) {
    Assert-Condition ($setupGuide.Contains($token)) "setup-guide.js lost required behavior: $token"
}

$requiredSettingsBehavior = @(
    'racat-settings-v1',
    'function loadSettings(',
    'function saveSettings(',
    'function translate(',
    'function sortVoices(',
    'function findVoice(',
    'function createSpeechRequest(',
    'error_model_library_load',
    'error_storage_read',
    'error_model_download',
    'error_storage_write',
    'error_detector_init',
    'camera_permission_denied',
    'camera_not_found',
    'camera_busy',
    'camera_constraints',
    'camera_unsupported',
    'camera_start_failed',
    'shoulders_not_visible',
    'move_left',
    'move_right'
)
foreach ($token in $requiredSettingsBehavior) {
    Assert-Condition ($settingsManager.Contains($token)) "settings-manager.js lost required behavior: $token"
}

$requiredDeveloperSettingsBehavior = @(
    "const STORAGE_KEY = 'racat-developer-settings-v1';",
    'const FIELD_DEFINITIONS = Object.freeze([',
    'function createDefaults(',
    'function validateSettings(',
    'function loadSettings(',
    'function saveSettings(',
    'function buildSetupConfig(',
    'function buildStandingConfig(',
    'setupFaceConfidencePct',
    'shoulderConfidencePct',
    'targetBandTopPct',
    'targetBandBottomPct',
    'minimumFaceWidthPct',
    'maximumFaceWidthPct',
    'shoulderEdgeMarginPct',
    'bodySafeLeftPct',
    'bodySafeRightPct',
    'validPositionSeconds',
    'invalidCountdownGraceSeconds',
    'instructionSpeechCooldownSeconds',
    'horizontalGuidanceConfirmSeconds',
    'trackingFaceConfidencePct',
    'countdownFrom',
    'minimumCalibrationSamples',
    'standingZoneRadiusPct',
    'leaveStandingConfirmSeconds',
    'missingFaceConfirmSeconds',
    'returnToStandingConfirmSeconds'
)
foreach ($token in $requiredDeveloperSettingsBehavior) {
    Assert-Condition ($developerSettings.Contains($token)) "developer-settings.js lost required behavior: $token"
}

$forbiddenSettingsMarkup = @(
    'id="vibration',
    'id="volumeTest',
    'id="recalibrate',
    'id="wakeLock'
)
foreach ($token in $forbiddenSettingsMarkup) {
    Assert-Condition (-not $html.Contains($token)) "index.html contains an excluded settings control: $token"
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
    ". (Join-Path `$projectDir 'scripts\https-utils.ps1')",
    'Invoke-WithRetry',
    'Test-TunnelReadyLog',
    "-OperationName 'Waiting for Cloudflare Tunnel to connect'",
    "-OperationName 'Waiting for the public HTTPS address'",
    '$localAppResponse = Invoke-WebRequest',
    '$appResponse = Invoke-WebRequest',
    '$localModelManagerResponse = Invoke-WebRequest',
    '$modelManagerResponse = Invoke-WebRequest',
    '$localSettingsManagerResponse = Invoke-WebRequest',
    '$settingsManagerResponse = Invoke-WebRequest',
    '$localModelManagerResponse.Content -notmatch ''poseDetection.SupportedModels.MoveNet''',
    '$modelManagerResponse.Content -notmatch ''poseDetection.SupportedModels.MoveNet''',
    '$response.Content -notmatch ''href="css/styles.css"''',
    '$response.Content -notmatch ''src="js/model-manager.js"''',
    '$response.Content -notmatch ''src="js/setup-guide.js"''',
    '$response.Content -notmatch ''src="js/settings-manager.js"''',
    '$response.Content -notmatch ''src="js/app.js"''',
    '$rootResponse.Content -notmatch ''href="css/styles.css"''',
    '$rootResponse.Content -notmatch ''src="js/model-manager.js"''',
    '$rootResponse.Content -notmatch ''src="js/setup-guide.js"''',
    '$rootResponse.Content -notmatch ''src="js/settings-manager.js"''',
    '$localSettingsManagerResponse.Content -notmatch ''racat-settings-v1''',
    '$settingsManagerResponse.Content -notmatch ''racat-settings-v1''',
    '$rootResponse.Content -notmatch ''src="js/app.js"'''
)
foreach ($token in $requiredLauncherBehavior) {
    Assert-Condition ($launcher.Contains($token)) "HTTPS launcher does not verify the split assets: $token"
}

Write-Host 'Static asset split verification passed.' -ForegroundColor Green
