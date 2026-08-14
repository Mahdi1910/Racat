# Racat Positioning Tolerance Test — Implementation Plan

> **Plan ID:** 5
>
> **Scope:** Make the positioning/setup stage more tolerant for real-world phone testing by widening the accepted face position and distance ranges and by requiring a continuously invalid position for 1.5 seconds before restarting the countdown.
>
> **Status:** Plan only. Do not change application code as part of creating this document.

## 1. Goal

The current setup stage can sometimes restart the countdown even when the user believes they are standing still and their face still appears inside the visible guide. The likely cause is normal frame-to-frame pose-estimation variation combined with strict binary thresholds and a very short invalid-position grace period.

This implementation is intentionally a **real-world test configuration**. The user will test it on the deployed phone application and may later decide to tighten the distance minimum again.

The target configuration is:

```javascript
targetBandTop: 0.01,
targetBandBottom: 0.30,
minimumFaceWidth: 0.02,
maximumFaceWidth: 0.20,
invalidCountdownGraceMs: 1500
```

Meaning:

- vertical face position accepted from **1% to 30%** of camera height,
- apparent face width accepted from **2% to 20%** of camera width,
- countdown is cancelled only after **1.5 continuous seconds** of invalid positioning.

## 2. Current behavior

The setup configuration currently lives in `js/setup-guide.js`.

Current important values:

```javascript
targetBandTop: 0.08,
targetBandBottom: 0.30,
minimumFaceWidth: 0.055,
maximumFaceWidth: 0.16,
validPositionMs: 800,
invalidCountdownGraceMs: 250,
instructionSpeechCooldownMs: 2000
```

The setup classifier currently checks:

1. whether at least two reliable face landmarks are visible,
2. whether apparent face width is within the accepted distance range,
3. whether vertical face center is within the target band.

If any of those checks fail during the countdown, `js/app.js` starts the invalid-position timer. If the position remains invalid longer than `invalidCountdownGraceMs`, the countdown is cancelled and positioning restarts.

## 3. Required changes

### 3.1 Vertical face position

Change:

```javascript
targetBandTop: 0.08
```

to:

```javascript
targetBandTop: 0.01
```

Keep:

```javascript
targetBandBottom: 0.30
```

Result:

```text
Current: 8%  -> 30%
New:     1%  -> 30%
```

This gives the user more freedom to position their face higher in the frame.

### 3.2 Camera-distance tolerance

Change:

```javascript
minimumFaceWidth: 0.055,
maximumFaceWidth: 0.16
```

to:

```javascript
minimumFaceWidth: 0.02,
maximumFaceWidth: 0.20
```

Result:

```text
Current: 5.5% -> 16%
New:     2%   -> 20%
```

This is deliberately a broad test range. The user understands that `2%` may allow a relatively distant face and will test whether pose detection remains reliable enough in practice.

### 3.3 Continuous-invalid grace period

Change:

```javascript
invalidCountdownGraceMs: 250
```

to:

```javascript
invalidCountdownGraceMs: 1500
```

Required logic must remain continuous-time based:

```text
invalid frame(s)
    -> start invalid timer
    -> if position becomes valid again before 1500 ms
       reset invalid timer to null
    -> if position stays invalid continuously for >= 1500 ms
       cancel countdown and return to positioning
```

Do not accumulate separate short invalid periods across otherwise valid frames.

## 4. Files to modify

### `js/setup-guide.js`

Change only the agreed configuration values:

```javascript
targetBandTop: 0.01,
targetBandBottom: 0.30,
minimumFaceWidth: 0.02,
maximumFaceWidth: 0.20,
validPositionMs: 800,
invalidCountdownGraceMs: 1500,
instructionSpeechCooldownMs: 2000
```

Do not redesign the classifier in this plan.

### `tests/setup-guide.test.js`

Update and extend tests to prove the new accepted ranges.

Required coverage:

- vertical center at `0.01` is accepted when all other values are valid,
- vertical center just below `0.01` is rejected,
- vertical center at `0.30` is accepted,
- vertical center just above `0.30` is rejected,
- face width at `0.02` is accepted,
- face width just below `0.02` returns `MOVE_CLOSER_ONE_STEP`,
- face width at `0.20` is accepted,
- face width just above `0.20` returns `MOVE_BACK_ONE_STEP`.

Keep existing face-visibility tests.

### `tests/app-flow.test.js`

Add or update countdown tolerance tests.

Required cases:

1. An invalid setup result for less than 1500 ms must **not** cancel the countdown.
2. A continuously invalid result for 1499 ms must still keep the countdown alive.
3. A continuously invalid result reaching 1500 ms must cancel the countdown and return to positioning.
4. If the result becomes valid before 1500 ms, `invalidCountdownSince` must effectively reset; a later invalid period must start a fresh 1500 ms window.
5. No duplicate render loop, model initialization, or camera request should occur when countdown is cancelled.

### `tests/verify-split.ps1`

Update structural assertions so the script verifies the new intended configuration and rejects accidental reversion.

At minimum verify:

```text
targetBandTop: 0.01
targetBandBottom: 0.30
minimumFaceWidth: 0.02
maximumFaceWidth: 0.20
invalidCountdownGraceMs: 1500
```

If the script currently checks old values such as `0.08`, `0.055`, `0.16`, or `250`, replace those expected values rather than keeping contradictory checks.

## 5. Explicitly out of scope

Do not change:

- `faceConfidence: 0.35`,
- `validPositionMs: 800`,
- instruction speech cooldown,
- face landmark selection,
- median calculations,
- MoveNet model or TensorFlow versions,
- camera permission behavior,
- Reset behavior,
- model/error handling added in Plan ID 4,
- standing detector thresholds,
- Rak'ah counting logic,
- two-return counting rule,
- deployment architecture,
- Android WebView packaging.

Do not add smoothing, hysteresis, alternate landmark weighting, or coordinate-system redesign in this plan. Those can be considered later if this simpler tolerance test is not enough.

## 6. Safety / rollback

Before changing runtime code:

1. Confirm `main` and repository status.
2. Create an intentional backup point before Plan ID 5 implementation.
3. Do not include unrelated local `.tools/` content.
4. Record the exact pre-change configuration.

Recommended rollback options after real-phone testing:

### Option A — Only tighten minimum distance

Keep:

```javascript
targetBandTop: 0.01,
targetBandBottom: 0.30,
maximumFaceWidth: 0.20,
invalidCountdownGraceMs: 1500
```

but restore:

```javascript
minimumFaceWidth: 0.055
```

This gives:

```text
Distance: 5.5% -> 20%
```

### Option B — Fully restore old distance range

```javascript
minimumFaceWidth: 0.055,
maximumFaceWidth: 0.16
```

while keeping the improved vertical range and 1.5-second grace if those prove useful.

## 7. Automated verification

After implementation run the complete current test suite, including:

```text
tests/model-manager.test.js
tests/settings-manager.test.js
tests/setup-guide.test.js
tests/standing-detector.test.js
tests/app-flow.test.js
tests/https-utils.test.ps1
tests/verify-split.ps1
```

Also syntax-check all production JavaScript files.

Acceptance for automated tests:

- all tests pass,
- no standing-detector values change,
- no Rak'ah logic changes,
- no TensorFlow version changes,
- new 1500 ms continuous-invalid behavior is proven,
- new 1%-30% vertical and 2%-20% distance boundaries are proven.

## 8. Real-phone test procedure

### Test A — Vertical freedom

1. Open the deployed Racat application.
2. Start camera/setup.
3. Position the face higher than was previously accepted.
4. Confirm the app still recognizes a valid setup when face center remains within 1%-30%.

### Test B — Distance freedom

1. Try the normal current distance.
2. Step farther away until the face becomes noticeably smaller.
3. Try somewhat closer than before.
4. Confirm the wider 2%-20% range behaves naturally.
5. Pay particular attention to whether the `2%` minimum allows distances where AI landmarks become unstable.

### Test C — Small natural movement / AI noise

1. Reach a valid position and start the 5-second countdown.
2. Stand naturally without trying to become perfectly motionless.
3. Allow normal tiny head/body movement.
4. Confirm brief invalid measurements do not restart the countdown.

### Test D — Continuous wrong position

1. Start the countdown.
2. Deliberately move clearly outside an allowed position.
3. Return to valid position before 1.5 seconds.
4. Confirm countdown is not cancelled because of that short invalid period.
5. Repeat, but remain invalid continuously for at least 1.5 seconds.
6. Confirm the countdown is cancelled and positioning restarts.

### Test E — Prayer counting regression

After calibration succeeds:

1. Enter prayer tracking.
2. Perform normal prayer movement.
3. Confirm Rak'ah counting remains unchanged from before Plan ID 5.

## 9. Success criteria

Plan ID 5 is successful if:

- setup is noticeably less strict,
- tiny natural movement does not quickly restart the countdown,
- brief AI measurement noise is tolerated,
- genuinely wrong positioning held for 1.5 seconds still restarts setup,
- the wider `2% -> 20%` face-size range can be evaluated in real use,
- Rak'ah tracking remains unchanged,
- no unrelated application behavior regresses.

## 10. Final target configuration

```javascript
const SETUP_CONFIG = Object.freeze({
    faceConfidence: 0.35,
    targetBandTop: 0.01,
    targetBandBottom: 0.30,
    minimumFaceWidth: 0.02,
    maximumFaceWidth: 0.20,
    validPositionMs: 800,
    invalidCountdownGraceMs: 1500,
    instructionSpeechCooldownMs: 2000
});
```

This configuration is a **test baseline**, not a permanent commitment. Real-phone results determine whether `minimumFaceWidth` stays at `0.02` or returns to `0.055` later.