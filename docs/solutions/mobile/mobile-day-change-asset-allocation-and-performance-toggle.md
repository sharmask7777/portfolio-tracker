---
title: "Mobile Day Change Propagation, Granular Asset Allocation, and Performance Mode Parity"
date: "2026-11-23"
category: "mobile"
problem_type: "architecture_pattern"
module: "mobile"
component: "holdings-analytics-and-performance"
tags:
  - "mobile"
  - "day-change"
  - "asset-allocation"
  - "arbitrage"
  - "xirr-abs-toggle"
  - "sqlite-migration"
  - "multimodal-inner-loop"
status: "verified"
applies_when:
  - "Synchronizing live daily price change metrics from backend API to offline-first SQLite holdings"
  - "Preventing coarse category collapse (e.g. rogue Gold/Others fallback) and separating Arbitrage, Cash, and Market Cap tiers"
  - "Implementing cross-screen reactive performance toggle (XIRR vs. Absolute Return) across tabs and child rows"
  - "Verifying mobile UX parity with web using live Android emulator multimodal snapshot inspections"
---

# Mobile Day Change Propagation, Granular Asset Allocation, and Performance Mode Parity

## Context & Problem Statement
Following the migration to the backend SSoT, three key UX and analytical discrepancies were identified between the mobile client and the web application:
1. **Silent 0.00% Day Change:** The mobile app's Dashboard and Holdings screens displayed `₹0.00 (0.00%)` for day changes, even when the backend API calculated active market day changes. The mobile client lacked database columns and fallback propagation for folio metrics.
2. **Rogue Gold/Others Asset Collapse:** The mobile Asset Allocation card collapsed unrecognized or composite scheme categories into `Gold/Others`, showing unrealistic allocations (e.g., `Gold/Others 96.9%`), while the web view correctly segregated `Large Cap`, `Mid Cap`, `Small Cap`, `Debt`, and `Arbitrage`.
3. **Missing XIRR / ABS Toggle:** The web client allowed users to toggle between annualised rate of return (`XIRR`) and absolute return (`ABS`) on aggregate metrics and individual holding cards. The mobile client lacked this control entirely.

## Architectural Solutions

### 1. SQLite Holdings Schema Migration & Day Change Persistence
- **Schema Extension:** Updated `HoldingEntity` and `CREATE_HOLDINGS_TABLE` in `mobile/src/db/schema.ts` to persist `day_change`, `day_change_pct`, `xirr`, `absolute_return`, and `asset_category`.
- **Idempotent Safe Migration:** Added `runSafeMigrations()` in `mobile/src/db/client.ts` executing `ALTER TABLE holdings ADD COLUMN ...` defensively within try/catch blocks.
- **Repository Binding:** Updated `upsertHolding()` in `mobile/src/db/repository.ts` to map and persist all newly added columns.
- **Metric Resolution:** Enhanced `mapRawFolioToHolding()` and `resolveHoldingDayChange()` in `mobile/src/services/portfolio-calculations.ts` to inspect backend `.metrics.dayChange` and `.metrics.dayChangePercentage` first before falling back to manual NAV subtraction, eliminating false 0-value states.

### 2. Canonical Asset Classification & Dynamic Grid
- **Decoupled Classification:** Extracted `mobile/src/services/asset-classification.ts` providing `normalizeAssetClass()` with strict fallback to `Other` instead of `Gold/Others`.
- **Specialized Arbitrage Support:** Recognized `arbitrage` and `equity-savings` categories distinctly, preventing hybrid arbitrage funds from skewing pure equity or debt buckets.
- **Market Cap Section:** Added `MarketCapSection` (`Large Cap`, `Mid Cap`, `Small Cap`, `Other`) and dynamic multi-column allocation cards in `mobile/app/(tabs)/analytics.tsx` and `mobile/src/components/AssetAllocationCard.tsx`.
- **Value Conservation:** Guaranteed $\sum \text{amounts} = \text{totalValue}$ within $\le ₹0.01$.

### 3. Reactive Cross-Tab Performance Mode Toggle
- **Observer Registry:** Created `mobile/src/services/settings-service.ts` maintaining an in-memory `Set<PerformanceModeListener>()` with persistent storage via `AsyncStorage` / SQLite.
- **Hook Integration:** `usePerformanceMode()` provides instant, synchronous updates across Expo Router tabs without requiring unmount/remount cycles.
- **UI Components:** Created `PerformanceModeToggle` (`mobile/src/components/Common/PerformanceModeToggle.tsx`) with accessible touch targets ($\ge 44\text{pt}$), integrated into `NetWorthCard` and `HoldingsControls`.
- **Rate Standardization:** Normalized XIRR rates as decimals ($0.1364$), uniformly applying $r \times 100$ in display formatters and adding a defensive fallback label `Total Gain (ABS)` when XIRR is mathematically undefined.

## Verification & Parity Receipts
- **Multimodal Android Emulator Verification:** Verified on live Android Emulator (`emulator-5554`) across Dashboard, Holdings, and Analytics tabs (`live-unlocked.png`, `live-dashboard-toggled-abs.png`, `live-holdings-child-rows.png`).
- **Static Guardrails:** Passes `pnpm --filter mobile build:verify` with 0 lint warnings, 0 type errors, 0 knip dead code issues, and all maintainability sensors satisfied (lines $\le 300$, complexity $\le 10$).
- **Parity Invariants:** Passed `pnpm parity:check` (8/8 domains) and `pnpm parity:visual` (10/10 invariants).
