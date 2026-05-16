# Project Roadmap

## Phase 1: Foundation & Data Ingestion (MVP)
**Goal:** Build the core engine to ingest CAMS data and calculate basic performance metrics.
*   Set up the frontend (React) and backend (Node.js) repositories.
*   Implement the CAMS CAS (PDF/Excel) parsing engine.
*   Design the database schema for Users, Portfolios, Assets, and Transactions.
*   Implement core calculations: Absolute Return, CAGR, and XIRR.
*   Build the basic highly-visual dashboard to display the parsed portfolio.

## Phase 2: Deep Analytics & Overlap
**Goal:** Implement Morningstar/Value Research-style "X-Ray" features.
*   Integrate a market data API (e.g., AMFI for mutual fund NAVs, Yahoo Finance for underlying stock data).
*   Develop the "Stock Intersection" engine to calculate overlapping holdings across mutual funds.
*   Build the "Portfolio X-Ray" view (Asset Allocation, Market Cap, Sector Breakdown).
*   Implement aggregate valuation metrics (P/E, P/B).

## Phase 3: Tax Engine & Optimization
**Goal:** Replicate the beloved Kuvera/MProfit tax tools.
*   Develop the Capital Gains calculator (STCG, LTCG, indexation, grandfathering logic).
*   Build the "Tax Implications" pre-trade analyzer (TradeSmart equivalent).
*   Implement the automated "Tax Harvesting" recommendation engine.
*   Generate ITR-ready Capital Gains export reports.

## Phase 4: Polish & Advanced Features
**Goal:** Enterprise-grade features and UI refinements.
*   Implement Family Accounts (grouping multiple PANs/folios).
*   Add tracking for Alternative Assets (EPF, PPF, SGBs, Digital Gold).
*   Implement goal-based tracking and portfolio health checks.
*   Final UI/UX polish, animations, and responsive design optimization.
