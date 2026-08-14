# Racat Calibration Spread Rejection Removal — Implementation Plan

> **Plan ID:** 6
>
> **Scope:** Safely remove the final calibration-spread rejection that can cause the first countdown to restart after reaching the end, while preserving the rest of Racat's calibration process and all earlier positioning protections.
>
> **Status:** Plan only. Do not change application code as part of creating this document.

## 1. Goal

The current setup flow can complete the visible countdown and then reject the calibration because the collected face-position samples vary by more than a fixed spread threshold. This can make the user experience look like:

```text
5 -> 4 -> 3 -> 2 -> 1
-> restart positioning
-> second countdown
-> success
```

The likely cause is the final calibration stability check in `js/standing-detector.js`, not the 1.5-second continuous-invalid positioning rule introduced in Plan ID 5.

The goal of this plan is to remove only that final spread-based rejection while keeping calibration itself intact.

After this change, Racat should still:

- require valid positioning before countdown,
- require continuously valid setup or tolerate only the configured 1.5-second invalid grace,
- collect standing-face samples during setup/countdown,
- require enough calibration samples,
- compute the standing reference from the median of the collected samples,
- enter tracking using that standing reference.

But Racat should no longer reject the entire calibration only because:

```text
max(sample) - min(sample) > maximumCalibrationSpread
```

## 2. Current root cause

The relevant configuration currently lives in `js/standing-detector.js`:

```javascript
const DEFAULT_CONFIG = Object.freeze({
    faceConfidence: 0.35,
    countdownFrom: 5,
    calibrationDurationMs: 1000,
    minimumCalibrationSamples: 10,
    maximumCalibrationSpread: 0.04,
    standingZoneRadius: 0.07,
    leaveStandingConfirmMs: 250,
    missingFaceConfirmMs: 400,
    returnToStandingConfirmMs: 600
});
```

`finishCalibration()` currently performs two rejection checks:

1. not enough samples,
2. sample spread exceeds `maximumCalibrationSpread`.

The current spread rejection is effectively:

```javascript
const lowest = Math.min(...calibrationSamples);
const highest = Math.max(...calibrationSamples);
if (highest - lowest > config.maximumCalibrationSpread) {
    return { ok: false, reason: 'FACE_NOT_STABLE' };
}
```

This means one or a few noisy MoveNet measurements can make the whole calibration fail even after the user successfully passed the setup rules and countdown.

## 3. Required behavior after implementation

The target `finishCalibration()` behavior should be:

```text
if sample count is below minimum
    -> fail with NOT_ENOUGH_SAMPLES

otherwise
    -> standingFaceY = median(calibrationSamples)
    -> state = STANDING
    -> clear pending candidate transition state
    -> return success
```

The final spread-based `FACE_NOT_STABLE` rejection should no longer exist.

This plan does **not** remove calibration.

The median calculation remains important because it gives Racat a stable standing reference while naturally reducing the effect of individual noisy samples.

## 4. Files to modify

### `js/standing-detector.js`

Modify `finishCalibration()` only as needed to remove the spread-based rejection.

Required changes:

- remove the `Math.min(...calibrationSamples)` / `Math.max(...calibrationSamples)` spread rejection block,
- remove or stop using `maximumCalibrationSpread` if it has no other purpose,
- preserve the `minimumCalibrationSamples` requirement,
- preserve median-based `standingFaceY`,
- preserve transition to `StandingState.STANDING`,
- preserve candidate-state cleanup.

Preferred final behavior:

```javascript
function finishCalibration() {
    if (calibrationSamples.length < config.minimumCalibrationSamples) {
        return { ok: false, reason: 'NOT_ENOUGH_SAMPLES' };
    }

    standingFaceY = median(calibrationSamples);
    state = StandingState.STANDING;
    clearCandidate();
    return { ok: true, standingFaceY };
}
```

If `maximumCalibrationSpread` becomes unused after this change, remove it from `DEFAULT_CONFIG` rather than leaving a dead configuration value that suggests the check still exists.

### `tests/standing-detector.test.js`

Update the calibration tests to reflect the new intended behavior.

Required coverage:

1. fewer than `minimumCalibrationSamples` still fails with `NOT_ENOUGH_SAMPLES`,
2. enough stable samples succeed,
3. enough widely spread samples now also succeed,
4. successful calibration still uses the median sample as `standingFaceY`,
5. successful calibration sets detector state to `STANDING`,
6. reset still clears the calibration completely.

Any old test expecting:

```text
FACE_NOT_STABLE
```

must be removed or replaced with a test proving that spread no longer causes failure.

### `tests/app-flow.test.js`

Add or update an integration-style test proving the user-facing symptom is removed.

Required scenario:

```text
POSITIONING
-> valid setup
-> countdown 5 -> 4 -> 3 -> 2 -> 1 -> 0
-> collected calibration samples include noticeable variation
-> finishCalibration succeeds
-> application enters TRACKING_PRAYER
```

The test should prove there is no automatic restart merely because the calibration samples have a spread larger than the old `0.04` threshold.

Keep the existing Plan ID 5 countdown-invalid tests intact.

### `tests/verify-split.ps1`

Update structural checks to match the new design.

Required structural verification:

- `minimumCalibrationSamples: 10` remains,
- `standingZoneRadius: 0.07` remains,
- leave/missing/return timing values remain,
- `maximumCalibrationSpread` is absent if removed from production code,
- `FACE_NOT_STABLE` is absent from `js/standing-detector.js` if no longer used,
- median-based calibration remains present.

Do not weaken unrelated safeguards.

## 5. Explicitly out of scope

Do not change:

- Plan ID 5 positioning ranges:
  - `targetBandTop: 0.01`,
  - `targetBandBottom: 0.30`,
  - `minimumFaceWidth: 0.02`,
  - `maximumFaceWidth: 0.20`,
  - `invalidCountdownGraceMs: 1500`,
- `faceConfidence: 0.35`,
- `minimumCalibrationSamples: 10`,
- standing-zone radius,
- leave-standing confirmation timing,
- missing-face confirmation timing,
- return-to-standing confirmation timing,
- two-return Rak'ah counting rule,
- Reset behavior,
- camera behavior,
- error handling,
- TensorFlow or MoveNet versions,
- model caching,
- speech behavior,
- Android WebView packaging.

Do not add smoothing, hysteresis, weighted landmarks, or a new calibration algorithm in this plan.

## 6. Safety / backup procedure

Before implementation:

1. Read this Plan ID 6 completely.
2. Re-read the current versions of:
   - `js/standing-detector.js`,
   - `js/app.js` around `beginCountdown()` / `finishCalibration()`,
   - `tests/standing-detector.test.js`,
   - `tests/app-flow.test.js`,
   - `tests/verify-split.ps1`.
3. Confirm GitHub `main` is understood and no unrelated changes have appeared.
4. Create a backup point before runtime changes.
5. Implement on an isolated branch first.
6. Do not modify unrelated files.

Suggested backup branch:

```text
backup-before-plan6-remove-calibration-spread
```

Suggested implementation branch:

```text
agent/plan6-remove-calibration-spread
```

## 7. Automated verification

Run the complete current Node test suite after implementation:

```text
tests/model-manager.test.js
tests/settings-manager.test.js
tests/setup-guide.test.js
tests/standing-detector.test.js
tests/app-flow.test.js
```

Run production JavaScript syntax checks.

When Windows is available, also run:

```text
tests/https-utils.test.ps1
tests/verify-split.ps1
```

Acceptance requirements:

- all existing unrelated tests remain green,
- not-enough-samples calibration still fails,
- spread alone can no longer fail calibration,
- median standing reference is still created,
- app enters tracking after the first successful countdown even with sample variation,
- Plan ID 5 positioning tolerance remains unchanged,
- Rak'ah counting behavior remains unchanged.

## 8. Real-phone verification

This plan is specifically intended to address the observed first-countdown restart.

Manual test:

1. Open the deployed Racat application fresh.
2. Start the camera.
3. Reach valid positioning.
4. Allow the first countdown to run completely.
5. Stand naturally; do not deliberately freeze your head.
6. Confirm the app enters prayer tracking after the first countdown instead of restarting solely at the end.
7. Repeat the test several times from a fresh app open.
8. Confirm the previous 70-80% first-countdown restart behavior is gone or greatly reduced.
9. Confirm a genuinely invalid position held continuously for 1.5 seconds can still cancel the countdown through the separate setup rule.
10. Confirm normal Rak'ah counting still works after tracking begins.

## 9. Rollback plan

If removing the spread rejection creates a real tracking-quality problem, restore the backup branch or reintroduce a better final-quality check in a future plan.

Do not automatically restore the old `0.04` spread rule without reviewing the real-phone results first.

Possible future alternatives, only if needed later:

- ignore a small number of outlier samples,
- use percentile spread instead of full min/max spread,
- collect calibration only during a controlled subsection of the countdown,
- use median absolute deviation.

These alternatives are intentionally **not** part of Plan ID 6.

## 10. Definition of done

Plan ID 6 is complete when:

- final calibration no longer rejects based on `maximumCalibrationSpread`,
- `FACE_NOT_STABLE` is removed from this calibration path,
- insufficient samples are still rejected,
- median calibration remains,
- existing setup protections remain,
- tests prove a varied-but-valid calibration succeeds,
- the first countdown can transition directly to tracking without the unnecessary final spread verification,
- no unrelated application behavior changes.
