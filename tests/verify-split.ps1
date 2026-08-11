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
$launcherPath = Join-Path $projectDir 'start-https-server.ps1'

Assert-Condition (Test-Path -LiteralPath $htmlPath) 'index.html is missing.'
Assert-Condition (Test-Path -LiteralPath $cssPath) 'styles.css is missing.'
Assert-Condition (Test-Path -LiteralPath $jsPath) 'app.js is missing.'
Assert-Condition (Test-Path -LiteralPath $launcherPath) 'start-https-server.ps1 is missing.'

$html = Get-Content -LiteralPath $htmlPath -Raw -Encoding utf8
$css = Get-Content -LiteralPath $cssPath -Raw -Encoding utf8
$js = Get-Content -LiteralPath $jsPath -Raw -Encoding utf8
$launcher = Get-Content -LiteralPath $launcherPath -Raw -Encoding utf8

Assert-Condition ($html.Contains('<link rel="stylesheet" href="styles.css">')) 'index.html does not load styles.css.'
Assert-Condition ($html.Contains('<script src="app.js"></script>')) 'index.html does not load app.js.'
Assert-Condition ($html -notmatch '<style(?:\s[^>]*)?>') 'index.html still contains an embedded style block.'
Assert-Condition ($html -notmatch '<script>\s*let detector;') 'index.html still contains the embedded application script.'

$requiredMarkup = @(
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
    '@media (max-width: 768px), (pointer: coarse)'
)
foreach ($selector in $requiredSelectors) {
    Assert-Condition ($css.Contains($selector)) "styles.css lost required selector: $selector"
}

$requiredBehavior = @(
    'let rakatCount = 1;',
    'let standReturnCount = 0;',
    'let isCurrentlyDown = false;',
    'async function startApp()',
    'function resetApp()',
    'async function setupCamera()',
    'async function loadModel()',
    'function speak(text)',
    'function processPose(keypoints)',
    'async function renderResult()',
    "facingMode: 'user'",
    'poseDetection.SupportedModels.MoveNet',
    'poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING',
    'if (noseY_ratio < 0.35)',
    'else if (noseY_ratio > 0.60)',
    'if (standReturnCount === 2)',
    "utterance.lang = 'ar-SA';",
    'requestAnimationFrame(renderResult);'
)
foreach ($token in $requiredBehavior) {
    Assert-Condition ($js.Contains($token)) "app.js lost behavior-critical code: $token"
}

$requiredLauncherBehavior = @(
    '$localAppResponse = Invoke-WebRequest',
    '$publicAppResponse = Invoke-WebRequest',
    '$localAppResponse.Content -notmatch ''poseDetection.SupportedModels.MoveNet''',
    '$publicAppResponse.Content -notmatch ''poseDetection.SupportedModels.MoveNet''',
    '$response.Content -notmatch ''href="styles.css"''',
    '$response.Content -notmatch ''src="app.js"''',
    '$publicResponse.Content -notmatch ''href="styles.css"''',
    '$publicResponse.Content -notmatch ''src="app.js"'''
)
foreach ($token in $requiredLauncherBehavior) {
    Assert-Condition ($launcher.Contains($token)) "HTTPS launcher does not verify the split assets: $token"
}

Write-Host 'Static asset split verification passed.' -ForegroundColor Green
