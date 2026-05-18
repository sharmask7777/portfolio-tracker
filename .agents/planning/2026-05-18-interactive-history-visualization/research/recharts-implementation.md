# Research: Recharts History Visualization

## Dynamic Sampling Strategy
For portfolios with years of history, the daily engine will return thousands of points. To maintain 60fps on the frontend:
- **1M Range**: No sampling (30 points).
- **3M - 6M Range**: No sampling (~90-180 points).
- **1Y Range**: Daily sampling (365 points) is acceptable.
- **3Y+ Range**: Sample every 3-7 days.
- **Implementation**: Simple array filtering based on index modulo.

## Custom Tooltip Metrics
The tooltip needs to calculate Unrealized Gain and Gain % on the fly if not provided by the API:
- `Gain = Current Value - Invested Amount`
- `Gain % = (Gain / Invested Amount) * 100`

## Recharts Overlapping AreaChart
- Use `Area` components with `stackId` **not** set (or set to different values) to achieve overlap.
- Set `fillOpacity` (e.g., 0.3) for visibility.
- Order matters: The first `Area` is rendered at the bottom.

## Colors (Based on `ui-brand.md`)
- **Current Value**: `--accent-color` (#3b82f6) or a gradient.
- **Invested Amount**: `--text-secondary` or a neutral gray to act as the baseline.
