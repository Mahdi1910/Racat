# Racat Shoulder Framing and Directional Setup Guidance — Implementation Plan

> **Plan ID:** 8
>
> **Scope:** Improve initial camera positioning so Racat only accepts setup when the face and both shoulders are reliably inside the camera, add useful left/right correction instructions, change the tested bottom-face boundary to 50%, and expose the new framing values in the temporary Developer Options system from Plan 7.
>
> **Status:** Plan only. Do not change application code while creating this document.

## 1. Goal

Real-phone testing found two important setup findings:

1. **Bottom face position = 50%** works well and should become the new current testing baseline.
2. Racat can currently accept a badly framed person because setup mainly validates face landmarks. The app must not start calibration when the user's upper body is not properly visible.

The correct initial setup should require:

```text
reliable face
+
reliable left shoulder
+
reliable right shoulder
+
existing vertical face rule
+
existing face-size / distance rule
=
POSITION_CORRECT
```

Only then may Racat hold the valid-position timer, start the countdown, collect calibration samples, and enter prayer tracking.

The strict shoulder requirement is for **POSITIONING and COUNTDOWN/calibration only**. Do not require both shoulders to remain visible during prayer tracking, because Ruku and Sujud naturally move the shoulders and face and those movements are part of what Racat is trying to detect.

## 2. New testing baseline: bottom face position = 50%

Change the current known baseline from:

```text
Top face position:     1%
Bottom face position: 30%
```

to:

```text
Top face position:     1%
Bottom face position: 50%
```

This means the accepted vertical face region is 1% through 50% of the camera image.

When these values are active, the visible developer guide should also use:

```text
top: 1%
height: 49%
```

Update both:

- the permanent/fallback setup default used when no developer override exists,
- the Plan 7 Developer Options “Restore Current Defaults” baseline.

Do not change any other Plan 5/6/7 baseline value merely because Plan 8 is being implemented.

If a user has a deliberately saved Developer Options value, normal Developer Options persistence should remain authoritative. Fresh/default behavior and Restore Defaults must use 50%.

## 3. Current problem to fix

The current setup logic extracts only face landmarks for setup classification.

That can allow this bad case:

```text
person is badly framed / mostly outside camera
-> enough face-related AI information is still predicted
-> existing face checks pass
-> Racat says position is correct
-> countdown/calibration starts
```

This is incorrect for the desired real-world setup.

Racat needs enough visible upper-body context before it establishes the standing reference.

## 4. Required setup landmarks

During POSITIONING and COUNTDOWN, use these MoveNet landmarks:

### Face group
Keep the current face landmark behavior:

- nose,
- left eye,
- right eye,
- left ear,
- right ear.

Do not weaken the existing face visibility rule.

### Shoulder group
Add:

- `left_shoulder`,
- `right_shoulder`.

A shoulder counts as reliable only when:

- the keypoint exists,
- `x` is finite,
- `y` is finite,
- `score` is finite,
- score is at or above the runtime shoulder-confidence setting,
- the point is actually inside the camera frame.

At minimum, an in-frame shoulder must satisfy normalized coordinates inside the image:

```text
0 <= x / videoWidth <= 1
0 <= y / videoHeight <= 1
```

A small configurable horizontal safe margin may additionally be used so a shoulder touching the extreme edge is not treated as safely framed.

## 5. Correct-position rule

`POSITION_CORRECT` must require **all** of the following:

1. current face-visible requirement passes,
2. left shoulder is reliable and safely in frame,
3. right shoulder is reliable and safely in frame,
4. face width is within min/max distance limits,
5. face vertical center is within top/bottom limits.

If either shoulder is missing or outside the safe frame, setup is not correct.

Consequences:

- do not start the valid-position hold timer,
- do not start countdown,
- do not collect a calibration sample for that invalid frame,
- if already in COUNTDOWN, treat it as an invalid setup result and use the existing continuous invalid grace mechanism before cancelling.

Keep Plan 5 behavior:

- a brief bad frame during COUNTDOWN does not instantly cancel,
- only a continuously invalid period reaching the configured grace time cancels the countdown,
- a valid frame resets that invalid timer.

## 6. New setup result types

Add clear setup results for shoulder/framing problems. Prefer explicit results rather than overloading `FACE_NOT_VISIBLE`.

Recommended result names:

```text
SHOULDERS_NOT_VISIBLE
MOVE_LEFT
MOVE_RIGHT
```

Meaning:

### `SHOULDERS_NOT_VISIBLE`
The app cannot reliably see both shoulders and does not have enough trustworthy horizontal evidence to tell the user which direction to move.

User message:

```text
Make sure your face and both shoulders are visible.
```

### `MOVE_LEFT`
The body is clearly too far toward the opposite side of the camera and moving physically left would improve framing.

User message:

```text
Move a little to the left.
```

### `MOVE_RIGHT`
The body is clearly too far toward the opposite side and moving physically right would improve framing.

User message:

```text
Move a little to the right.
```

Keep the existing results too:

- `FACE_NOT_VISIBLE`,
- `FACE_OUTSIDE_TARGET`,
- `MOVE_BACK_ONE_STEP`,
- `MOVE_CLOSER_ONE_STEP`,
- `POSITION_CORRECT`.

## 7. Direction logic must be reliable, not guessed from one missing landmark

Do not assume that one missing shoulder always means one specific movement direction.

A shoulder can temporarily disappear because of:

- AI confidence noise,
- lighting,
- partial occlusion,
- a single bad MoveNet frame,
- being near the camera edge.

Use the available horizontal body evidence to determine whether a left/right instruction is justified.

Recommended horizontal evidence:

- both shoulder X positions when available,
- face-center X from reliable face landmarks,
- shoulder midpoint when both shoulders are visible,
- median/center of the reliable upper-body X points.

Use a broad horizontal safe zone rather than demanding perfect centering.

Example concept:

```text
body clearly too far toward one side
-> MOVE_LEFT or MOVE_RIGHT

one/both shoulders missing but horizontal direction is ambiguous
-> SHOULDERS_NOT_VISIBLE
```

Do not tell the user to move in a direction unless the current data supports that instruction.

## 8. Front-camera mirror direction must be verified explicitly

The visual phone preview is mirrored with CSS, while MoveNet/keypoint X coordinates may represent the underlying unmirrored video coordinates.

This can easily make left/right instructions accidentally reversed.

Implementation must define one helper responsible for converting a raw horizontal condition into a **physical instruction for the user**.

Required real-device verification:

```text
User physically stands too far left
-> app must say “Move right” if right is the movement needed to return into frame.

User physically stands too far right
-> app must say “Move left” if left is the movement needed to return into frame.
```

Do not hard-code the final wording/direction based only on visual intuition from the mirrored preview. Test the mapping with the real front camera.

Automated tests should separately cover raw-coordinate classification and the mirror/user-direction mapping helper.

## 9. Avoid noisy voice instructions

Do not speak “move left/right” because of one bad frame.

Add a short continuous-confirmation timer for horizontal setup guidance.

Current requested testing baseline:

```text
Horizontal guidance confirmation: 1.0 second
```

Behavior:

```text
same horizontal problem begins
-> start timer

problem disappears before 1.0 s
-> reset timer, do not speak direction

same problem remains for 1.0 s
-> show/speak direction
```

The text instruction may update immediately if useful, but spoken direction should respect this confirmation time plus the existing instruction speech cooldown so the application does not chatter continuously.

If the detected problem changes from left to right, restart the confirmation timer for the new direction.

## 10. Developer Options additions

Plan 7 is intentionally a temporary tuning system. Add the new shoulder/framing settings there so real-phone testing can find the best values.

### A. Shoulder confidence

Initial testing default:

```text
35%
```

Description in easy English:

> How sure the AI must be before Racat trusts a shoulder point during setup.

UI:

```text
Shoulder confidence
How sure the AI must be about each shoulder.
[-] 35% [+]
```

### B. Shoulder edge safety margin

Add a percentage controlling how far inside the left/right camera edge a shoulder should be before it is considered safely visible.

Use a conservative testing default, for example:

```text
2%
```

Description:

> Keeps your shoulders a little away from the edge so they are not partly cut off.

The value must be editable because real phone framing will determine the best number.

### C. Horizontal guidance confirmation

Initial testing default:

```text
1.0 second
```

Description:

> How long Racat must see the same left/right positioning problem before it speaks the direction.

UI uses seconds and 0.1-second steps.

### D. Horizontal body safe zone, only if required by the chosen classifier

If the implementation needs explicit left/right body-center limits to make directional guidance deterministic, expose them as testing percentages rather than burying magic numbers in the classifier.

Example names:

```text
Body left safe limit
Body right safe limit
```

Use a broad initial zone. Do not force precise centering.

Validation must require:

```text
left safe limit < right safe limit
```

If the classifier can reliably derive direction from shoulder edge/framing information without extra center-zone values, do not add unnecessary controls.

## 11. Keep explanations simple in Developer Options

For the new values, use short explanations suitable for phone testing.

Examples:

### Shoulder confidence
> How sure the AI must be before it trusts a shoulder.

### Shoulder edge margin
> How much empty space to keep between your shoulders and the camera edges.

### Left/right instruction delay
> How long the same side problem must continue before Racat tells you to move.

Do not use internal terms such as normalized coordinates or keypoint probability in the visible phone descriptions.

## 12. Preserve the existing Developer Options terms

Do not rename or alter the meaning of the existing Plan 7 settings unnecessarily.

In particular:

### Minimum calibration samples
Still means:
> How many good standing-position measurements Racat needs before it accepts calibration.

### Standing movement tolerance
Still means:
> How far your face may move from the calibrated standing position while Racat still considers you standing.

### Tracking face confidence
Still means:
> How sure the AI must be about face landmarks during prayer tracking before Racat uses them.

These are not part of the shoulder-framing rule and should keep their current runtime behavior.

## 13. Setup feature extraction changes

Extend `SetupGuide.extractSetupFeatures()` so the returned setup feature object contains enough information for the new classifier.

Conceptual result:

```javascript
{
    faceVisible,
    faceCenterX,
    faceCenterY,
    faceWidth,
    leftShoulderVisible,
    rightShoulderVisible,
    leftShoulderX,
    rightShoulderX,
    shoulderCenterX,
    horizontalBodyCenterX
}
```

Exact property names may differ, but the responsibilities should stay clear.

Keep calculations normalized by the real `videoWidth` / `videoHeight` used by MoveNet.

Do not mix DOM/CSS coordinates into the pure SetupGuide classifier.

## 14. Classification priority

Use a deterministic priority so Racat does not give confusing instructions.

Recommended order:

1. face truly unavailable -> `FACE_NOT_VISIBLE`,
2. body clearly off to one side -> `MOVE_LEFT` / `MOVE_RIGHT`,
3. shoulders not reliably framed but direction ambiguous -> `SHOULDERS_NOT_VISIBLE`,
4. too close -> `MOVE_BACK_ONE_STEP`,
5. too far -> `MOVE_CLOSER_ONE_STEP`,
6. face vertically outside accepted range -> `FACE_OUTSIDE_TARGET`,
7. otherwise -> `POSITION_CORRECT`.

The exact order between distance and shoulder framing may be adjusted after tests if one instruction is more actionable, but there must be one documented deterministic order.

Do not alternate messages frame-by-frame simply because multiple conditions are simultaneously wrong.

## 15. Countdown and calibration integration

Shoulder framing must remain valid during the setup/countdown phase.

During POSITIONING:

```text
invalid shoulders
-> no correct-position hold
-> no countdown
```

During COUNTDOWN:

```text
invalid shoulders for less than invalidCountdownGraceMs
-> countdown may continue

valid again
-> invalid timer resets

invalid continuously for invalidCountdownGraceMs
-> cancel countdown and return to positioning
```

Calibration samples must only be added on frames that satisfy the complete setup classifier and return `POSITION_CORRECT`.

Plan 6 remains authoritative:

- minimum sample count remains the only final calibration sufficiency check,
- calibration uses the median,
- do not restore `maximumCalibrationSpread`,
- do not restore `FACE_NOT_STABLE`.

## 16. Prayer tracking must remain unchanged

Once Racat reaches `TRACKING_PRAYER`:

- do not require left shoulder,
- do not require right shoulder,
- do not use shoulder visibility to decide standing/not-standing,
- keep the current face-based standing detector and its runtime Developer Options values,
- keep the two-return Rak'ah rule unchanged.

This prevents the new setup safety check from breaking normal Ruku/Sujud detection.

## 17. Text and voice instructions

Add Arabic and English translations for the new setup instructions.

Required concepts:

```text
Make sure your face and both shoulders are visible.
Move a little to the left.
Move a little to the right.
```

Arabic wording should be natural and short.

The text shown on-screen and the spoken instruction should use the same semantic result.

Respect:

- Quiet Mode,
- selected language,
- selected voice,
- instruction speech cooldown,
- new horizontal confirmation delay.

## 18. Visual guide

The current vertical face band already follows runtime top/bottom values from Plan 7.

Update the baseline to 1%..50%.

For shoulder framing, do not add a complicated full-body silhouette unless it provides clear testing value.

Prefer simple visual help such as:

- a subtle left/right safe boundary,
- small shoulder edge markers,
- or text telling the user both shoulders must be visible.

The UI must not falsely imply that the user's face must be exactly centered.

The main correctness rule is both shoulders safely in frame, not aesthetic centering.

## 19. Files expected to change

### `js/setup-guide.js`
- extract shoulder landmarks,
- extract face/body horizontal information,
- classify shoulder visibility/framing,
- return left/right/shoulder-specific results,
- keep current face/distance/vertical rules.

### `js/developer-settings.js`
- change bottom-face default from 30% to 50%,
- add shoulder confidence,
- add shoulder edge margin,
- add horizontal instruction confirmation,
- add horizontal safe-zone settings only if classifier requires them,
- validate and build runtime setup config.

### `js/app.js`
- map new setup results to text/voice instructions,
- manage horizontal guidance confirmation timing,
- reset side-guidance timers correctly,
- continue using the existing countdown invalid grace,
- keep prayer tracking shoulder-independent.

### `js/settings-manager.js`
- add Arabic/English setup instruction translations if normal setup messages remain owned here.

### `index.html` / `css/developer-settings.css` / `css/styles.css`
- only adjust markup/styles if needed for new Developer Options rows or simple framing hints,
- preserve mobile scrolling/touch behavior from Plan 7.

### Tests
Update/add relevant coverage in:

- `tests/setup-guide.test.js`,
- `tests/developer-settings.test.js`,
- `tests/app-flow.test.js`,
- `tests/settings-manager.test.js` if translation checks change,
- `tests/verify-split.ps1`.

`standing-detector.js` should not need algorithm changes for Plan 8.

## 20. Required automated tests

### Shoulder visibility
Prove:

- face + both reliable shoulders can pass setup,
- face visible but left shoulder missing cannot pass,
- face visible but right shoulder missing cannot pass,
- both shoulders missing cannot pass,
- shoulder below confidence threshold does not count,
- shoulder with invalid/out-of-frame coordinates does not count,
- shoulder safely inside frame does count.

### Existing setup rules
Keep proving:

- top/bottom limits work,
- min/max face width works,
- setup face confidence works,
- exact boundaries remain deterministic.

Update default bottom boundary tests from 30% to 50%.

### Direction guidance
Prove:

- clearly off-left body produces the correct corrective result,
- clearly off-right body produces the opposite result,
- ambiguous missing shoulder produces `SHOULDERS_NOT_VISIBLE` instead of a guessed direction,
- mirror/user-direction mapping is isolated and testable.

### Confirmation timing
Prove:

- same side problem below 1.0 s does not speak the direction,
- at 1.0 s it becomes eligible,
- returning to correct framing resets the timer,
- changing from left problem to right problem resets the timer,
- speech cooldown still prevents repeated chatter.

### Countdown
Prove:

- shoulder failure for less than the normal countdown invalid grace does not cancel,
- continuous shoulder failure reaching the grace threshold cancels,
- valid complete framing resets that invalid timer,
- calibration samples are added only on complete `POSITION_CORRECT` frames.

### Developer settings
Prove:

- bottom face default is 50%,
- Restore Defaults uses 50%,
- shoulder confidence converts percent -> decimal correctly,
- shoulder margin converts percent -> decimal correctly,
- horizontal delay converts seconds -> milliseconds correctly,
- invalid values are rejected,
- new values persist in the temporary developer key,
- Save & Test applies them to actual runtime setup behavior.

### Regression
Keep proving:

- Plan 6 spread rejection remains absent,
- prayer standing detector behavior remains unchanged,
- Reset behavior remains unchanged,
- Save & Test still reuses camera and MoveNet detector,
- no second render loop is created.

## 21. Real-phone test checklist

After implementation, test these cases on the actual phone front camera:

### A. Good framing
- face visible,
- both shoulders visible,
- correct distance,
- face inside 1%..50% vertical range.

Expected:

```text
POSITION_CORRECT
-> hold
-> countdown
-> calibration
-> prayer tracking
```

### B. Only one shoulder / badly off to one side
Expected:

```text
no calibration
no countdown start
left/right correction after confirmation time when direction is clear
```

### C. Direction correctness
Physically move too far to each side and verify the spoken instruction tells the movement that actually brings the body back into frame.

This test is mandatory because the preview is mirrored.

### D. Shoulder near edge
Adjust shoulder edge margin in Developer Options and determine what value reliably prevents clipped shoulders without making positioning unnecessarily strict.

### E. Brief AI dropout
Hide/lose a shoulder for less than the configured countdown invalid grace.

Expected: no immediate countdown restart.

### F. Prayer regression
After tracking starts, perform normal standing/Ruku/Sujud movement.

Expected: shoulder visibility is no longer a setup requirement and prayer counting works as before.

## 22. Explicitly out of scope

Do not use Plan 8 to implement unrelated reliability work.

Still out of scope:

- inference-loop try/catch/recovery,
- camera track-ended recovery,
- canvas resize optimization,
- general smoothing/hysteresis redesign beyond the specific horizontal guidance confirmation timer,
- full-body pose classification,
- changing the Rak'ah counting rule,
- requiring shoulders during prayer tracking,
- offline bundling of TensorFlow,
- Android packaging,
- restoring calibration spread verification.

## 23. Safety / backup procedure before implementation

Before implementing Plan 8:

1. re-read this plan completely,
2. re-read current `main` after Plan 7,
3. confirm Developer Options and Plan 6 behavior are intact,
4. create a backup branch from exact current `main`,
5. implement on an isolated branch,
6. run the full Node test suite and syntax checks,
7. run PowerShell verification when Windows is available,
8. compare the implementation branch against pre-implementation `main`,
9. advance `main` only after the diff is limited to Plan 8 work.

Suggested branches:

```text
backup-before-plan8-shoulder-framing
agent/plan8-shoulder-framing
```

## 24. Definition of done

Plan ID 8 is complete when:

- fresh/default bottom face position is 50%,
- Restore Defaults uses 50%,
- setup cannot become correct without a reliable face and both reliable shoulders,
- both shoulders must be inside the camera frame/safe margin,
- clear off-side framing gives the correct physical left/right instruction,
- ambiguous shoulder loss does not produce a guessed direction,
- left/right spoken guidance waits for the configured confirmation time,
- shoulder/framing parameters can be changed from Developer Options on the phone,
- Save & Test immediately applies those values to real setup behavior,
- countdown/calibration only use completely valid setup frames,
- shoulder requirements stop once prayer tracking begins,
- Plan 6 calibration behavior remains intact,
- existing camera/model resource reuse remains intact,
- automated tests cover the new framing and direction rules,
- real-phone mirrored-direction testing confirms the instructions are not reversed.
