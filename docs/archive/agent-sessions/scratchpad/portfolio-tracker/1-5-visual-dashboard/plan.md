# Plan: Initial Visual Dashboard (MVP)

## Test Strategy
- **Component Tests**: Verify that components render correctly with mock data.
- **Integration Tests**: Verify that the dashboard fetches data from the backend and updates the UI.
- **Visual Check**: Manually verify Dark/Light mode transitions and responsiveness.

## Implementation Plan
1.  **Dependencies**:
    - Install `axios`, `recharts`, `lucide-react`.
2.  **Global Styling (`frontend/src/index.css`)**:
    - Define CSS variables for colors (Dark/Light themes), spacing, and typography.
    - Implement a basic Reset and global styles.
3.  **Components**:
    - `StatCard`: Generic card for metrics.
    - `PortfolioChart`: Wrapper for Recharts AreaChart.
    - `HoldingsTable`: Data table for schemes.
    - `UploadModal`: Component to handle PDF uploads.
4.  **Dashboard Page (`frontend/src/App.tsx`)**:
    - State management for portfolio data.
    - Fetch data from `GET /api/portfolio/summary`.
    - Handle the "Upload" flow to refresh data.
5.  **Polishing**:
    - Add loading states and empty states.
    - Ensure responsive layout (Grid/Flexbox).
