# Portfolio X-Ray Expense & Allocation Enhancements

## 1. Goal
Enhance the "Portfolio X-Ray" tab to provide deeper insights into the cost of holding the portfolio and detailed asset/category breakdowns. 

## 2. Requirements
- Show Total Fees Paid (Annualized) and Weighted Average Expense Ratio.
- Show TER (Total Expense Ratio) values and computed annualized fees for each individual mutual fund.
- Show a Category-wise fee breakdown (e.g., Active Equity, Arbitrage, Index, International).
- Present an explicit Equity/Debt breakdown and an Active/Index/Arbitrage fund category breakdown.

## 3. Architecture & Data Flow
### Backend (`xray.service.ts` & `market-data.service.ts`)
1. **Data Ingestion**: 
   - `MarketDataService.getHoldings(isin)` fetches mutual fund data from FinAPI. 
   - The FinAPI response currently contains `expenseRatio` and `schemeCategory`.
2. **Aggregation**:
   - `XRayService.getXRayData()` will be updated to extract and calculate:
     - `ter` for each fund.
     - `annualizedFee = (fund value * ter) / 100`.
     - `category`: Parsed from `schemeCategory` (e.g., identify "Index", "Arbitrage", "Sector", "Active Equity").
3. **API Response Structure (`XRayData`)**:
   - Add a new field `expenseAnalysis`:
     - `totalAnnualFees`: number
     - `weightedAvgTer`: number
     - `categoryBreakdown`: Array of `{ category, totalFees, avgTer, percentage }`
     - `fundBreakdown`: Array of `{ name, isin, category, ter, annualizedFee, value }`
   - Add/Ensure `assetAllocation` contains explicit mappings for Equity/Debt/Gold/Cash (already present, but ensure correctness for display).
   - Add a new field `fundCategoryAllocation`: 
     - Active, Index, Arbitrage, International (percentages and values).

### Frontend (`XRayView.tsx`)
1. **Expense Analysis Section**:
   - Top-level cards for Total Fees Paid and Weighted Avg Expense Ratio.
   - A grid of cards for "Fees Paid by Fund Category".
   - A table listing each fund with Name, Category, TER, and Annualized Fee.
2. **Breakdown Cards**:
   - Existing Pie Charts or new progress-bar style indicators to show Asset Class (Equity/Debt/Gold) and Fund Category (Active/Index/Arbitrage) breakdowns visually.

## 4. Edge Cases & Error Handling
- **Missing TER data**: If the API does not provide an `expenseRatio` for a specific ISIN, fallback to 0% and clearly indicate "N/A" in the UI to prevent silent calculation errors.
- **Missing Category**: Fallback to "Other" or "Uncategorized".
- **Zero Values**: Handled gracefully without division by zero (NaN protection).
- **Stocks/Bonds**: Direct stocks do not have a TER. Their TER should be 0%, and they should be categorized under "Direct Equity".

## 5. Success Criteria
- The UI accurately matches the approved mockup.
- The total annualized fees equal the sum of the individual fund fees.
- The application passes existing unit tests (NaN prevention is strictly upheld).
