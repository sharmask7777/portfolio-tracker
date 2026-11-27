# Interactive Valuation Trend & Checkpoints Chart Design

## Intent and Context
The portfolio tracker mobile application (iOS & Android via React Native / Expo) currently displays a static SVG-based historical valuation trend chart (`HistoricalTrendChart.tsx`). While users can tap predefined range filters (1M, 3M, 6M, 1Y, 3Y, 5Y, ALL) and see static checkpoint dots, they cannot probe specific historical dates, drag along the timeline, or zoom in on high-density market movements.

This project transforms the static valuation trend chart into a high-performance, fluid interactive instrument allowing investors to pinch-to-zoom into dense time periods and scrub along historical checkpoints to inspect exact valuation, invested capital, gain/loss, and drawdown metrics on any given date.

---

## Goals
1. **Interactive Scrubbing & Probing**:
   - One-finger touch and horizontal dragging glides a vertical hairline cursor across the timeline, snapping dynamically to the nearest checkpoint date.
   - Smooth, responsive 60fps tracking without UI stutter or layout thrashing.
2. **Docked Precision Inspection Card**:
   - Displays the selected checkpoint's:
     - Formatted Date (e.g. `14 Oct 2024`).
     - Current Mark-to-Market Valuation in INR (e.g. `₹15,96,410`).
     - Total Invested Capital in INR (e.g. `₹13,48,200`).
     - Absolute Net Gain/Loss in INR and Percentage (e.g. `+₹2,48,210 (+18.4%)`).
     - All-Time High / Peak Drawdown status badge (e.g. `ATH` or `-2.4% Drawdown`).
   - Docked above the SVG canvas so the user's finger never obstructs numbers.
3. **Sticky Probe State & Dedicated Reset**:
   - When the user lifts their finger, the card stays pinned on the probed date.
   - A dedicated "Reset" button allows the user to clear the probe and return to the latest portfolio valuation.
4. **Fluid Pinch-to-Zoom & Horizontal Panning**:
   - Two-finger pinch gestures zoom the horizontal scale dynamically (up to 5x zoom, minimum 7-day window).
   - Two-finger pan allows scrolling horizontally across the zoomed timeline.
   - When zoomed beyond 1.0x, a visible "Reset Zoom" pill/button allows returning instantly to the selected range preset.
5. **Architectural & Statutory Invariants**:
   - Strict Zero-Any rule in TypeScript (`mobile/`).
   - Zero Business Logic in the view layer (`scripts/check-view-layer-boundaries.py` compliant; no raw tax math or direct DB access).
   - Maintainability bounds: complexity $\le 10$, function length $\le 50$, parameters $\le 3$, file lines $\le 300$.
   - Knip zero dead-code compliance.
6. **E2E & Platform Parity**:
   - Full Vitest unit test coverage exceeding thresholds (Lines $\ge 89\%$, Statements $\ge 87\%$, Funcs $\ge 86\%$, Branches $\ge 75\%$).
   - Verified on both Android Emulator and iOS Simulator using synthetic test accounts (`synthetic.master@example.com`, Zero PII).
   - Dedicated Maestro automated E2E test flows validating scrub, zoom, and reset behaviors.

---

## Non-Goals & Anti-Goals
- **Non-Goals**:
  - Rewriting the underlying historical valuation derivation algorithms in `reality-check-service.ts` or SQLite schema.
  - Adding server-side network roundtrips during gesture tracking (all interactions must operate client-side in-memory).
- **Anti-Goals**:
  - Obscuring figures with floating tooltips placed under the user's thumb.
  - Introducing heavy third-party gesture libraries that conflict with React Native 0.88 or Expo 58.
  - Relaxing numerical precision or formatting standards.

---

## User Interaction Details (Decided)
1. **Probe HUD Layout**: Option A (Docked Precision Card above the chart canvas).
2. **Gesture Splitting**:
   - **Single Touch / Drag**: Captures timeline scrubbing. Moves vertical indicator line; snaps to closest date; updates docked HUD.
   - **Multi-Touch (Two Fingers)**: Captures pinch-zoom and pan. Expands or contracts visible start/end timestamps.
3. **Pinning & Reset**:
   - Probe remains pinned after touch release.
   - Dedicated reset button (`Reset to Latest` / `✕`) restores live/latest snapshot.
   - Range preset buttons (1M, 3M, 1Y, etc.) reset both zoom and probe to normal range defaults.

---

## Technical Architecture & Implementation

### 1. Geometry & Dynamic Time-Domain Slicing (`chart-geometry.ts`)
- **Dynamic Time-Domain Zooming**:
  - Rather than merely stretching SVG pixel coordinates of downsampled points, zoom is tracked in the time domain via `visibleTimeRange: [number, number]` (timestamps).
  - When zooming into a slice (e.g. a 2-month window on a 5Y chart), `filterCheckpointsByTimeRange` slices raw `allCheckpoints` and samples up to 300 checkpoints *within that specific window*. This guarantees maximum resolution and day-by-day granularity ("as detailed as possible").
- **Binary Search Probing**:
  - `findNearestCheckpoint(touchX, points, width)` performs an $O(\log N)$ binary search across timestamps to snap the scrub hairline with sub-millisecond latency.

### 2. Gesture State Machine & Touch Negotiation (`HistoricalTrendChart.tsx`)
- **Parent Scroll Lock**:
  - `HistoricalTrendChart` accepts `onGestureActive?: (active: boolean) => void`.
  - When scrubbing or pinching begins, `onGestureActive(true)` temporarily sets `scrollEnabled={false}` on the parent dashboard `<ScrollView testID="dashboard-scroll">`, preventing vertical scroll drift from terminating the gesture.
  - When all touches end, `scrollEnabled={true}` is restored.
- **Multi-Touch Disambiguation**:
  - Managed via a formal gesture state machine (`IDLE`, `SCRUBBING`, `PINCHING`, `COOLDOWN`).
  - When a second finger touches down (`touches.length === 2`), the scrubber transitions to `PINCHING`, hiding the hairline cursor to avoid visual noise.
  - When fingers lift, a 150ms `COOLDOWN` window prevents the trailing finger from triggering an accidental scrub jump before resetting to `IDLE`.

### 3. Pinned Probe Lifecycle & Reset Decoupling
- **State by Date**:
  - The active probe is tracked by date (`probedDate: string | null`), not array index, ensuring resilience when zooming or re-sampling data.
  - If the user pans the chart such that the probed date moves off-canvas, the docked HUD card remains pinned with the historical metrics, and the hairline is clamped at the canvas edge with an off-screen indicator.
- **Independent Reset Controls**:
  - **Reset Probe (`✕ Reset to Latest`)**: Unpins the historical probe and returns the docked card to today's latest valuation and ATH/drawdown status.
  - **Reset Zoom (`🔍 Reset Zoom`)**: Restores the zoom window to 100% of the active range preset (1M, 6M, 1Y, ALL) without altering the pinned probe if it remains in view.
  - Selecting any new range preset button (e.g. clicking `1Y`) resets both zoom and probe.

### 4. Component Hierarchy
```
HistoricalTrendChart
├── ChartHeader (Title, Drawdown/ATH status badge, Reset Zoom button if zoomed)
├── RangeBar (1M, 3M, 6M, 1Y, 3Y, 5Y, ALL)
├── CheckpointTooltip / ProbedDetailCard (Docked HUD card with Date, Valuation, Invested, Gain, Drawdown, and "Reset Probe" button)
├── ChartSvgCanvas (PanResponder container with parent scroll lock callback)
│   └── Svg (Area gradient, Cost dashed line, Valuation curve, Scrub hairline, Highlighted circle)
└── ChartLegend (Valuation, Invested Capital)
```

### 5. What is Left to the Builder
- Optimal haptic feedback intensity (`Haptics.selectionAsync()` or graceful fallback if unavailable).
- Exact animation timing curve for zoom reset (e.g. spring or direct re-render).
- Test suite structure in Vitest and Maestro YAML step assertions.

---

## Verification & Testing Strategy
1. **Preflight Guardrails**:
   - `python3 scripts/check-privacy-and-pii.py`
   - `python3 scripts/check-view-layer-boundaries.py --self-test && python3 scripts/check-view-layer-boundaries.py`
2. **Mobile Lint & Build Verification**:
   - `pnpm --filter mobile lint`
   - `pnpm --filter mobile typecheck`
   - `pnpm --filter mobile knip`
   - `pnpm --filter mobile test:coverage`
3. **End-to-End Testing**:
   - Unit & Component simulation E2E tests (`mobile/src/e2e/reality-check-overview.test.tsx` and dedicated `historical-trend-interaction.test.tsx`).
   - Native Maestro flows (`mobile/e2e/flows/05-interactive-chart.yaml`).
   - Real visual execution on Android Emulator (`bash mobile/scripts/emulate-android.sh`) and iOS Simulator (`bash mobile/scripts/emulate-ios.sh`).
