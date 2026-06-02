# Detailed Design: Interactive History Visualization

## Overview
A responsive React component (`HistoryChart`) that visualizes the historical performance of a portfolio using Recharts. It provides time-range presets and interactive tooltips.

## Components and Interfaces

### HistoryChart Component
- **Props**: `portfolioId`, `initialRange`.
- **State**:
    - `data`: Array of history points.
    - `selectedRange`: Current range preset.
    - `loading`: Boolean.

### Data Fetching
- Fetch from `GET /api/portfolio/:id/history`.
- Invalidate/Refetch when `portfolioId` or `selectedRange` changes (if backend supports range filtering, otherwise filter on frontend).

## Implementation Details

### Dynamic Sampling (Frontend)
```typescript
const getSampledData = (data: any[], range: string) => {
  if (range === 'ALL' || range === '5Y' || range === '3Y') {
    return data.filter((_, index) => index % 7 === 0 || index === data.length - 1);
  }
  return data;
};
```

### AreaChart Configuration
```jsx
<AreaChart data={sampledData}>
  <defs>
    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor="var(--accent-color)" stopOpacity={0.8}/>
      <stop offset="95%" stopColor="var(--accent-color)" stopOpacity={0}/>
    </linearGradient>
  </defs>
  <XAxis dataKey="date" tickFormatter={(str) => new Date(str).toLocaleDateString()} />
  <YAxis hide />
  <Tooltip content={<CustomTooltip />} />
  <Area 
    type="monotone" 
    dataKey="value" 
    stroke="var(--accent-color)" 
    fillOpacity={1} 
    fill="url(#colorValue)" 
  />
  <Area 
    type="monotone" 
    dataKey="investedAmount" 
    stroke="var(--text-secondary)" 
    fill="var(--bg-secondary)" 
    fillOpacity={0.3} 
  />
</AreaChart>
```

### Custom Tooltip
Displays:
- Date (Formatted)
- Current Value (Currency)
- Invested Amount (Currency)
- Unrealized Gain (Calculated, Colored green/red)
- Gain % (Calculated)

## Integration
- Replace the placeholder or add above the "Scheme Breakdown" in `App.tsx` (Overview tab).
- Responsive container to fill the card width.

## Testing Strategy
- **Unit Tests**: Verify sampling logic.
- **Component Tests**: Verify range buttons trigger refetch/filtering.
- **Visual**: Verify overlap transparency in light/dark modes.
