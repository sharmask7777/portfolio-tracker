# Spec: ITR Report Export Empty State Behavior

**Date:** 2026-07-05
**Status:** Approved

## Goal
Fix the behavior of the "Export ITR Report (CSV)" button when clicked on an account/financial year with zero realized gains (LTCG and STCG are both zero).

## User Review Required
None. The behavior has been aligned to display a browser alert.

## Design Details

### Component: `TaxView.tsx`

We will modify `exportCSV` in [TaxView.tsx](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/frontend/src/components/Tax/TaxView.tsx):
- Currently:
  ```typescript
  const exportCSV = () => {
    if (filteredDetails.length === 0) return;
    ...
  ```
- Change:
  ```typescript
  const exportCSV = () => {
    if (filteredDetails.length === 0) {
      alert("No realized gains found for this period to export.");
      return;
    }
    ...
  ```

### Styling: `App.css`

We will add styling for disabled buttons in [App.css](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/frontend/src/App.css):
```css
.btn:disabled, button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}
```

## Verification Plan

### Manual Verification
1. Open the application.
2. Navigate to the Tax tab/page.
3. Select a Financial Year that has no transactions (zero LTCG/STCG).
4. Click the "Export ITR Report (CSV)" button.
5. Verify that a native browser alert is displayed with: `"No realized gains found for this period to export."`
