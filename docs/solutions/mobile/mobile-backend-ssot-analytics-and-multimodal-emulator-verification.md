---
title: "Mobile-Backend SSoT Synchronization, Tax Dropdown Redesign, and Multimodal Emulator Inner Dev Loop"
date: "2026-11-22"
category: "mobile"
problem_type: "architecture_pattern"
module: "mobile"
component: "analytics-and-tax-ssot"
tags:
  - "mobile"
  - "ssot"
  - "stock-overlap"
  - "xray"
  - "tax-fy-picker"
  - "maestro-e2e"
  - "multimodal-inner-loop"
  - "zero-pii"
status: "verified"
applies_when:
  - "Migrating client-side analytics or mock blueprints to central backend REST API Single Source of Truth"
  - "Redesigning financial year selection in mobile tax modules to comply with accessibility and modal standards"
  - "Establishing automated native mobile emulation (Android Emulator & iOS Simulator) with zero-PII synthetic data"
  - "Running an agentic inner development loop with multimodal screenshot verification and Maestro E2E test flows"
---

# Mobile-Backend SSoT Synchronization, Tax Dropdown Redesign, and Multimodal Emulator Inner Dev Loop

## Context & Problem Statement
When extending the portfolio tracker from web to mobile, discrepancies emerged between the web app and the mobile client:
1. **Stock Overlap Discrepancy:** The mobile app relied on a static 5-stock client blueprint (`TOP_STOCKS_BLUEPRINT` in `analytics-service.ts`) instead of querying the backend SSoT endpoints (`/api/portfolio/:id/exposures` and `/api/portfolio/:id/xray`). As a result, users saw inaccurate company counts and wrong sector/stock distributions.
2. **Tax FY Chip Banner:** The Tax tab displayed Financial Years as a horizontally scrolling chip bar, which caused ergonomic issues on small devices and lacked structured modal accessibility.
3. **Local Testing & Credential Emulation Friction:** The app lacked an automated local runner for iOS Simulator and Android Emulator, and typing credentials manually in emulators was tedious.
4. **Visual Regression Blindspots:** Relying solely on headless unit tests failed to catch UI clipping, layout shifts, or modal presentation errors on real mobile screens.

## Architectural Solutions

### 1. SQLite Analytics Table & Server SSoT Synchronization
To maintain the offline-first architecture while eliminating analytical drift:
- Added `portfolio_analytics` table in SQLite (`mobile/src/db/schema.ts`) storing exposures, stock overlap, and sector distributions as JSON payloads tagged with `portfolio_id` and `synced_at`.
- Implemented `syncPortfolioAnalyticsFromServer` (`mobile/src/services/analytics-sync-service.ts`) which queries `/api/portfolio/:id/exposures` and `/api/portfolio/:id/xray` upon login and tab mount.
- Extracted `fetchEndpointText` and modular parsing routines to guarantee Martin Fowler sensor compliance (function lines $\le 50$, complexity $\le 10$).
- Standardized decimal percentage conversion (`pct <= 1 && pct > 0 ? pct * 100 : pct`), resolving unit mismatches between backend decimal fractions (e.g. `0.8188`) and display percentages (`81.9%`).

### 2. Accessible FY Dropdown Modal Picker
- Replaced the horizontal chip banner with `FYDropdownPicker` (`mobile/src/components/Tax/FYDropdownPicker.tsx`) and `FYDropdownModal`.
- Tapping `testID="fy-dropdown-button"` opens a slide-up modal listing available financial years with active checkmark indicators.
- Selecting a financial year updates the active tax year in state, triggering dynamic recalculation of Advance Tax Table F, Section 112A/111A/50AA thresholds, and quarterly gain buckets.

### 3. Master Edge-Case Synthetic Dataset (Zero PII)
- Created [`scripts/seed_master_synthetic_dataset.sql`](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/scripts/seed_master_synthetic_dataset.sql) seeding user `synthetic.master@example.com` (`password123`) into PostgreSQL.
- Codifies 10 core financial edge cases:
  - Multi-folio/multi-PAN scheme consolidation
  - Zero-holding / fully redeemed isolation
  - Partial redemption FIFO cost matching
  - Multi-year capital gains (FY 2023-24 & FY 2024-25)
  - Section 112A grandfathering (Jan 31, 2018 FMV deemed cost)
  - ELSS 3-year statutory lock-in
  - Section 50AA debt slab taxation
  - Alternative assets (SGB and REIT)
  - Family trust multi-member profile management
  - Multi-fund stock overlap across 18 underlying portfolio companies

### 4. Interactive Android & iOS Local Emulation Scripts
- Added `scripts/emulate-android.sh` and `scripts/emulate-ios.sh` at repository root (with `pnpm run emulate:android` and `pnpm run emulate:ios`).
- Automates device boot, Docker backend connectivity check (`http://localhost:8082`), native artifact compilation, installation, and app launch.
- Prefilled `CredentialLoginForm` with master synthetic credentials for single-tap login on emulators.

### 5. Multimodal Agent Inner Dev Loop & Maestro E2E
- Codified Mandate 8 in [`AGENTS.md`](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/AGENTS.md): every code change must execute an inner dev loop that captures screenshots (`adb exec-out screencap -p` or Maestro screenshots) and performs multimodal visual inspection for clipping, layout, and contrast before closing out.
- Created and verified Maestro flows (`01-credential-login.yaml`, `02-dashboard-parity.yaml`, `04-analytics-tax-ssot.yaml`) running live on the Android emulator.

## Verification & Parity Results
- **Unit Tests:** 34/34 test files passed, 351/351 tests passed with coverage gates exceeded.
- **Backend Verification:** `backend-rs/scripts/verify.sh` passed all 9 stages (10/10 parity scenarios passed, $\Delta \le 0.01$).
- **Cross-Platform Parity:** `scripts/verify-web-mobile-parity.ts` verified 100% parity across all 8 core domains.
- **Visual Invariants:** `scripts/compare-web-mobile-ui.ts` verified all 6 invariants (`INV-01` through `INV-06`).
