# Racat Temporary Developer Tuning Controls — Implementation Plan

> **Plan ID:** 7
>
> **Scope:** Add a temporary phone-friendly Developer Options section inside Settings so the positioning, countdown, calibration, and standing-detection numbers can be changed at runtime, saved, and immediately tested without editing JavaScript or reloading/downloading the AI model.
>
> **Status:** Plan only. Do not change application code while creating this document.

## 1. Goal

The purpose of this plan is to let real-phone testing determine Racat's best detection values.

The user should be able to open Settings, expand **Developer Options**, read a short explanation for every useful numeric detection setting, change values using `-`, `+`, or direct numeric input, then press **Save & Test**.

After Save & Test, Racat must restart the prayer setup from the beginning using the new values:

```text
save developer values
-> cancel any current setup/countdown
-> reset Rak'ah counter/session state
-> keep the already-loaded MoveNet model
-> keep/reuse the existing camera stream when possible
-> rebuild/reset the lightweight standing detector with the new runtime values
-> return to POSITIONING
-> acquire the user's valid position
-> countdown
-> calibrate standing reference
-> TRACKING_PRAYER
```

This Developer Options system is intentionally temporary. Later, after real testing finds the best values, a future plan will copy those chosen values into the permanent defaults and remove the Developer Options UI, persistence, and override layer.

## 2. Core design rule: one runtime source of truth

The Developer Options must not be cosmetic.

Every displayed saved value must be the actual value used by the running application.

Do not leave some code reading `SetupGuide.SETUP_CONFIG` while other code reads developer overrides. Do not leave some standing behavior using `StandingDetection.DEFAULT_CONFIG` after the user changes a value.

Create a clear runtime configuration object derived from:

1. permanent production defaults,
2. validated temporary developer overrides.

The active setup flow and standing detector must consume that runtime configuration consistently.

The permanent defaults remain the fallback when no developer settings exist.

## 3. Temporary settings to expose

Only expose values that actually affect positioning, calibration, countdown, or standing recognition. Do not expose meaningless numeric constants merely because they are numbers.

### A. Positioning / face setup

#### Setup face confidence
Current default: **35%** (`0.35`)

Description:
> How confident the AI must be that a face landmark is real before Racat uses it during positioning.

Phone UI:
```text
Setup face confidence
How certain the AI must be about face points.
[-] 35% [+]
```

#### Top face position
Current default: **1%** (`0.01`)

Description:
> How close to the top of the camera image the accepted vertical face area begins.

#### Bottom face position
Current default: **30%** (`0.30`)

Description:
> How far down the camera image the accepted vertical face area extends.

#### Minimum face size / far-distance limit
Current default: **2%** (`0.02`)

Description:
> The smallest accepted face width. Lower values allow the user to stand farther from the camera.

#### Maximum face size / close-distance limit
Current default: **20%** (`0.20`)

Description:
> The largest accepted face width. Higher values allow the user to stand closer to the camera.

### B. Positioning timing

#### Valid-position hold time
Current default: **0.8 seconds** (`800 ms`)

Description:
> How long the position must remain correct before Racat starts the countdown.

#### Wrong-position grace time during countdown
Current default: **1.5 seconds** (`1500 ms`)

Description:
> How long positioning must remain continuously wrong before the countdown is cancelled.

A valid frame/period must continue to reset this invalid timer as it does now.

#### Voice instruction cooldown
Current default: **2.0 seconds** (`2000 ms`)

Description:
> Minimum time before Racat repeats a positioning voice instruction.

### C. Calibration / standing detection

#### Tracking face confidence
Current default: **35%** (`0.35`)

Description:
> How confident the AI must be about face landmarks when tracking standing during prayer.

Keep this separate from Setup face confidence so each stage can be tested independently.

#### Countdown start number
Current default: **5**

Description:
> The number Racat starts counting from before prayer tracking begins. Each positive step currently lasts one second.

This setting must feed the real countdown source instead of always using the static default.

#### Minimum calibration samples
Current default: **10**

Description:
> Minimum number of valid face measurements required before Racat can create the standing reference.

Plan ID 6 remains authoritative: do **not** restore `maximumCalibrationSpread` or `FACE_NOT_STABLE`.

#### Standing movement tolerance
Current default: **7%** (`0.07`)

Description:
> How far the face may move vertically away from the calibrated standing position while still being considered standing.

#### Leave-standing confirmation
Current default: **0.25 seconds** (`250 ms`)

Description:
> How long a detected movement outside the standing area must continue before Racat confirms that standing was left.

#### Missing-face confirmation
Current default: **0.40 seconds** (`400 ms`)

Description:
> How long the face may be missing before Racat treats the user as no longer standing.

#### Return-to-standing confirmation
Current default: **0.60 seconds** (`600 ms`)

Description:
> How long the face must remain back inside the standing area before Racat confirms a return to standing.

## 4. Values intentionally NOT exposed

Do not expose these in Developer Options in Plan 7:

- `calibrationDurationMs` while it remains unused by the current runtime,
- TensorFlow.js versions,
- MoveNet model URL/version,
- model cache key,
- camera permission/error codes,
- canvas point radius/colors,
- download progress constants,
- UI animation timings unrelated to AI recognition,
- Rak'ah business rule (`standReturnCount === 2`),
- camera ideal resolution unless a later real test identifies it as necessary.

If a value does not currently change runtime recognition behavior, it should not pretend to be a tunable developer option.

## 5. Phone-friendly Developer Options UI

Add a clearly separated **Developer Options (Testing)** section below the normal Settings controls.

It should visually communicate that these values are temporary testing controls, not normal end-user settings.

Each setting row should contain:

- readable name,
- one or two lines of simple explanation,
- minus button,
- editable numeric input,
- plus button,
- visible unit (`%`, `s`, or samples/count),
- current saved value.

Example:

```text
Wrong-position grace
How long your position must stay wrong before the countdown restarts.

[ - ]   [ 1.5 ] seconds   [ + ]
```

The controls must be comfortably tappable on a phone.

Use native numeric inputs where practical (`inputmode="decimal"` / numeric input) so the phone keyboard is useful.

## 6. Human-friendly units and conversion

Do not make the user edit internal decimal fractions or milliseconds.

Display:

- `0.35` as `35%`,
- `0.01` as `1%`,
- `0.20` as `20%`,
- `800 ms` as `0.8 s`,
- `1500 ms` as `1.5 s`.

Convert back to internal units only when validating/saving runtime settings.

Recommended default step sizes:

- percentages: **1 percentage point**,
- seconds: **0.1 second**,
- sample/count values: **1**.

Direct input must also be allowed so the user can type a precise value instead of repeatedly tapping `+` or `-`.

## 7. Validation and safety

The user should have broad freedom to test, but the app must reject mathematically invalid configurations rather than entering a broken state.

Required validation:

- all numbers must be finite,
- confidence percentages must be greater than 0 and at most 100,
- `top face position < bottom face position`,
- vertical percentages remain inside `0%..100%`,
- `minimum face size < maximum face size`,
- face-size percentages remain positive and reasonable numeric values,
- timing values cannot be negative,
- countdown start number must be a positive integer,
- minimum calibration samples must be a positive integer,
- standing movement tolerance must be positive.

If validation fails:

- show the error beside/above Developer Options,
- do not save invalid settings,
- do not restart the session,
- keep the user-entered values visible so they can correct them.

Do not silently clamp an obviously invalid relationship such as top >= bottom or minimum face size >= maximum face size.

## 8. Persistence

Developer tuning values should survive refresh/reopen during this testing phase so the user can test the same configuration repeatedly.

Prefer a separate temporary storage key such as:

```text
racat-developer-settings-v1
```

Do not mix these temporary tuning controls into the permanent normal settings object (`racat-settings-v1`).

This separation makes the future removal of Developer Options straightforward and prevents temporary experiments from contaminating normal user settings.

## 9. Isolate the temporary feature for easy future removal

Prefer a small dedicated module, for example:

```text
js/developer-settings.js
```

Responsibilities should include:

- developer default values derived from current production defaults,
- normalize/validate developer values,
- load/save temporary developer settings,
- convert UI percentages/seconds to runtime decimal/ms values,
- return runtime setup overrides,
- return runtime standing overrides.

Do not duplicate detection algorithms in this module.

The actual algorithms remain owned by:

- `js/setup-guide.js`,
- `js/standing-detector.js`.

This module is only the temporary configuration/persistence layer.

## 10. Runtime integration — SetupGuide

`SetupGuide.extractSetupFeatures()` and `SetupGuide.classifySetup()` already accept a config argument. Use that capability rather than monkey-patching constants.

The active app flow must pass the current runtime setup configuration into them.

Replace runtime reads such as:

```javascript
SetupGuide.SETUP_CONFIG.validPositionMs
SetupGuide.SETUP_CONFIG.invalidCountdownGraceMs
SetupGuide.SETUP_CONFIG.instructionSpeechCooldownMs
```

with the current validated runtime setup configuration.

Permanent `SetupGuide.SETUP_CONFIG` values stay as defaults/fallbacks.

## 11. Runtime integration — StandingDetection

`StandingDetection.createStandingDetector(options)` already accepts overrides.

Create the active standing detector using the current runtime standing configuration.

On **Save & Test**, reconstruct/reset only this lightweight standing-detector state with the new config. Do not recreate or redownload MoveNet.

The countdown must use the runtime `countdownFrom` value, not a hard-coded/static default.

The following must remain exactly as designed by Plan ID 6:

- insufficient samples can fail calibration,
- successful calibration uses the median,
- no calibration-spread rejection,
- no `FACE_NOT_STABLE` path.

## 12. Developer Options must be accessible during active testing

Current Settings are only opened from `MAIN_READY`. That is not sufficient for this testing workflow.

During the temporary Developer Options phase, Settings must be reachable when the app is in:

- `MAIN_READY`,
- `POSITIONING`,
- `COUNTDOWN`,
- `TRACKING_PRAYER`.

Opening Settings during an active session must:

- safely invalidate/cancel an in-progress countdown using the existing setup run ID mechanism,
- pause recognition state transitions while the Settings view is open,
- keep the camera stream alive,
- keep the MoveNet detector loaded,
- avoid creating a second render loop,
- avoid requesting camera permission again merely because Settings opened.

The current render loop may continue scheduling frames while `AppState.SETTINGS`; it must simply avoid applying positioning/prayer transitions until Save & Test or exit determines the next state.

## 13. Save & Test behavior

Add a prominent Developer Options action:

```text
Save & Test
```

### When camera/AI session is already active

Save & Test must:

1. validate values,
2. persist developer settings,
3. update current runtime setup configuration,
4. update current runtime standing configuration,
5. cancel any stale countdown run,
6. recreate/reset the lightweight standing detector using the new values,
7. reset Rak'ah count to `1`,
8. reset `standReturnCount` and `isCurrentlyDown`,
9. update the counter UI to `1`,
10. keep the existing camera stream,
11. keep the existing MoveNet detector,
12. keep one render loop only,
13. return to `POSITIONING`,
14. run the normal position -> countdown -> calibration -> tracking flow using the new values.

### When camera has not started yet

Save & Test should still save the values.

Then it may start the normal camera flow so the user can immediately test them. If camera permission is needed, use the existing camera request/error path rather than creating a second camera implementation.

If implementation complexity or browser gesture rules make automatic camera start unreliable, the safe fallback is:

```text
Save values -> return MAIN_READY -> clearly prompt user to press Start
```

But the preferred user experience is immediate testing when possible.

## 14. Back / exit behavior while testing

Settings currently have a normal Back button.

Do not accidentally restart prayer using partially edited, unsaved developer values.

Required behavior:

- unsaved edits remain only in the Settings form,
- Back without Save & Test discards/reloads unsaved developer edits from the last saved values,
- if Settings was opened from `MAIN_READY`, return to `MAIN_READY`,
- if Settings was opened during an active camera session and changes were not saved, safely return to the previous testing flow or restart positioning using the last saved runtime configuration; prefer restarting positioning because it is deterministic and avoids resuming a half-finished countdown.

Do not resume a countdown at an old number after closing Settings.

## 15. Restore Defaults

Add:

```text
Restore Current Defaults
```

This restores the current known production/test defaults from Plans 5 and 6:

### Setup
- setup face confidence: 35%,
- top face position: 1%,
- bottom face position: 30%,
- minimum face size: 2%,
- maximum face size: 20%,
- valid-position hold: 0.8 s,
- wrong-position grace: 1.5 s,
- voice cooldown: 2.0 s.

### Standing
- tracking face confidence: 35%,
- countdown start: 5,
- minimum calibration samples: 10,
- standing tolerance: 7%,
- leave-standing confirmation: 0.25 s,
- missing-face confirmation: 0.40 s,
- return-to-standing confirmation: 0.60 s.

Restore Defaults should update the form first. The user then presses Save & Test to apply it, or the button may explicitly be named `Restore Defaults & Test` if implementation chooses immediate application. Keep behavior unambiguous.

## 16. Make the visible face guide follow the runtime vertical values

The current detection rule accepts `1%..30%`, but CSS still draws the face band at `8%..30%`.

Plan 7 should remove this mismatch as part of making the values genuinely testable.

When runtime values are:

```text
top = 1%
bottom = 30%
```

render the visible vertical guide using:

```text
top: 1%
height: 29%
```

If the developer changes them to:

```text
top = 5%
bottom = 35%
```

the visible guide must become:

```text
top: 5%
height: 30%
```

Prefer CSS custom properties or explicit style updates from the validated runtime configuration.

Do **not** add horizontal face-centering validation. The current algorithm intentionally does not require the face to be centered left/right.

The visual UI should therefore communicate a **vertical allowed band**, not falsely imply that horizontal centering is required.

Note: full raw-video/object-fit coordinate remapping is a separate reliability concern. Plan 7 should at minimum make the configured visual percentages and configured detection percentages share the same source of truth. If actual camera letterboxing makes them geometrically different, document it for a later dedicated camera-coordinate plan rather than hiding it.

## 17. Files expected to change

### `index.html`
- load temporary developer-settings module before `app.js`,
- add Developer Options section markup,
- add Save & Test / Restore Defaults controls,
- ensure controls are usable on mobile.

### `css/styles.css`
- style developer sections and compact numeric steppers,
- large touch targets,
- validation/error presentation,
- dynamic vertical guide using runtime values,
- preserve current visual design.

### `js/developer-settings.js` (new, preferred)
- temporary developer defaults,
- persistence,
- normalization,
- validation,
- UI/runtime unit conversion,
- setup/standing config builders.

### `js/app.js`
- maintain current runtime developer settings/config,
- render Developer Options form,
- handle minus/plus/direct input,
- allow Settings during active testing,
- implement Save & Test,
- rebuild standing-detector state with new config,
- feed runtime config into SetupGuide and StandingDetection,
- dynamically update face guide,
- safely restart positioning without model/camera recreation.

### `js/settings-manager.js`
- only add translated Developer Options labels/descriptions if translations remain owned here,
- do not merge temporary developer values into normal `racat-settings-v1` persistence.

### Tests
Update/add:
- `tests/settings-manager.test.js` if translation coverage changes,
- new `tests/developer-settings.test.js` for validation/conversion/persistence,
- `tests/setup-guide.test.js` as needed for runtime config overrides,
- `tests/standing-detector.test.js` as needed for runtime override proof,
- `tests/app-flow.test.js` for Save & Test behavior,
- `tests/verify-split.ps1` for module loading and structural guarantees.

## 18. Required tests

### Developer settings module
Test:

- defaults match current Plan 5/6 values,
- percentage conversions are correct,
- seconds <-> milliseconds conversion is correct,
- storage load/save works,
- malformed storage falls back safely,
- invalid numeric values are rejected,
- top >= bottom is rejected,
- minimum face size >= maximum face size is rejected,
- integer-only controls reject fractional invalid values where appropriate.

### Runtime setup integration
Test changing at least:

- top/bottom face limits,
- min/max face width,
- setup confidence,
- valid-position hold time,
- invalid-countdown grace.

Prove behavior changes without changing source constants.

### Runtime standing integration
Test changing at least:

- tracking face confidence,
- countdown start,
- minimum calibration samples,
- standing-zone tolerance,
- leave/return/missing confirmation timings.

### Save & Test
Prove:

1. active settings are saved,
2. current countdown is invalidated,
3. Rak'ah count resets to 1,
4. partial return progress clears,
5. standing detector uses new config,
6. app returns to POSITIONING,
7. camera stream object is unchanged,
8. MoveNet detector object is unchanged,
9. model manager is not recreated,
10. no second render loop is created,
11. new countdown uses the edited countdown value,
12. new positioning uses edited timing/percentage values.

### Restore defaults
Prove all temporary values return to the known Plan 5/6 defaults.

### Plan 6 regression
Keep proving:

- spread alone cannot fail calibration,
- `maximumCalibrationSpread` remains absent,
- `FACE_NOT_STABLE` remains absent.

## 19. Automated verification

Run the full Node suite after implementation, including the new developer-settings tests.

Run syntax checks for all production JS files.

When Windows is available, also run:

```text
tests/https-utils.test.ps1
tests/verify-split.ps1
```

Do not consider this implementation complete if temporary settings merely render correctly but do not alter real runtime detection.

## 20. Real-phone test workflow

The expected phone workflow after Plan 7 is:

```text
Open Racat
-> Start camera
-> test current behavior
-> open Settings
-> Developer Options
-> change one or more values using +/- or typing
-> Save & Test
-> Racat resets to Rak'ah 1
-> positioning begins again immediately
-> countdown runs
-> prayer tracking begins with the new values
-> repeat until the best configuration is found
```

The user should be able to repeat this many times without:

- refreshing the page,
- redownloading the model,
- reopening camera permission every time,
- editing source code,
- creating multiple camera streams,
- creating multiple inference loops.

## 21. Explicitly out of scope

Do not use Plan 7 to also implement unrelated reliability work.

Out of scope:

- inference-loop try/catch/recovery,
- camera-track-ended recovery,
- canvas resize/performance optimization,
- new pose landmarks,
- smoothing/hysteresis algorithms,
- horizontal face centering,
- changing the two-return Rak'ah rule,
- bundling TensorFlow dependencies offline,
- Android/WebView packaging,
- restoring calibration spread verification.

Those can be separate implementation plans after the tuning phase.

## 22. Safety / backup procedure before implementation

Before implementing Plan 7:

1. re-read this plan completely,
2. re-read current `main` versions of Settings, SetupGuide, StandingDetection, app flow, HTML/CSS, and related tests,
3. verify no unrelated changes appeared on `main`,
4. create a backup branch from exact current `main`,
5. implement on an isolated branch,
6. run tests before moving `main`,
7. confirm the final diff contains only Developer Options/runtime-config work.

Suggested branches:

```text
backup-before-plan7-developer-tuning
agent/plan7-developer-tuning
```

## 23. Future removal requirement

This temporary feature must be designed so a later request such as:

> Remove Developer Options and permanently use these final values.

is straightforward.

That future cleanup should be able to:

1. copy the chosen values into permanent defaults,
2. remove Developer Options markup/styles,
3. remove `developer-settings.js`,
4. remove `racat-developer-settings-v1`,
5. remove runtime override wiring,
6. leave the actual setup/standing algorithms unchanged.

Avoid architecture that makes the temporary testing UI permanently entangled with core recognition logic.

## 24. Definition of done

Plan ID 7 is complete when:

- Developer Options exists inside Settings,
- it is practical to use on a phone,
- each useful numeric detection setting has a simple description,
- values can be changed with `-`, `+`, or direct entry,
- values are displayed in percentages/seconds rather than internal decimals/ms,
- invalid configurations cannot be applied,
- temporary values persist separately from normal settings,
- all active detection logic uses the current runtime values,
- Settings can be used during active testing,
- Save & Test resets the session and positioning while reusing camera/model resources,
- the visible vertical face guide follows the runtime top/bottom values,
- Plan 5 and Plan 6 behavior remains the default when Developer Options are restored,
- no calibration-spread rejection returns,
- tests prove runtime values really change behavior,
- the temporary system is isolated enough to remove cleanly after the best values are found.
