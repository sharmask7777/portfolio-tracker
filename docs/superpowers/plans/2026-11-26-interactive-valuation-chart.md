# Interactive Valuation Trend & Checkpoints Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the static valuation trend chart in the React Native / Expo mobile app into a high-performance interactive chart supporting touch scrubbing, dynamic time-domain pinch-to-zoom/panning, a docked precision inspection HUD card with pinned state and dedicated resets, verified on Android and iOS emulators against synthetic data.

**Architecture:** A gesture-driven React Native PanResponder state machine (`IDLE`, `SCRUBBING`, `PINCHING`, `COOLDOWN`) coupled with dynamic time-domain checkpoint slicing and binary search nearest-point snapping. Parent vertical `<ScrollView>` scroll-locking prevents gesture dropping, while independent reset controls allow reverting pinned probes and zoom levels without UI friction.

**Tech Stack:** React Native 0.88, React 19, Expo 58, React Native SVG, Vitest, Maestro E2E, Android Emulator (Medium Phone API 37), iOS Simulator (iPhone 17 Pro).

**Spec:** [`docs/superpowers/specs/2026-11-26-interactive-valuation-chart-design.md`](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/docs/superpowers/specs/2026-11-26-interactive-valuation-chart-design.md)

## Global Constraints
- Strict Zero-Any Rule: no `any` types in TypeScript code (`mobile/`).
- TypeScript strictness: `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`.
- View Layer Zero Business Logic: statically enforced by `scripts/check-view-layer-boundaries.py` (no raw statutory tax formulas, no direct SQLite imports in components).
- Mobile Maintainability: complexity $\le 10$, function length $\le 50$, parameters $\le 3$, file lines $\le 300$.
- Zero PII: strictly synthetic data (`synthetic.master@example.com`, Zero real PANs/investor names).
- Coverage thresholds: Mobile Lines $\ge 89\%$, Statements $\ge 87\%$, Funcs $\ge 86\%$, Branches $\ge 75\%$.

## Review Focus
1. **Single Point Dataset**: When `filtered` has only 1 checkpoint, binary search and coordinate math must not divide by zero or emit `NaN` paths.
2. **Off-Screen Pinned Date**: When a probed date is panned out of view, the docked card must remain pinned and the hairline must clamp gracefully with an off-screen indicator without crashing.
3. **Pinch-Release Trailing Finger**: When lifting two fingers, the trailing finger releasing ~50ms later must not jump the scrub hairline to an unintended date.
4. **Range Preset Switching While Pinned**: Selecting a range preset button (e.g. `1Y`) while a probe is pinned must clear both probe and zoom back to default.
5. **Parent Scroll Interception**: Tapping and scrubbing on the chart canvas must not jerk or scroll the dashboard page vertically.

---

### Task 1: Time-Domain Dynamic Slicing & Binary Search Snapping in `chart-geometry.ts`

**Files:**
- Modify: `mobile/src/components/Dashboard/chart-geometry.ts`
- Test: `mobile/tests/chart-geometry.test.ts`

**Interfaces:**
- Produces:
  - `findNearestCheckpointIndex(touchX: number, points: Array<{ x: number }>, padH: number, width: number): number`
  - `sliceCheckpointsByTimeRange(items: HistoricalCheckpoint[], startTime: number, endTime: number, maxPoints?: number): HistoricalCheckpoint[]`
  - `computeChartGeometry(items: HistoricalCheckpoint[], width: number, height: number, visibleRange?: [number, number]): Coordinates`

- [ ] **Step 1: Write the failing tests for binary search snapping and time-domain slicing**

```typescript
// mobile/tests/chart-geometry.test.ts
import { describe, it, expect } from 'vitest';
import {
  findNearestCheckpointIndex,
  sliceCheckpointsByTimeRange,
  computeChartGeometry,
} from '../src/components/Dashboard/chart-geometry';
import type { HistoricalCheckpoint } from '../src/services/reality-check-service';

describe('chart-geometry interactive extensions', () => {
  const mockCheckpoints: HistoricalCheckpoint[] = [
    { date: '2026-01-01', value: 100000, investedAmount: 80000, unrealizedGain: 20000, gainPct: 25, isAth: true, athValue: 100000, drawdownPct: 0 },
    { date: '2026-01-15', value: 105000, investedAmount: 80000, unrealizedGain: 25000, gainPct: 31.25, isAth: true, athValue: 105000, drawdownPct: 0 },
    { date: '2026-02-01', value: 95000, investedAmount: 80000, unrealizedGain: 15000, gainPct: 18.75, isAth: false, athValue: 105000, drawdownPct: 9.52 },
  ];

  it('snaps touchX to the nearest checkpoint index via binary search', () => {
    const points = [{ x: 16 }, { x: 165 }, { x: 314 }];
    expect(findNearestCheckpointIndex(10, points, 16, 330)).toBe(0);
    expect(findNearestCheckpointIndex(160, points, 16, 330)).toBe(1);
    expect(findNearestCheckpointIndex(300, points, 16, 330)).toBe(2);
  });

  it('slices checkpoints dynamically by time window without losing boundaries', () => {
    const tStart = new Date('2026-01-10').getTime();
    const tEnd = new Date('2026-02-05').getTime();
    const sliced = sliceCheckpointsByTimeRange(mockCheckpoints, tStart, tEnd);
    expect(sliced.length).toBe(2);
    expect(sliced[0]?.date).toBe('2026-01-15');
    expect(sliced[1]?.date).toBe('2026-02-01');
  });

  it('handles single-point checkpoints safely without division by zero', () => {
    const single = [mockCheckpoints[0]!];
    const geom = computeChartGeometry(single, 330, 200);
    expect(geom.valPoints.length).toBe(1);
    expect(Number.isFinite(geom.valPoints[0]?.x)).toBe(true);
    expect(Number.isFinite(geom.valPoints[0]?.y)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter mobile test tests/chart-geometry.test.ts`
Expected: FAIL with "findNearestCheckpointIndex is not a function"

- [ ] **Step 3: Implement `findNearestCheckpointIndex`, `sliceCheckpointsByTimeRange`, and safe single-point handling in `mobile/src/components/Dashboard/chart-geometry.ts`**

Keep functions under 50 lines and complexity $\le 10$. Use binary search for $O(\log N)$ nearest point lookup.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter mobile test tests/chart-geometry.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/Dashboard/chart-geometry.ts mobile/tests/chart-geometry.test.ts
git commit -m "feat(mobile): add time-domain slicing and binary search snapping to chart geometry"
```

---

### Task 2: Interactive SVG Canvas, Scrub Hairline & Precision HUD in `chart-components.tsx`

**Files:**
- Modify: `mobile/src/components/Dashboard/chart-components.tsx`
- Test: `mobile/tests/chart-components.test.tsx`

**Interfaces:**
- Consumes:
  - `computeChartGeometry`, `findNearestCheckpointIndex` from `chart-geometry.ts`
- Produces:
  - `CheckpointTooltip` / `ProbedDetailCard` with `onResetProbe?: () => void` and `isPinned?: boolean`
  - `ChartSvgCanvas` with `panResponder`, `scrubX: number | null`, `onGestureActive?: (active: boolean) => void`
  - `ChartHeader` with `isZoomed?: boolean` and `onResetZoom?: () => void`

- [ ] **Step 1: Write failing tests for interactive chart components**

```typescript
// mobile/tests/chart-components.test.tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import {
  ChartHeader,
  CheckpointTooltip,
  ChartSvgCanvas,
} from '../src/components/Dashboard/chart-components';
import { computeChartGeometry } from '../src/components/Dashboard/chart-geometry';
import type { HistoricalCheckpoint } from '../src/services/reality-check-service';

describe('interactive chart-components', () => {
  const cp: HistoricalCheckpoint = {
    date: '2026-01-15',
    value: 1250000,
    investedAmount: 1000000,
    unrealizedGain: 250000,
    gainPct: 25.0,
    isAth: true,
    athValue: 1250000,
    drawdownPct: 0,
  };

  it('renders Reset Zoom button when chart is zoomed', () => {
    const onResetZoom = vi.fn();
    const rendered = ChartHeader({ isAth: true, drawdown: 0, isZoomed: true, onResetZoom });
    expect(JSON.stringify(rendered)).toContain('Reset Zoom');
  });

  it('renders Reset to Latest button in tooltip when probe is pinned', () => {
    const onResetProbe = vi.fn();
    const rendered = CheckpointTooltip({ cp, isPinned: true, onResetProbe });
    expect(JSON.stringify(rendered)).toContain('Reset to Latest');
  });

  it('renders scrub hairline when scrubX is provided', () => {
    const geom = computeChartGeometry([cp], 330, 200);
    const rendered = ChartSvgCanvas({
      width: 330,
      height: 200,
      geometry: geom,
      selectedIdx: 0,
      scrubX: 165,
      onSelectIdx: vi.fn(),
      panResponderHandlers: {},
    });
    expect(JSON.stringify(rendered)).toContain('scrub-hairline');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter mobile test tests/chart-components.test.tsx`
Expected: FAIL with missing props/elements

- [ ] **Step 3: Implement interactive props, scrub hairline, Reset Zoom badge, and Reset Probe button in `chart-components.tsx`**

Ensure `mobile/` maintainability constraints: file $\le 300$ lines, functions $\le 50$ lines, complexity $\le 10$. If `chart-components.tsx` approaches 300 lines, extract tooltip styles or HUD to `chart-tooltip.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter mobile test tests/chart-components.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/Dashboard/chart-components.tsx mobile/tests/chart-components.test.tsx
git commit -m "feat(mobile): add scrub hairline, reset zoom badge and pinned probe reset button"
```

---

### Task 3: Controller State Machine & Parent Scroll Lock in `HistoricalTrendChart.tsx` and `mobile/app/(tabs)/index.tsx`

**Files:**
- Modify: `mobile/src/components/Dashboard/HistoricalTrendChart.tsx`
- Modify: `mobile/app/(tabs)/index.tsx`
- Test: `mobile/tests/historical-chart-parity.test.tsx`

**Interfaces:**
- Consumes:
  - `sliceCheckpointsByTimeRange`, `findNearestCheckpointIndex` from `chart-geometry.ts`
  - `CheckpointTooltip`, `ChartSvgCanvas`, `ChartHeader` from `chart-components.tsx`
- Produces:
  - `HistoricalTrendChart` with `onGestureActive?: (active: boolean) => void`
  - Gesture state machine handling 1-finger scrub, 2-finger pinch/pan, trailing-finger cooldown debounce.

- [ ] **Step 1: Write failing tests for scrub pinning, zoom reset, and range switching resets**

```typescript
// in mobile/tests/historical-chart-parity.test.tsx
it('supports onGestureActive callback to coordinate parent scroll locking', () => {
  const onGestureActive = vi.fn();
  const element = HistoricalTrendChart({
    historyPoints: mockPoints,
    onGestureActive,
  });
  expect(element.props.testID).toBe('historical-trend-chart');
});

it('resets both zoom and pinned probe when a new range preset is selected', () => {
  // test that selecting range clears probed checkpoint and restores 100% zoom
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter mobile test tests/historical-chart-parity.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement state machine, pinch-to-zoom math, and parent scroll lock in `HistoricalTrendChart.tsx` and `mobile/app/(tabs)/index.tsx`**

- In `HistoricalTrendChart.tsx`:
  - Create PanResponder tracking touch count.
  - Single touch moves scrub hairline, snaps nearest checkpoint, updates `probedDate`.
  - Double touch computes pinch scale delta and pan midpoint delta, updating `visibleTimeRange`.
  - When touches active, call `props.onGestureActive?.(true)`. On release, call `props.onGestureActive?.(false)`.
- In `mobile/app/(tabs)/index.tsx`:
  - `const [chartGestureActive, setChartGestureActive] = useState(false);`
  - Pass `scrollEnabled={!chartGestureActive}` to `<ScrollView testID="dashboard-scroll">`.
  - Pass `onGestureActive={setChartGestureActive}` to `<HistoricalTrendChart>`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter mobile test tests/historical-chart-parity.test.tsx`
Expected: PASS

- [ ] **Step 5: Run full mobile unit and boundary verification**

Run: `pnpm --filter mobile build:verify`
Expected: PASS with 0 lint warnings, 0 type errors, 0 knip unused exports, all tests green.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/components/Dashboard/HistoricalTrendChart.tsx mobile/app/\(tabs\)/index.tsx mobile/tests/historical-chart-parity.test.tsx
git commit -m "feat(mobile): integrate PanResponder state machine and parent scroll coordination"
```

---

### Task 4: Automated E2E Test Suite (Maestro Flow & Simulation Suite)

**Files:**
- Create: `mobile/e2e/flows/05-interactive-chart.yaml`
- Modify: `mobile/src/e2e/reality-check-overview.test.tsx`
- Test: `pnpm --filter mobile test:e2e`

- [ ] **Step 1: Write Maestro E2E test flow for chart scrubbing, pinning, and zooming**

```yaml
# mobile/e2e/flows/05-interactive-chart.yaml
appId: com.portfolio.mobile
---
- launchApp:
    clearState: false

- assertVisible:
    id: "historical-trend-chart"

- tapOn:
    id: "range-button-1Y"

# Perform swipe/scrub across chart canvas
- swipe:
    from:
      id: "chart-svg-canvas"
      x: 20
      y: 50
    to:
      id: "chart-svg-canvas"
      x: 80
      y: 50
    duration: 600

# Assert pinned inspection card is visible
- assertVisible:
    id: "checkpoint-tooltip-card"

# Tap Reset to Latest
- tapOn:
    id: "reset-probe-button"

# Assert returns to today's state
- assertVisible:
    id: "ath-badge"
```

- [ ] **Step 2: Add component simulation tests in `reality-check-overview.test.tsx`**

Assert that touch interaction triggers `scrub-hairline` and updates displayed valuation in `checkpoint-tooltip-card`.

- [ ] **Step 3: Run simulation E2E tests**

Run: `pnpm --filter mobile test:e2e`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add mobile/e2e/flows/05-interactive-chart.yaml mobile/src/e2e/reality-check-overview.test.tsx
git commit -m "test(mobile): add Maestro and simulation E2E tests for interactive chart"
```

---

### Task 5: Mobile Verification & Emulator Validation on Android & iOS

**Files:**
- No product code changes unless defects detected during visual inspection.

- [ ] **Step 1: Run preflight boundary & PII checks**

Run: `python3 scripts/check-privacy-and-pii.py && python3 scripts/check-view-layer-boundaries.py --self-test && python3 scripts/check-view-layer-boundaries.py`
Expected: All checks clean.

- [ ] **Step 2: Run complete mobile verification**

Run: `pnpm --filter mobile build:verify`
Expected: Clean pass with coverage thresholds satisfied.

- [ ] **Step 3: Validate in Android Emulator against synthetic master account**

Run: `bash mobile/scripts/emulate-android.sh`
Log in with `synthetic.master@example.com` / `password123`.
Inspect chart interaction visually, capture screenshot via `adb exec-out screencap -p > /tmp/android-chart.png`.
Verify layout ergonomics, hairline alignment, and 60fps responsiveness.

- [ ] **Step 4: Validate in iOS Simulator against synthetic master account**

Run: `bash mobile/scripts/emulate-ios.sh`
Inspect chart interaction visually, capture screenshot via `xcrun simctl io booted screenshot /tmp/ios-chart.png`.
Verify layout ergonomics, touch targets, and contrast.

- [ ] **Step 5: Final review and commit**

```bash
git add .
git commit -m "chore(mobile): verify interactive valuation chart on Android and iOS emulators"
```
