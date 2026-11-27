### Task 4: Autonomous Inner Dev Loop, Multimodal Screenshot Verification & Review Crew

**Files:**
- Modify: `scripts/compare-web-mobile-ui.ts`
- Modify: `screenshots/visual-parity-report.md`
- Test: Playwright E2E and Maestro E2E flows

**Interfaces:**
- Consumes: Running Docker container (`http://localhost:8082`) and running Android emulator (`emulator-5554`).
- Produces: Multimodal screenshots of Dashboard, Holdings, and Analytics, and verification report in `screenshots/visual-parity-report.md`.

- [ ] **Step 1: Rebuild and deploy updated mobile APK to Android emulator**

Run: `export PATH="$HOME/Library/Android/sdk/platform-tools:$PATH" && (cd mobile && ./scripts/emulate-android.sh)`
Expected: APK builds and installs cleanly on `emulator-5554`.

- [ ] **Step 2: Trigger portfolio sync on device to pull fresh server data with day changes and returns**

Send touch inputs or reload the app so `refreshPortfolio()` executes `syncWithServer()`, populating SQLite with day change, XIRR, and asset categories.

- [ ] **Step 3: Capture live screenshots of Dashboard, Holdings, and Analytics on emulator**

Capture:
- `adb exec-out screencap -p > .gemini/antigravity/brain/<conv-id>/screenshots/emulator-dash-fixed.png`
- Scroll down and capture asset allocation: `adb exec-out screencap -p > .gemini/antigravity/brain/<conv-id>/screenshots/emulator-dash-allocation-fixed.png`
- Switch to Holdings tab: `adb shell input tap 324 2315` and capture: `adb exec-out screencap -p > .gemini/antigravity/brain/<conv-id>/screenshots/emulator-holdings-fixed.png`
- Toggle ABS mode: `adb shell input tap ...` and capture toggled view.
- Switch to Analytics tab: `adb shell input tap 540 2315` and capture: `adb exec-out screencap -p > .gemini/antigravity/brain/<conv-id>/screenshots/emulator-analytics-fixed.png`

- [ ] **Step 4: Execute Multimodal Visual Inspection**

Inspect captured screenshots to verify:
1. Day change displays non-zero live values (`+₹6,236.69 (+0.55%)` on Dashboard, positive/negative live values on scheme cards).
2. Asset allocation displays granular categories without rogue `Gold/Others 96.9%`.
3. Analytics tab renders Market Cap breakdown (Large, Mid, Small) and Arbitrage.
4. XIRR/ABS toggle is clearly visible, operable, and toggles return representations.

- [ ] **Step 5: Run full hermetic verification sequence**

Run:
- `pnpm --filter mobile build:verify`
- `pnpm --filter mobile test:unit`
- `pnpm parity:check`
- `pnpm parity:visual`
- `scripts/check-privacy-and-pii.py`

- [ ] **Step 6: Dispatch Multi-Specialist Review Crew**

Dispatch specialized review subagents:
- CX & Frontend Specialist (`cx-frontend-auditor`)
- Quantitative Finance & Visual Invariant Specialist (`finance-visual-auditor`)
- Architecture & Code Quality Auditor (`code-quality-auditor`)
- Mobile & Offline Invariant Auditor (`mobile-offline-auditor`)

- [ ] **Step 7: Commit verification reports and changes**

```bash
git add screenshots/ scripts/
git commit -m "chore(parity): visual verification and cross-platform parity report"
```
