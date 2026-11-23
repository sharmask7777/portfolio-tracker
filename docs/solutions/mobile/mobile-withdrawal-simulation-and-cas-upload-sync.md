---
title: "Mobile Withdrawal Simulation Action, Shared Tax Engine Parity, and CAS Upload Outbox Sync Resilience"
date: "2026-11-23"
category: "mobile"
problem_type: "architecture_pattern"
module: "mobile"
component: "tax-simulation-and-cas-upload"
tags:
  - "mobile"
  - "withdrawal-simulation"
  - "tax-parity"
  - "cas-upload"
  - "outbox-pattern"
  - "network-security"
  - "ats-configuration"
status: "verified"
applies_when:
  - "Implementing interactive redemption and withdrawal simulation on mobile folios with shared backend calculation"
  - "Maintaining cross-platform parity between Web and Mobile for capital gains tax calculations under Budget 2024"
  - "Fixing mobile outbox upload synchronization issues when backend returns 202 Accepted for asynchronous ingestion"
  - "Resolving local network IP connectivity blocks under iOS App Transport Security (ATS) and Android emulator loopbacks"
---

# Mobile Withdrawal Simulation Action, Shared Tax Engine Parity, and CAS Upload Outbox Sync Resilience

## Context & Problem Statement
During cross-platform feature parity audits between the Web client and the React Native Mobile application, two critical functional gaps and failure modes were uncovered:
1. **Missing Withdrawal Simulation Action on Mobile:** On Web, every holding and folio row provided a `<Calculator>` trigger launching a sell simulation against the unified Rust backend (`POST /api/tax/simulate-sell`). The mobile app only rendered `SimulationModal` in the Tax tab with isolated synthetic mock lots, lacking any action trigger in the Holdings screen and failing to reflect changes made in the backend calculation engine.
2. **CAS Upload Sync Failure on Reachable Endpoints:** Mobile users attempting to sync or upload CAS statements encountered silent failures or were stuck in `"Queued for upload when server reconnects"` despite being on the same local Wi-Fi network and targeting a reachable backend endpoint.

## Root Cause Analysis

### 1. CAS Upload Sync Failure
- **HTTP 202 Accepted Status Rejection:** The backend Axum API processes CAS statements asynchronously via background job queues, returning `StatusCode::ACCEPTED` (202). In `mobile/src/services/upload-queue.ts`, `executeUploadRequest` strictly asserted `res.status === 200 || res.status === 201`. Consequently, a successful 202 response was evaluated as `ok: false`, causing the outbox queue to log `Upload rejected with HTTP 202` and remain indefinitely in `PENDING` state.
- **iOS App Transport Security (ATS) Numerical IP Policy:** `mobile/app.json` specified `NSAllowsLocalNetworking: true`. Under Apple ATS policies, this allows `localhost` and `.local` mDNS domains, but silently blocks connections to raw numerical LAN IPs (e.g. `192.168.x.x`) unless `NSAllowsArbitraryLoads: true` is also configured.
- **Port Inconsistency & Loopback Normalization:** `DEFAULT_SERVER_URL` defaulted to port 8082 instead of the unified REST gateway port 8080. Furthermore, `buildUploadUrl` and `checkServerReachable` failed to route inputs through `normalizeServerUrl`, preventing Android emulator `10.0.2.2` translation.

### 2. Withdrawal Simulation Disconnection
- Mobile computed redemptions offline using a detached TypeScript module with hardcoded synthetic lots. It never leveraged the generated Rust bindings (`SimulationSellRequest`, `SimulationSellResponse`), nor did it call the backend gateway, leading to divergence whenever statutory tax rates, Section 55(2)(ac) grandfathering rules, or AMC exit load structures evolved in `portfolio-core`.

## Architectural Solutions

### 1. Robust Outbox CAS Upload & Network Resilience
- **Status Generalization:** Updated `executeUploadRequest` in `upload-queue.ts` to accept `res.status >= 200 && res.status < 300`, seamlessly handling `202 Accepted`.
- **URL Normalization Across Pipelines:** Integrated `normalizeServerUrl(serverUrl)` into `buildUploadUrl` and `checkServerReachable`, guaranteeing correct address translation on Android emulators and stripping trailing slashes.
- **ATS Configuration:** Enabled `"NSAllowsArbitraryLoads": true` in `mobile/app.json` under `ios.infoPlist.NSAppTransportSecurity`, allowing physical iOS test devices to reach local network development servers over HTTP.
- **Port Alignment:** Updated `DEFAULT_SERVER_URL` in `auth-service.ts` to `8080`.

### 2. Backend-Shared Tax Simulation Service
- **Contract Parity Service:** Created `mobile/src/services/tax-simulation-service.ts` consuming generated types `SimulationSellRequest` and `SimulationSellResponse`.
- **Online-First with Transparent Fallback:**
  1. Checks stored credentials (`getStoredCredentials()`).
  2. If online and reachable, calls `POST /api/tax/simulate-sell`.
  3. Maps response fields (`grossValue`, `totalGain`, `taxableGain`, `estimatedTax`, `exitLoad`, `matchedLots`) with zero financial delta ($\Delta \le ₹0.01$).
  4. If offline or network errors occur, falls back seamlessly to local `simulateSellRedemption()`.
- **Value Conservation:** Programmatically verifies the Value Conservation Law:
  $$\text{Gross Value} = \text{Net Proceeds} + \text{Total Tax} + \text{Exit Load}$$

### 3. Holdings UI Integration & Parity Check
- **Folio & Scheme Triggers:** Added `testID="folio-simulate-btn-${id}"` to `FolioChildRow` and `testID="scheme-simulate-btn-${id}"` to `CardSubRow` with accessible labels.
- **Modal Mounting:** Mounted `HoldingsSimulationModal` in `mobile/app/(tabs)/holdings.tsx` with asynchronous execution states and loading indicators.
- **Feature Parity Suite:** Added a dedicated test suite in `mobile/tests/mobile-feature-parity.test.ts` covering contract parity, calculation reconciliation, Budget 2024 tax rates (12.5% LTCG / 20% STCG), and action trigger parity.
- **E2E Test Coverage:** Updated `mobile/src/e2e/cas-upload-queue.test.tsx` with full online upload and sync flows verifying immediate flush and manual sync transitions.

## Verification Receipts
- **Mobile Unit & Integration Tests:** 43/43 test suites passed (435 tests), 0 failures.
- **Static Guardrails:** `pnpm --filter mobile lint`, `pnpm --filter mobile typecheck`, and `pnpm --filter mobile knip` pass with zero errors and zero warnings.
- **Frontend & Parity:** Web build and unit tests pass (29/29 suites). `cargo run --package portfolio-parity` validates 10/10 scenarios (100% equivalence).
