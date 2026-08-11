# Split Static Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the embedded CSS and application JavaScript out of `index.html` without changing the application’s appearance or behavior.

**Architecture:** Keep the application as a dependency-free static website. `index.html` owns document structure and third-party script loading, `styles.css` owns all existing presentation rules, and `app.js` owns all existing camera, pose detection, counting, drawing, reset, and speech behavior.

**Tech Stack:** HTML5, CSS3, browser JavaScript, TensorFlow.js, MoveNet, PowerShell regression check

## Global Constraints

- Preserve every existing UI element, Arabic message, threshold, function, and event handler.
- Do not add a framework, package manager, build step, or runtime dependency.
- Preserve the existing order of third-party TensorFlow.js scripts.
- Preserve the HTTPS launcher behavior while updating its verification to read the extracted files.
- Do not create a Git commit unless the user requests one.

---

### Task 1: Add a structural regression check

**Files:**
- Create: `tests/verify-split.ps1`

**Interfaces:**
- Consumes: The expected static-file structure and the behavior-critical tokens from the original `index.html`.
- Produces: A zero exit code when the split files are connected correctly and the original counting behavior is present.

- [ ] **Step 1: Write the failing test**

Create a PowerShell check that requires `styles.css` and `app.js`, checks their references in `index.html`, rejects embedded style/application blocks, and checks the original camera, model, counting, speech, and render-loop tokens.

- [ ] **Step 2: Run the test to verify it fails**

Run: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/verify-split.ps1`

Expected: FAIL because `styles.css` and `app.js` do not exist yet.

### Task 2: Extract CSS and JavaScript

**Files:**
- Modify: `index.html:7-259`
- Modify: `index.html:308-458`
- Create: `styles.css`
- Create: `app.js`

**Interfaces:**
- Consumes: The exact contents of the existing `<style>` block and final inline `<script>` block.
- Produces: `<link rel="stylesheet" href="styles.css">` and `<script src="app.js"></script>` static-file boundaries.

- [ ] **Step 1: Move CSS without rewriting it**

Copy every rule between `<style>` and `</style>` into `styles.css`, then replace that block with:

```html
<link rel="stylesheet" href="styles.css">
```

- [ ] **Step 2: Move application JavaScript without rewriting it**

Copy every statement from the final inline application `<script>` into `app.js`, then replace that block with:

```html
<script src="app.js"></script>
```

- [ ] **Step 3: Run the regression check**

Run: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/verify-split.ps1`

Expected: PASS with `Static asset split verification passed.`

### Task 3: Verify syntax and review the patch

**Files:**
- Verify: `index.html`
- Verify: `styles.css`
- Verify: `app.js`
- Verify: `tests/verify-split.ps1`

**Interfaces:**
- Consumes: The completed three-file static application.
- Produces: Evidence that JavaScript parses and the patch contains only the intended split.

- [ ] **Step 1: Parse-check JavaScript when Node.js is available**

Run: `node --check app.js`

Expected: Exit code 0 and no output. If Node.js is unavailable, report that the structural check was used instead.

- [ ] **Step 2: Run the regression check again**

Run: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/verify-split.ps1`

Expected: PASS.

- [ ] **Step 3: Inspect repository changes**

Run: `git diff --check` and `git status --short`

Expected: No whitespace errors; only the plan, regression check, `index.html`, `styles.css`, `app.js`, and the launcher verification in `start-https-server.ps1` are new or modified by this task.

### Task 4: Preserve HTTPS launcher verification

**Files:**
- Modify: `tests/verify-split.ps1`
- Modify: `start-https-server.ps1:48-84`

**Interfaces:**
- Consumes: `index.html` references to `styles.css` and `app.js`, plus the MoveNet setup now stored in `app.js`.
- Produces: The same local and public safety checks across the new file structure.

- [ ] **Step 1: Add a failing launcher check**

Require the launcher to fetch `app.js` locally and publicly, verify the CSS/JS references in HTML, and verify MoveNet in the fetched JavaScript.

- [ ] **Step 2: Run the test to verify it fails**

Run: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/verify-split.ps1`

Expected: FAIL because the launcher still searches for MoveNet inside `index.html`.

- [ ] **Step 3: Update the two launcher safety checks**

Fetch `$localUrl + 'app.js'` and `$publicUrl + '/app.js'`. Check the HTML for `styles.css` and `app.js`, then check each JavaScript response for `poseDetection.SupportedModels.MoveNet`.

- [ ] **Step 4: Run the complete regression check**

Run: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/verify-split.ps1`

Expected: PASS.
