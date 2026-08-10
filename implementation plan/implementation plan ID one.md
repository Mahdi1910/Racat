# Implementation Plan ID One

## Goal
Upgrade the Rak'ah Counter from a simple nose-height detector into a small but reliable prayer-state system.

The new logic must work in both situations:
- Phone on the ground, where most of the body stays visible.
- Phone on a table or higher place, where the body may disappear during sujud.

Do not change the basic technology unless necessary. Keep the current browser camera + TensorFlow.js + MoveNet approach.

## Current Problem
The current app mainly checks only the nose Y position:
- Nose high = standing.
- Nose low = down.
- Two down-to-standing returns = one Rak'ah.

This is too weak because one body point can move for many reasons, and during sujud the whole person can disappear from the camera.

## Main New Idea
Replace the current simple counter with a state machine that understands the expected prayer sequence.

The app should combine:
1. Multiple body landmarks.
2. Torso/body angle.
3. Vertical movement direction.
4. How much of the body is visible.
5. Whether the person disappears downward.
6. Stable detection across multiple frames.
7. The expected next prayer state.
8. Timing only as a fallback, never as the main detector.

## State Machine
Use clear internal states instead of directly increasing the counter from raw movement.

Recommended states:
- `WAITING_FOR_STANDING`
- `STANDING`
- `RUKU`
- `STANDING_AFTER_RUKU`
- `GOING_TO_SUJUD`
- `SUJUD_1`
- `SITTING_BETWEEN_SUJUD`
- `SUJUD_2`
- `RETURNING_TO_STANDING`

Normal sequence:

`STANDING -> RUKU -> STANDING_AFTER_RUKU -> SUJUD_1 -> SITTING_BETWEEN_SUJUD -> SUJUD_2 -> STANDING`

Only when this sequence is completed should the Rak'ah number increase.

The state machine must reject impossible jumps. For example:
- `STANDING -> SUJUD_2` must not count.
- Random body loss while standing must not count as sujud.
- Ruku should only be accepted when the current expected state allows ruku.

## Step 1 - Startup Calibration
When the user starts the app, do not immediately count movements.

First detect a stable standing pose for about 1-2 seconds.
Use this period to calculate a personal baseline:
- Normal shoulder height.
- Normal hip height.
- Normal torso length.
- Normal body center position.
- Typical number of visible landmarks.
- Approximate standing torso angle.

This makes the system relative to the user's camera setup instead of using only fixed screen percentages.

## Step 2 - Build a Pose Feature Layer
Do not let the state machine read raw MoveNet points directly.
Create one function that converts every frame into simple features.

Calculate at least:
- `visibleKeypointCount`
- `bodyVisibilityRatio`
- `shoulderCenterY`
- `hipCenterY`
- `kneeCenterY` when available
- `bodyCenterY`
- `torsoAngle`
- `verticalVelocity`
- `horizontalVelocity`
- `isMostlyVertical`
- `isBentForward`
- `isMovingDown`
- `isMovingUp`

Use left and right landmarks together when possible.
If one side has low confidence, use the reliable side instead of failing the whole frame.

Normalize positions using video width/height or the calibrated body size so different phones and distances behave more consistently.

## Step 3 - Reliable Standing Detection
Standing should use several signals together.

Accept `STANDING` only when most of these are true:
- Head/shoulders are visible.
- Hips are visible when the camera setup allows it.
- Torso is close to vertical.
- Body center is near the calibrated standing area.
- Vertical movement is small.
- Pose remains stable for several consecutive frames.

Do not accept standing from one frame.
Require a short confirmation window, for example about 400-700 ms.

This replaces the old rule `noseY < 0.35`.

## Step 4 - Ruku Detection
Detect ruku from body shape, not only body height.

Strong ruku signals:
- Shoulders move downward from standing baseline.
- Torso bends forward significantly.
- Hip position stays relatively higher than shoulders.
- Pose becomes stable briefly in the bent position.

Require the app to already be in `STANDING` before accepting `RUKU`.

## Step 5 - Standing After Ruku
After `RUKU`, wait for the torso to become vertical again.

Accept `STANDING_AFTER_RUKU` when:
- Torso returns near the standing angle.
- Shoulders rise toward the standing baseline.
- Body is stable for a short confirmation period.

This state is important because it tells the app that the next strong downward movement should be sujud, not another ruku.

## Step 6 - Detect Going Down Toward Sujud
Create a transition state: `GOING_TO_SUJUD`.

Enter it only after `STANDING_AFTER_RUKU` when the app sees:
- Body center moving downward for several frames.
- Shoulders and/or hips moving downward.
- Visibility beginning to decrease, or body moving toward the bottom edge.

Store a short movement history before visibility is lost.
This history is critical because disappearance alone must never mean sujud.

## Step 7 - Sujud Detection When Body Is Visible
If the phone is on the ground and the body stays visible, detect sujud normally.

Useful signals:
- Head and shoulders are very low in the frame.
- Hips and upper body are also low.
- Torso/body shape is clearly different from standing and ruku.
- Downward movement has ended and the pose is stable.

When these signals are strong and the expected state is sujud, accept `SUJUD_1` or `SUJUD_2`.

## Step 8 - Sujud Detection When Body Disappears
This is the special logic for a phone placed on a table or higher surface.

Treat body disappearance as sujud only when all important conditions agree:
- Previous valid state was `STANDING_AFTER_RUKU` or `SITTING_BETWEEN_SUJUD`.
- The body was clearly moving downward before disappearing.
- Visible landmark count decreases over consecutive frames.
- Last reliable body position was moving toward the bottom of the frame.
- The person remains mostly invisible for a minimum short duration.

If these conditions are true, classify the disappearance as a sujud event instead of an AI tracking failure.

## Step 9 - Sitting Between the Two Sujud
When the user rises from first sujud, detect `SITTING_BETWEEN_SUJUD` if enough body becomes visible.

Useful signals:
- Head/shoulders rise from the sujud position.
- Body is still much lower than normal standing.
- Torso becomes more upright.
- The pose stays briefly stable.

If the camera is high and sitting remains completely outside the frame, visual confirmation may be impossible.
In that case, do not invent a sitting pose from no data.
Use a cautious fallback state such as `SUJUD_1_HIDDEN` and wait for evidence of another movement or final return.

## Step 10 - Second Sujud
From `SITTING_BETWEEN_SUJUD`, detect another clear downward movement.

If the body remains visible, use the same visible-sujud features.
If the body disappears again, use the downward-disappearance rule.

Only then accept `SUJUD_2`.
Do not count two sujud events from continuous invisibility without new movement evidence.

## Step 11 - Completely Hidden Sujud Cycle Fallback
There is one unavoidable camera limitation: the user may disappear for first sujud, remain invisible while sitting, perform second sujud, and only become visible when standing again.

The camera cannot truly see the hidden sitting and second sujud.
Handle this explicitly instead of pretending the AI detected them.

Recommended fallback:
- Only allow it after a fully confirmed `STANDING -> RUKU -> STANDING_AFTER_RUKU -> downward disappearance` sequence.
- Record the start time of the hidden period.
- Require the hidden period to last longer than a conservative minimum duration.
- Require the user to return from the bottom area into a stable standing pose.
- Require no evidence that the user walked sideways or left the scene in another direction.
- Then infer that the hidden sujud cycle probably completed and finish the Rak'ah with lower internal confidence.

Timing values must be constants that can be tuned after real testing; do not hard-code assumptions throughout the logic.

If confidence is too low, do not increment the Rak'ah. Show a status such as "movement unclear" and wait for recovery/reset.

## Step 12 - Frame Smoothing and Stability
Never change states because of one frame.

Maintain a short rolling history, for example the latest 8-15 pose results.
Use it to calculate:
- Average landmark positions.
- Average torso angle.
- Movement direction.
- Visibility trend.
- Number of consecutive frames supporting the same pose.

Require a state candidate to stay valid for a minimum time before committing it.
Use different confirmation times for different states if needed.

This prevents camera noise, one bad MoveNet frame, or a quick body movement from creating false counts.

## Step 13 - Confidence Rules
Give every frame/state candidate a simple confidence score.

Example inputs:
- Landmark confidence.
- Number of useful landmarks visible.
- Agreement between torso angle and movement direction.
- Agreement with the expected next state.
- Stability across recent frames.

Only commit a state when confidence passes a configurable threshold.

## Step 14 - False Positive Protection
Add rules specifically to stop common mistakes.

Do not treat disappearance as sujud when:
- The previous state was not correct.
- The person moved sideways out of frame.
- There was no clear downward movement first.
- Tracking was lost for only a few bad frames.
- The body suddenly disappears because the camera is covered.

Do not detect ruku when:
- The user only leans slightly.
- The user adjusts the phone.
- The body is too poorly visible to calculate a reliable torso angle.

Do not complete a Rak'ah from time alone.
Time may support another signal, but should not replace the required sequence.

## Step 15 - Rak'ah Completion Rule
Remove the current `standReturnCount === 2` counting rule.

A Rak'ah should increment only when the state machine confirms the full cycle and returns to stable standing after the second sujud, or when the strict hidden-cycle fallback is accepted.

After completion:
- Increment `rakatCount` once.
- Reset temporary state data for the next Rak'ah.
- Keep the new stable standing pose as the starting state.
- Speak the new Rak'ah number once.
- Prevent duplicate increments while the person remains standing.

## Step 16 - Integrate With the Current One-File App
Keep the current `index.html` structure for this implementation unless there is a strong reason to split files.

Inside the existing script:
- Replace the old `isCurrentlyDown` and `standReturnCount` movement logic.
- Keep `rakatCount`, camera setup, MoveNet detector, canvas rendering, reset, and speech features.
- Replace most of `processPose()` with feature extraction + state-machine processing.

Recommended internal functions:
- `extractPoseFeatures(keypoints)`
- `updatePoseHistory(features)`
- `classifyStanding(features)`
- `classifyRuku(features)`
- `classifyVisibleSujud(features)`
- `detectDownwardDisappearance(history)`
- `updatePrayerState(features, timestamp)`
- `completeRakat()`
- `resetPrayerTracking()`

Keep these functions small and separated so thresholds can be tuned without rewriting the whole app.

## Step 17 - Centralize All Thresholds
Create one configuration object near the top of the script for values that need tuning.

Examples:
- Minimum keypoint confidence.
- Standing angle tolerance.
- Ruku angle range.
- Minimum downward velocity.
- Minimum visible-body ratio.
- Lost-body frame count.
- State confirmation duration.
- Hidden-cycle minimum duration.
- Confidence thresholds.

Do not scatter numbers such as `0.35`, `0.60`, or timing values throughout the code.

This allows real-world testing to improve accuracy without changing the architecture.

## Step 18 - Improve Status Feedback
Use the existing status UI to show the confirmed prayer state, not noisy raw frame guesses.

Possible status messages:
- Calibrating standing position...
- Standing detected
- Ruku detected
- Standing after ruku
- Going to sujud
- First sujud detected
- Sitting detected
- Second sujud detected
- Rak'ah completed
- Body hidden - tracking prayer movement
- Movement unclear - waiting for a reliable pose

## Step 19 - Reset Behavior
`resetApp()` must reset more than the Rak'ah number.

It should also clear:
- Current prayer state.
- Pose history.
- Calibration data if a full recalibration is desired.
- Hidden-state timers.
- Confidence counters.
- Last movement direction.
- Any pending candidate state.

After reset, require stable standing calibration again before counting.

## Step 20 - Testing Plan
Test the logic in real prayer-like movement, not only by moving one body part.

Test at least these camera setups:
1. Phone on the ground, full body visible.
2. Phone on a low table.
3. Phone on a normal-height table where sujud disappears completely.
4. User closer to camera.
5. User farther from camera.

For each setup, perform several complete Rak'ah cycles and record where state detection succeeds or fails.

Also test false-positive situations:
- Bend down briefly without doing ruku.
- Walk sideways out of the camera.
- Leave the camera while standing.
- Cover the camera for one second.
- Move very quickly.
- Stay still in ruku longer than normal.
- Stay in sujud longer than normal.
- Have MoveNet lose some landmarks for a few frames.

The system should not increase the Rak'ah number in these cases unless the required prayer sequence is genuinely completed.

## Step 21 - Debug Mode for Tuning
During development, add an optional debug view or console output showing:
- Current confirmed state.
- Candidate state.
- Torso angle.
- Body visibility ratio.
- Vertical movement direction/velocity.
- Visible landmark count.
- State confidence.
- Time spent in current state.

This is for development only and can be hidden in the normal UI.
It will make threshold tuning much faster than guessing why a state failed.

## Step 22 - Recommended Implementation Order
Implement in this order to reduce risk:

1. Add feature extraction without changing counting.
2. Add rolling pose history and smoothing.
3. Add standing calibration.
4. Add reliable standing detection.
5. Add ruku detection.
6. Add standing-after-ruku detection.
7. Add downward movement detection.
8. Add visible sujud detection.
9. Add downward-disappearance sujud detection.
10. Add sitting-between-sujud detection.
11. Add second-sujud detection.
12. Add hidden-cycle fallback.
13. Replace the old Rak'ah counter with the full state-machine completion rule.
14. Add debug information and tune thresholds using real tests.
15. Remove or hide unnecessary debug output after accuracy is acceptable.

Do not try to tune every threshold before the state machine works end-to-end.
First make the sequence correct, then tune accuracy.

## Acceptance Criteria
The implementation is successful when:
- The app no longer depends mainly on nose height.
- Standing uses multiple landmarks and body orientation.
- Ruku is recognized from torso/body shape.
- Sujud can be recognized when the body stays visible.
- Sujud can also be inferred from a clear downward disappearance.
- Random disappearance does not automatically count as sujud.
- One bad frame cannot change the prayer state.
- Rak'ah increases only after the expected prayer sequence is completed.
- Phone-on-ground and phone-on-table setups both work reasonably well.
- Reset returns the tracking system to a clean calibrated state.

## Important Limitation
If the entire body is completely outside the camera for first sujud, sitting, and second sujud, those hidden movements cannot be visually detected.

The app may use the strict hidden-cycle fallback described above, but this must be treated internally as an inference with lower confidence, not as direct visual detection.

## Final Target Logic

`Camera -> MoveNet landmarks -> feature extraction -> smoothing/history -> prayer state machine -> confidence checks -> Rak'ah completion`

The central rule is: understand the movement sequence, not one body point.
