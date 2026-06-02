# Plan: Tax Dashboard & ITR Reporting

## Test Strategy
- **Visual Check**:
    - Verify progress bar reflects realized LTCG correctly.
    - Verify harvesting recommendations render actionable "Sell" targets.
    - Test the simulation flow with valid and invalid unit counts.
- **Export Test**:
    - Click "Export CSV" and verify the file structure (mock or manual).

## Implementation Plan
1.  **CSS Refinement (`frontend/src/App.css`)**:
    - Add styles for progress bars and tax tags (ST/LT).
2.  **Tax Components (`frontend/src/components/Tax/`)**:
    - `TaxView.tsx`: Container component.
    - `ExemptionTracker.tsx`: The ₹1.25L progress bar.
    - `GainsTable.tsx`: Table for realized gains.
    - `HarvestingWidget.tsx`: Displays logic from `/api/tax/harvesting-opportunities`.
3.  **Simulation Integration**:
    - Create a `SimulationModal.tsx`.
    - Add a "Simulate" icon/button to the main holdings table.
4.  **CSV Export**:
    - Implement a utility function to convert JSON gain details to CSV.
5.  **App Integration**:
    - Update `App.tsx` with a "Tax" tab and state to store tax summary data.
