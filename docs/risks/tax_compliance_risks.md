# Tax Compliance Risks

## Risks with Synthetic Anchors
The use of Synthetic Anchors to represent `OPENING_BALANCE` transactions introduces compliance risks. Because the acquisition dates and NAVs are "guessed" (based on 12% equity / 7% debt return assumptions), the calculated Long Term vs Short Term Capital Gains will not be accurate for those specific units.

## Fix Required: UI Warnings
- **Simulation Modal:** Currently, there is no warning implemented in the UI. Whenever a user runs a tax simulation or views capital gains reports that include synthetic anchor units, the UI must be updated to display a prominent warning indicating that the calculations are estimates. Users should be advised to upload a complete, from-inception CAS file for precise tax calculations.
