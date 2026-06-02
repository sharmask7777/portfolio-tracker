# Rough Idea: Interactive History Visualization

Create a responsive, interactive AreaChart on the frontend to visualize historical corpus movement (Invested vs Current Value).

## Key Features:
- **Data Fetching**: Fetch data from `/api/portfolio/:id/history`.
- **Time Range Navigation**: Presets for 1M, 3M, 6M, 1Y, 3Y, 5Y, ALL.
- **Chart Visualization**:
    - Recharts `AreaChart`.
    - Overlapping areas for 'Invested Amount' and 'Current Value'.
    - Transparent fills for overlap visibility.
- **Interactivity**:
    - Comprehensive tooltip: Date, Current Value, Invested Amount, Unrealized Gain/Loss (₹), Gain Percentage (%).
- **Performance**:
    - Dynamic frontend sampling for long historical ranges.
