# Requirements Document

## 1. Data Ingestion & Management
*   **CAS Parsing:** The system MUST allow users to upload CAMS/Karvy Consolidated Account Statements (CAS) in PDF or Excel format.
*   **Automated Transaction Processing:** The parser MUST accurately extract transactions (purchases, redemptions, SIPs, dividends, bonus units) across mutual funds and equities.
*   **Family Accounts:** The system SHOULD support grouping multiple individual portfolios (folios) into a single "Family Net Worth" view while maintaining legal ownership separation.

## 2. Core Tracking & Performance Metrics
*   **Multi-Asset Support:** Track Mutual Funds, Indian Equities, and Fixed Deposits/EPF.
*   **Return Calculations:** The system MUST calculate exact XIRR (Extended Internal Rate of Return) and CAGR (Compound Annual Growth Rate) at the asset, folio, and consolidated portfolio levels.
*   **Benchmarking:** The dashboard SHOULD allow comparing portfolio performance against standard Indian indices (Nifty 50, Nifty Next 50).

## 3. Deep Analytics (Morningstar & Value Research Inspired)
*   **Portfolio X-Ray:** The system MUST provide a breakdown of the overall portfolio by Asset Allocation (Equity, Debt, Cash), Market Cap (Large, Mid, Small), and Sector weightings.
*   **Stock Intersection (Overlap Analysis):** The system MUST analyze underlying holdings of all mutual funds to reveal true exposure to individual stocks (e.g., showing total % allocation to Reliance Industries across 5 different mutual funds).
*   **Valuation Metrics:** The dashboard SHOULD display aggregate P/E and P/B ratios for the equity portion of the portfolio.

## 4. Tax Optimization & Compliance (Kuvera & MProfit Inspired)
*   **Tax Implications Engine:** Before a user logs a simulated "sell" or "switch" transaction, the system MUST calculate the exact estimated Short-Term Capital Gains (STCG) and Long-Term Capital Gains (LTCG) tax, accounting for grandfathering rules.
*   **Tax Harvesting Tool:** The system SHOULD actively identify opportunities to sell and immediately reinvest equity mutual funds to utilize the ₹1.25 lakh (current budget) annual tax-exempt limit on LTCG.
*   **Capital Gains Reporting:** The system MUST generate ITR-ready capital gains reports for the financial year.

## 5. Visual Dashboard
*   **UI/UX:** A highly visual, data-dense, yet clean interface using Vanilla CSS. Must support Dark/Light modes.
*   **Interactive Charts:** Use robust charting libraries (e.g., Recharts or Chart.js) to visualize portfolio growth over time vs. invested capital.
