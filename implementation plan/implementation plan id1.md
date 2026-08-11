# Standing Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed nose-height logic with a personal standing-position detector that calibrates after a spoken 5-to-0 countdown and does not mistake sitting between the two Sujud for standing.

**Architecture:** Keep the application focused on one question: “Is the user standing?” The application will remember the user’s face position while standing, report every lower, missing, or uncertain face position as not standing, and report standing again only after the face returns to the saved standing area for several frames.

**Tech Stack:** HTML, CSS, browser JavaScript, TensorFlow.js, MoveNet

## Global Constraints

- Do not calculate chest, stomach, legs, or ankle positions.
- Do not try to identify every prayer position.
- Do not directly classify Ruku, Sujud, or sitting.
- Use only face landmarks supplied by MoveNet: nose, eyes, and ears.
- Preserve the current camera, counter, Arabic speech, reset button, and interface.
- Do not count from one camera frame.
- Sitting between the two Sujud must remain `NOT_STANDING`.
- Keep all adjustable numbers together in one configuration object.

---

## 1. Required behavior

The final movement flow will be:

`START -> COUNTDOWN -> FACE CALIBRATION -> STANDING -> NOT_STANDING -> STANDING`

The application does not need to know exactly why the user is not standing. Ruku, Sujud, sitting, a low face, and an invisible face all remain `NOT_STANDING` until the real standing face position returns.

This prevents sitting between the two Sujud from being treated as standing.

## 2. Start and countdown

After the camera and MoveNet model are ready:

1. Start the camera-processing loop.
2. Show the number `5` and speak “خمسة”.
3. Continue with `4`, `3`, `2`, `1`, and `0`, one number each second.
4. During the countdown, do not count prayer movement.
5. After `0`, show an Arabic message asking the user to remain standing and face the camera.
6. Begin face calibration only when a reliable face is visible.

The countdown must never create a standing or not-standing event.

## 3. Face position

For every camera frame, read these MoveNet points when their confidence is high enough:

- `nose`
- `left_eye`
- `right_eye`
- `left_ear`
- `right_ear`

Calculate one face height value from the median vertical position of the reliable points. Normalize the value using the camera height:

```javascript
faceY = median(visibleFacePoints.map(point => point.y)) / video.videoHeight;
```

This is still simple face detection, but it no longer depends on only the nose.

MoveNet does not provide a point for the exact top of the head. No separate top-of-head model is required for this plan. If the face disappears while the person is down, the application keeps the user in `NOT_STANDING` until the calibrated standing face returns.

## 4. Personal standing calibration

After the countdown:

1. Collect reliable face positions for approximately one second.
2. Require at least 10 reliable samples.
3. Reject the calibration if the face is moving too much.
4. Calculate the median of the samples.
5. Save it as `standingFaceY`.
6. Create a small standing area around that saved value.
7. Set the first confirmed state to `STANDING` without changing the Rak’ah counter.
8. Speak an Arabic ready message.

If the face is not visible or is unstable, continue waiting. Never save a bad position.

Initial configuration values:

```javascript
const STANDING_CONFIG = {
    faceConfidence: 0.35,
    countdownFrom: 5,
    calibrationDurationMs: 1000,
    minimumCalibrationSamples: 10,
    maximumCalibrationSpread: 0.04,
    standingZoneRadius: 0.07,
    leaveStandingConfirmMs: 250,
    missingFaceConfirmMs: 400,
    returnToStandingConfirmMs: 600
};
```

These values are starting points and must be adjusted using real camera testing.

## 5. Standing decision

Use only three internal states:

```javascript
const StandingState = {
    UNCALIBRATED: 'UNCALIBRATED',
    STANDING: 'STANDING',
    NOT_STANDING: 'NOT_STANDING'
};
```

The face is inside the standing area when:

```javascript
Math.abs(faceY - standingFaceY) <= STANDING_CONFIG.standingZoneRadius
```

Rules:

- A face inside the saved area for 600 ms confirms `STANDING`.
- A visible face below or outside the saved area for 250 ms confirms `NOT_STANDING`.
- A missing face for 400 ms confirms `NOT_STANDING`.
- One bad frame must not change the state.
- While the face is missing, the state must never return to `STANDING`.
- A sitting face below the calibrated standing area must remain `NOT_STANDING`.
- Returning to standing must be confirmed only when the face is back inside the personal standing area for 600 ms.

## 6. Counter connection

Keep the current rule of two returns to standing for one completed Rak’ah, but feed it confirmed standing transitions instead of raw nose zones.

```javascript
STANDING -> NOT_STANDING
```

sets the existing down/movement flag.

```javascript
NOT_STANDING -> STANDING
```

records one confirmed return.

Expected prayer behavior:

1. Standing to Ruku: `NOT_STANDING`.
2. Return from Ruku: first confirmed return to `STANDING`.
3. Going to Sujud: `NOT_STANDING`.
4. Sitting between the two Sujud: stays `NOT_STANDING` because the face is below the saved standing area.
5. Second Sujud: stays `NOT_STANDING`.
6. Final return to real standing: second confirmed return, so the Rak’ah number increases once.

## 7. Missing-face behavior

The missing face is important but it is not direct proof of Sujud.

- If the face disappears briefly, wait 400 ms before changing state.
- If the user was standing and the face remains missing, change to `NOT_STANDING`.
- If already `NOT_STANDING`, remain there while the face is missing.
- Do not increase the counter when the face disappears.
- Increase a return count only when the face becomes visible again inside the calibrated standing area for 600 ms.

## 8. Reset behavior

Reset must clear:

- Rak’ah number
- Return count
- Current standing state
- Saved `standingFaceY`
- Calibration samples
- Candidate state and confirmation timers

After reset, run the spoken 5-to-0 countdown and standing calibration again.

## 9. Planned file changes

### Task 1: Add testable standing detector

**Files:**
- Create: `standing-detector.js`
- Create: `tests/standing-detector.test.js`
- Modify: `index.html`

- [ ] Write tests for face-point filtering and median face position.
- [ ] Write tests for successful and rejected calibration.
- [ ] Write tests proving that one missing frame does not leave standing.
- [ ] Write tests proving that a lower sitting face is not standing.
- [ ] Write tests proving that an invisible face stays not standing.
- [ ] Write tests proving that only a stable return to the saved face area becomes standing.
- [ ] Run the tests and confirm they fail before creating the detector.
- [ ] Implement the three-state standing detector.
- [ ] Load `standing-detector.js` before `app.js` in `index.html`.
- [ ] Run the tests and confirm they pass.

### Task 2: Add spoken countdown and calibration

**Files:**
- Modify: `app.js`
- Modify: `tests/standing-detector.test.js`

- [ ] Write a test requiring countdown values in the exact order `5, 4, 3, 2, 1, 0`.
- [ ] Confirm the countdown test fails.
- [ ] Add an asynchronous countdown that updates the status and speaks every value.
- [ ] Start calibration only after zero is spoken.
- [ ] Keep collecting samples until the face is visible and stable.
- [ ] Confirm calibration itself does not change the Rak’ah number.
- [ ] Run all tests.

### Task 3: Replace nose-zone processing

**Files:**
- Modify: `app.js`
- Modify: `tests/verify-split.ps1`

- [ ] Remove the fixed `noseY_ratio < 0.35` standing rule.
- [ ] Remove the fixed `noseY_ratio > 0.60` down rule.
- [ ] Pass face observations into the new standing detector on every frame.
- [ ] Pass a missing-face observation when no pose or reliable face point exists.
- [ ] Update the screen only from confirmed standing state changes.
- [ ] Connect confirmed transitions to the existing return counter.
- [ ] Update the structural regression check for the new detector script.
- [ ] Run all automated checks.

### Task 4: Update reset and messages

**Files:**
- Modify: `app.js`

- [ ] Reset all calibration and standing-state information.
- [ ] Restart the countdown after reset.
- [ ] Add clear Arabic messages for countdown, waiting for face, calibrating, standing, and not standing.
- [ ] Ensure speech happens once per confirmed event, not once per frame.

### Task 5: Real camera verification

**Files:**
- No new files required.

- [ ] Start with the user standing and confirm the 5-to-0 speech.
- [ ] Confirm calibration waits when the face is missing.
- [ ] Confirm normal standing is stable and does not create repeated events.
- [ ] Perform Ruku and confirm the state becomes not standing.
- [ ] Return from Ruku and confirm one return is recorded.
- [ ] Perform both Sujud movements and sit between them.
- [ ] Confirm sitting is never reported as standing.
- [ ] Return to full standing and confirm the Rak’ah increases exactly once.
- [ ] Briefly cover the camera and confirm no false return is counted.
- [ ] Test closer and farther camera positions by recalibrating each time.

## 10. Acceptance criteria

The implementation is complete only when:

- The application speaks `5` through `0` before calibration.
- Calibration uses the user’s real standing face position.
- More than one face landmark can contribute when visible.
- The application no longer uses fixed top/middle/bottom nose zones.
- A missing face is never treated as standing.
- A sitting face is never treated as standing.
- Sitting between the two Sujud does not create a return event.
- Only a stable face inside the saved personal area confirms standing.
- One Rak’ah is added exactly once after the expected two real returns to standing.
- No chest, stomach, leg, or ankle calculation is added.

## 11. Important limitation

This design detects standing versus not standing. It does not prove that a missing face means Sujud, and it does not identify the exact top of the head. That is intentional: the counter only needs a reliable return to the personally calibrated standing position, while all lower prayer positions remain not standing.
