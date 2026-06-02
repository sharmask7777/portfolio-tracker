# Implementation Plan: Interactive History Visualization

## Checklist
- [ ] Step 1: Create HistoryChart Component Structure
- [ ] Step 2: Implement Data Fetching & State
- [ ] Step 3: Implement Dynamic Sampling & Filtering
- [ ] Step 4: Design AreaChart with Overlap
- [ ] [ ] Step 5: Implement Custom Tooltip
- [ ] Step 6: Integration into Dashboard

## Implementation Steps

### Step 1: Create HistoryChart Component Structure
**Objective**: Scaffold the `HistoryChart` component with range buttons.
**Guidance**: Create `frontend/src/components/Dashboard/HistoryChart.tsx`. Add buttons for presets (1M, 3M, 6M, 1Y, 3Y, 5Y, ALL).
**Test Requirements**: Verify buttons render and update local state.
**Demo**: `HistoryChart` component visible with clickable range buttons.

### Step 2: Implement Data Fetching & State
**Objective**: Fetch history data from the backend.
**Guidance**: Use `axios` to call `/api/portfolio/:id/history`. Use `useEffect` to trigger on `portfolioId` change.
**Test Requirements**: Mock axios and verify data is stored in state.
**Demo**: Console log showing fetched history array.

### Step 3: Implement Dynamic Sampling & Filtering
**Objective**: Optimize data for rendering.
**Guidance**: Implement `getSampledData` utility. Filter the fetched data based on the `selectedRange`.
**Test Requirements**: Unit test for `getSampledData` with various array sizes and ranges.
**Demo**: State showing reduced number of points for 'ALL' range.

### Step 4: Design AreaChart with Overlap
**Objective**: Render the visual chart using Recharts.
**Guidance**: Use `AreaChart` with two `Area` components (Value and Invested). Add the linear gradient for 'Value'.
**Test Requirements**: Verify chart renders without errors.
**Demo**: Visual chart showing two overlapping areas.

### Step 5: Implement Custom Tooltip
**Objective**: Provide detailed information on hover.
**Guidance**: Create a `CustomTooltip` functional component. Handle currency formatting and gain calculations.
**Test Requirements**: Verify tooltip shows correct values when hovering over a point.
**Demo**: Hover over chart to see Date, Value, Invested, and Gain %.

### Step 6: Integration into Dashboard
**Objective**: Place the chart on the main dashboard.
**Guidance**: Add `HistoryChart` to `App.tsx` in the `overview` tab, above the "Scheme Breakdown".
**Test Requirements**: Verify the chart is visible and responsive.
**Demo**: Full dashboard view with the interactive history chart.
