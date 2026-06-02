# Plan: Advanced Visualizations (Frontend)

## Test Strategy
- **Visual Check**:
    - Verify charts render correctly with actual API data.
    - Verify Treemap handles different sector sizes.
    - Verify tab switching is smooth.
- **Responsiveness**:
    - Check layout on mobile/tablet.

## Implementation Plan
1.  **Tab Navigation**:
    - Update `App.tsx` to handle `activeTab` state ("overview", "xray", "intersection").
    - Add a tab bar below the header.
2.  **X-Ray View**:
    - Create `XRayView` component.
    - Implement `SectorTreemap` using Recharts `<Treemap>`.
    - Implement `MarketCapChart` using Recharts `<BarChart>`.
    - Implement `AssetAllocationChart` using Recharts `<PieChart>`.
3.  **Intersection View**:
    - Create `IntersectionView` component.
    - Fetch data from `/api/portfolio/:id/exposures`.
    - Build a table showing stock name, total %, and a "contribution" breakdown.
4.  **Refactoring**:
    - Move `App.tsx` sub-sections into dedicated components for better maintainability.
5.  **Polishing**:
    - Add tooltips and legends to charts.
    - Ensure color consistency across themes.
