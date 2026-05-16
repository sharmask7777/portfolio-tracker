# Phase 3, Task 3: Tax Harvesting Engine

## Objective
Implement an automated tool to identify LTCG harvesting opportunities.

## Given
*   Realized LTCG for the current financial year.
*   Unrealized LTCG across all equity holdings.

## When
1.  Implement a `HarvestingService`.
2.  Calculate the remaining "Tax-Free LTCG Limit" (₹1.25 Lakh minus already realized LTCG).
3.  Scan all equity mutual funds/stocks for units held > 1 year with unrealized gains.
4.  Recommend specific "Sell and Buy" transactions to utilize the limit without changing the portfolio composition (harvesting).
5.  Generate a "Tax Plan" for the user to execute before March 31st.

## Then
*   The dashboard should display a "Harvesting Opportunity" alert if the user has unused tax-exempt limits.
