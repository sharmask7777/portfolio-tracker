---
title: "Interactive Mobile Charting, Touch Gesture State Machine, and Mandatory Native Emulator Verification"
date: "2026-11-27"
category: "mobile"
problem_type: "architecture_pattern"
module: "mobile"
component: "dashboard-historical-trend-chart"
tags:
  - "mobile"
  - "react-native"
  - "pan-responder"
  - "gesture-state-machine"
  - "pinch-to-zoom"
  - "time-domain-slicing"
  - "scroll-coordination"
  - "maestro-e2e"
  - "native-emulator-mandate"
  - "zero-any"
  - "zero-business-logic"
status: "verified"
applies_when:
  - "Building or refactoring interactive touch gesture components (PanResponder, scrubbing, pinch-to-zoom) inside scrollable containers"
  - "Implementing dynamic time-domain chart downsampling, zooming, and panning on mobile"
  - "Displaying pinned or inspected historical financial checkpoints with off-screen indicators"
  - "Validating mobile applications on Android Emulator and iOS Simulator with Maestro E2E test flows"
  - "Enforcing strict native binary verification over simulated mobile web views"
---

# Interactive Mobile Charting, Touch Gesture State Machine, and Mandatory Native Emulator Verification

## Context & Problem Statement
The mobile application (React Native / Expo on Android and iOS) featured a static SVG-based historical valuation chart (`HistoricalTrendChart.tsx`). While users could toggle preset range chips (`1M`, `6M`, `1Y`, `ALL`), they could not inspect valuation or invested capital on specific dates, scrub along the timeline, or zoom into crowded transaction clusters.

Transforming this static graph into a responsive 60fps interactive instrument revealed several cross-platform mobile engineering hurdles:
1. **Parent ScrollView Interception**: In React Native, embedding a horizontal scrubber or pinch-to-zoom canvas inside a vertical `<ScrollView>` leads to gesture dropping or erratic jitter when slight vertical movement occurs during horizontal scrubbing.
2. **Gesture State Compounding & Trailing Finger Jump**: Naive multi-touch detection causes exponential zoom runaway during continuous pinch moves and accidental scrub jumps when one finger is lifted earlier than the second finger.
3. **Off-Screen Pinned Probe Drift**: When a historical date is pinned and the user zooms or pans, resolving the active point solely against the visible slice causes the HUD card to lose the pinned date and display metrics from an unrelated date.
4. **The Web-Mock Testing Antipattern**: Agents frequently test mobile applications by opening mobile Safari/Chrome pointing to `localhost:8082` (Web UI) rather than compiling and booting native binaries. This completely misses React Native PanResponder gesture behaviors, native safe areas, hardware back buttons, and Dark Mode theme rendering.
5. **Maestro YAML Syntax Incompatibilities**: Writing non-standard swipe syntax (`from: { x, y }` / `to: { x, y }`) causes `IllegalArgumentException` in Maestro 2.12.1.

---

## Root Causes & Defect Anatomy

### 1. Uncontrolled Pinch Compounding
Updating the base zoom ref on every React render while keeping the initial pinch distance constant causes exponential compounding:
$$\text{scale} = \frac{\text{dist}}{\text{dist}_{\text{initial}}} \times \text{baseZoom}$$
If `baseZoom` updates on each render frame, even a stationary 2-finger spread multiplies the zoom repeatedly until it hits the 5.0x ceiling.

### 2. Trailing Finger Scrub On Release
When lifting two fingers, one finger invariably leaves the screen 50–150ms before the other. In React Native's `PanResponder`, this transitions `touches.length` from 2 to 1 without firing `onPanResponderRelease` (which only fires when all touches end). Without an explicit cooldown state, the handler treats the remaining finger as an active single-finger scrub and jumps the hairline to the edge.

### 3. Off-Screen Metric Drift
Deriving the active checkpoint from the visible sub-array `filtered.find(cp => cp.date === probedDate)` evaluates to `undefined` once the date is panned off-screen. Falling back to `filtered[idx]` displays figures from whatever date happens to occupy that index, presenting inaccurate numbers to the user.

---

## Architectural Solutions & Engineering Mandates

### 1. PanResponder 4-State Machine (`chart-gesture.ts`)
We implemented a formal state machine (`IDLE` $\to$ `SCRUBBING` $\to$ `PINCHING` $\to$ `COOLDOWN`):
- **Provisional Probe On Grant**: When a finger touches down, mark `provisionalProbe = true`. If a second finger touches down on the next frame, cancel single-touch probing immediately.
- **Stable Base Zoom Capture**: Capture `refs.baseZoom.current = zoom` strictly on gesture onset when `refs.dist.current === null`. Subsequent moves compute scale solely against the initial pinch distance.
- **150ms Cooldown Debounce**: When transitioning from 2 touches to 1 touch, immediately enter `'COOLDOWN'`, reset pinch refs, and start a 150ms timer to block the trailing finger from scrubbing.
- **Parent Scroll Lock**:
  - In `PanResponder.create`, set `onPanResponderTerminationRequest: () => false` and `onShouldBlockNativeResponder: () => true`.
  - Expose `onGestureActive?: (active: boolean) => void` and bind to `scrollEnabled={!chartGestureActive}` on `<ScrollView testID="dashboard-scroll">`.
  - Clean up timers and reset `onGestureActive(false)` on component unmount via `useEffect`.

```typescript
// mobile/src/components/Dashboard/chart-gesture.ts
export function useChartPanResponder(
  ctx: GestureContext,
  callbacks: GestureCallbacks,
  zoomLevel: number,
): GestureResponderHandlers {
  // Stable refs prevent mid-gesture handler recreation
  const ctxRef = useRef(ctx);
  const callbacksRef = useRef(callbacks);
  const zoomRef = useRef(zoomLevel);
  ctxRef.current = ctx;
  callbacksRef.current = callbacks;
  zoomRef.current = zoomLevel;

  useEffect(() => {
    return () => {
      if (refs.cooldown.current) clearTimeout(refs.cooldown.current);
      callbacksRef.current.onGestureActive?.(false);
    };
  }, []);
  // ...
}
```

### 2. Time-Domain Slicing with 7-Day Window Floor & Neighbor Bracketing
- **Time-Domain Slicing**: Rather than scaling static SVG paths, zooming dynamically filters raw checkpoints by timestamps `[startMs, endMs]` and re-samples up to 300 points, preserving day-by-day detail.
- **7-Day Minimum Window Floor**: Clamps duration from below to satisfy the statutory minimum window:
  ```typescript
  const MIN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
  const visibleDuration = Math.max(Math.min(duration, MIN_WINDOW_MS), duration / zoomLevel);
  ```
- **Neighbor Bracketing for Sparse Portfolios**: When `< 2` checkpoints fall inside the zoomed window, `bracketCheckpoints` expands to include the nearest prior and subsequent checkpoints, preventing SVG curve collapse.
- **Proportional Pan Sensitivity**: Scales pan movement by chart width and current zoom level (`-dx / (chartW * Math.max(0.1, zoom - 1))`).

### 3. Off-Screen Pinned Probe Invariant & Directional Indicators
- **Dataset SSoT**: The active checkpoint is resolved against the full `rangePoints` dataset by `probedDate`, ensuring the HUD card remains pinned to the probed date's metrics regardless of pan or zoom level.
- **Boundary Clamping & Indicators**:
  - Inside visible slice: `canvasScrubX = exactX`, `canvasSelectedIdx = index`.
  - Earlier than visible slice: `canvasScrubX = CHART_PAD_H`, `canvasSelectedIdx = null`, HUD displays `(Off-screen ◀)`.
  - Later than visible slice: `canvasScrubX = width - CHART_PAD_H`, `canvasSelectedIdx = null`, HUD displays `(Off-screen ▶)`.

### 4. Mandatory Native Emulator / Simulator Verification Mandate
**Strict Anti-Web-Mock Mandate for Mobile Testing:**
1. **Never test mobile apps via browser Web UI**: Pointing Safari or Chrome on simulator/desktop to `http://localhost:8082` and claiming it as mobile verification is strictly prohibited.
2. **Mandatory Native Builds**:
   - **Android**: Compile native APK via `(cd mobile/android && ./gradlew assembleRelease --no-daemon)` and run on `Medium_Phone_API_37.0` using `bash mobile/scripts/emulate-android.sh`.
   - **iOS**: Compile native iOS app via CocoaPods and `xcodebuild -workspace PortfolioTracker.xcworkspace -scheme PortfolioTracker -configuration Debug -sdk iphonesimulator` and run on `iPhone 17 Pro` using `bash mobile/scripts/emulate-ios.sh`.
3. **Valid Maestro E2E Flows**:
   - Use standard Maestro 2.x syntax: `scrollUntilVisible` with `direction: DOWN` and `swipe` with `direction: LEFT`/`RIGHT` or `start`/`end` percentages (`"80%, 50%"` to `"20%, 50%"`).
   - Wire all new flows into `mobile/scripts/run-native-e2e.sh`.
4. **Multimodal Visual Evidence**: Capture actual screenshots from booted emulators in dark mode (`#09090b` / `#18181b`) with synthetic test account `synthetic.master@example.com`.

### 5. Martin Fowler Maintainability Compliance in React Native
- Zero `eslint-disable max-params` comments permitted. Functions requiring $> 3$ arguments must use strongly-typed options interfaces (e.g. `FindNearestCheckpointOptions`, `TimeRangeSliceOptions`).
- All mobile source files strictly adhere to: file lines $\le 300$, function lines $\le 50$, parameters $\le 3$, cyclomatic complexity $\le 10$, Zero `any`.

---

## Verification & Test Proof
1. **Preflight Boundary & PII Checks**:
   - `python3 scripts/check-privacy-and-pii.py`: PASSED (Zero PII, synthetic privacy mandate).
   - `python3 scripts/check-view-layer-boundaries.py --self-test && python3 scripts/check-view-layer-boundaries.py`: PASSED (150 view files scanned, 0 business logic leaks).
2. **Mobile Lint, Types, Knip, and Unit Test Coverage**:
   - `pnpm --filter mobile lint`: PASSED (0 warnings, 0 errors).
   - `pnpm --filter mobile typecheck`: PASSED (`tsc --noEmit` clean).
   - `pnpm --filter mobile knip`: PASSED (0 unused exports/dependencies).
   - `pnpm --filter mobile test`: PASSED across all 44 test files and 489 tests.
   - `pnpm --filter mobile test:e2e`: PASSED across 11 test files and 29 simulation tests.
3. **Native Emulator Artifacts**:
   - Android Emulator: [screenshots/mobile-android-chart.png](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/screenshots/mobile-android-chart.png), [screenshots/mobile-android-chart-probed.png](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/screenshots/mobile-android-chart-probed.png).
   - iOS Simulator: [screenshots/mobile-ios-chart.png](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/screenshots/mobile-ios-chart.png) (genuine native 1206x2622 Dark Mode capture).
4. **Maestro Automated Test Execution**:
   - `maestro test mobile/e2e/flows/05-interactive-chart.yaml` executed and passed on booted iOS Simulator.
