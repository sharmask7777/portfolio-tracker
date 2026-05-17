# Project Setup

**Name:** Portfolio Tracker
**Description:** A comprehensive, "deep" portfolio tracking and analytics platform for Indian investors. It imports data primarily via CAMS/Karvy Consolidated Account Statements (CAS) and provides advanced analytics inspired by Kuvera (pre-Cred), Value Research Online Premium, Morningstar Premium, and MProfit.

## Status
*   **v1.0 Milestone:** Shipped (Core tracking, Tax Engine, PBT verification).
*   **v2.0 Milestone:** In Planning (Dynamic returns, Post-Tax XIRR, E2E Testing).

## v2.0 Goals
1.  **Dynamic Return Toggles:** Allow users to swap between XIRR and Absolute Returns across all dashboard views.
2.  **Post-Tax XIRR:** Implement a specialized "Post-Tax XIRR" column that accounts for estimated tax liability on unrealized gains to show a truer "money-in-pocket" return.
3.  **E2E UI Testing:** Implement a comprehensive End-to-End test suite for the frontend (using Playwright or Cypress) to ensure UI stability across major user flows.

## Core Vision
To provide a highly visual, investor-first dashboard that not only tracks multi-asset portfolios but also offers deep diagnostic tools (like portfolio X-Ray and stock intersection), tax optimization strategies (tax harvesting, switch analysis), and precise performance metrics (XIRR, CAGR, MWRR).

## Target Audience
Retail investors, HNIs, and power users in India who require granular insights into their mutual funds, stocks, and fixed-income assets without the clutter of "gamified" behavioral finance apps.

## Tech Stack
*   **Frontend:** React (TypeScript) with Vanilla CSS. Focus on a highly visual, clean, data-dense dashboard (similar to a modern SaaS or Bloomberg Terminal light/dark mode).
*   **Backend:** Node.js (Express) with TypeScript.
*   **Database:** PostgreSQL (for relational data like users, portfolios, and transaction logs) and Redis (for caching market data).
*   **Data Processing:** Python microservice or Node.js scripts for robust parsing of CAMS CAS PDFs/Excel files.
*   **Market Data APIs:** Integration with Yahoo Finance, CoinGecko, or specialized Indian market APIs (e.g., historical NAVs from AMFI).

## Key Differentiators
1.  **Deep Analytics over Basic Tracking:** Moving beyond simple absolute returns to offer XIRR, CAGR, and Portfolio X-Ray.
2.  **Tax-First Approach:** Built-in tools for LTCG tax harvesting and evaluating the exact tax implications of selling or switching funds.
3.  **True Exposure Analysis:** Uncovering hidden stock overlaps and sector concentration across multiple mutual funds.
