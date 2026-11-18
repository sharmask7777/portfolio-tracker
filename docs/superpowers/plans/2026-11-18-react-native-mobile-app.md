# React Native Mobile App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cross-platform React Native (Expo) mobile client for iOS and Android that pairs with the self-hosted portfolio server via QR code, supports local biometric lock, persists a local SQLite snapshot for offline use, fetches direct public daily NAV prices, stages/uploads CAS statement PDFs, enforces Fowler Maintainability Sensors, and provides verifiable cross-platform E2E tests for iOS and Android.

**Architecture:** A native React Native app (`mobile/`) configured with Expo Router and `expo-sqlite` for offline persistence. Reuses generated TypeScript contracts from `backend-rs` (`portfolio-api`) and fetches public mutual fund NAVs directly via `api.mfapi.in`. Pairs with the backend via QR code token exchange and secures stored tokens using `expo-secure-store` and `expo-local-authentication`. Enforces strict complexity, line length, parameter caps, and boundary rules via ESLint maintainability sensors.

**Tech Stack:** React Native, Expo SDK, Expo Router, TypeScript, `expo-sqlite`, `expo-secure-store`, `expo-local-authentication`, `expo-document-picker`, `@tanstack/react-query`, Tailwind/NativeWind, Maestro E2E, Vitest, React Native Testing Library.

**Spec:** [`docs/superpowers/specs/2026-11-18-react-native-mobile-app-design.md`](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/.worktrees/feat-mobile-app/docs/superpowers/specs/2026-11-18-react-native-mobile-app-design.md)

---

## Global Constraints & Mandates
- **Fowler Maintainability Sensors:**
  - Cyclomatic complexity $\le 10$ (`complexity: ["error", 10]`)
  - Function length $\le 50$ lines (`max-lines-per-function: ["error", { max: 50 }]`)
  - Function parameters $\le 3$ (`max-params: ["error", 3]`)
  - File length $\le 300$ lines (`max-lines: ["error", { max: 300 }]`)
  - Zero-Any Rule: `no-explicit-any: "error"`
  - Architectural Boundaries: `eslint-plugin-boundaries` strictly isolating UI, Services, DB, and Generated Types.
  - Dead-Code Sensor: `knip --production` must pass with zero unused files or exports.
- **Contract Parity & Drift Check:** Shared types generated via `backend-rs` (`export_bindings`).
- **Offline First:** Cold startup must render from local SQLite storage without blocking on network.
- **Privacy & Anti-PII:** No real PANs or PII in test fixtures or logs; synthetic test data only.
- **Hermetic Testing:** Every task includes automated tests with verifiable assertions.

---

## Implementation Tasks

### Task 1: Backend Pairing Endpoints & Contract Generation in `backend-rs`
- [ ] Add device pairing token generation in `portfolio-api` (`POST /api/v1/auth/pair/init` returning pairing secret + expiration).
- [ ] Add device pairing redemption in `portfolio-api` (`POST /api/v1/auth/pair/claim` exchanging pairing secret for long-lived device token).
- [ ] Update `backend-rs/crates/portfolio-api/tests/export_bindings.rs` to export mobile-specific pairing contracts into `mobile/src/types/generated/`.
- [ ] Run `(cd backend-rs && ./scripts/verify.sh)` to ensure Zero-I/O and hermetic backend verification pass.

### Task 2: Web Dashboard "Pair Mobile App" QR Code Modal
- [ ] Create `PairMobileModal.tsx` in `frontend/src/components/` rendering a QR code containing `{ serverUrl, pairingSecret, expiresAt }`.
- [ ] Add pairing trigger button in Web Settings / Profile page.
- [ ] Add unit tests in `frontend/src/components/` verifying modal state and expiration countdown.
- [ ] Verify `pnpm --filter frontend build:verify`.

### Task 3: Expo Workspace Scaffolding with Fowler Maintainability Sensors
- [ ] Initialize `mobile/` with Expo SDK, TypeScript, Expo Router, and NativeWind.
- [ ] Configure `mobile/eslint.config.js` with maintainability sensors:
  - Cyclomatic complexity cap: 10
  - Max function lines: 50
  - Max parameters: 3
  - File line cap: 300
  - Architectural boundary rules (`eslint-plugin-boundaries`)
- [ ] Configure `mobile/tsconfig.json` (`strict: true`, `noImplicitAny: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`).
- [ ] Configure `mobile/knip.json` for production dead code checks.
- [ ] Install packages: `expo-sqlite`, `expo-secure-store`, `expo-local-authentication`, `expo-camera`, `expo-document-picker`, `@tanstack/react-query`.
- [ ] Verify `pnpm --filter mobile lint && pnpm --filter mobile typecheck && pnpm --filter mobile knip`.

### Task 4: Local Storage Engine & SQLite Database Layer
- [ ] Implement `mobile/src/db/schema.ts` with tables: `portfolios`, `folios`, `holdings`, `nav_history`, `transactions`, `sync_queue`.
- [ ] Implement repository helpers (`mobile/src/db/repository.ts`) with small, focused functions adhering to complexity caps.
- [ ] Write unit tests for local SQLite CRUD operations, holdings upsert, and offline fallback queries.
- [ ] Ensure all code passes `eslint` maintainability sensors.

### Task 5: Direct Public NAV Price Fetcher Service
- [ ] Implement `mobile/src/feeds/nav-fetcher.ts` querying public endpoints (`api.mfapi.in/mf/<amfi_code>`).
- [ ] Implement valuation calculator: `current_value = units * latest_nav`, calculating day's gain/loss against previous close.
- [ ] Write unit tests with mock HTTP responses testing NAV updates, network retries, and offline caching.
- [ ] Ensure sensor compliance (complexity $\le 10$, max function lines $\le 50$).

### Task 6: Authentication & Pairing Flow (QR Scan + Biometric Lock)
- [ ] Implement `mobile/src/services/auth-service.ts` using `expo-secure-store` to store server URL and device token.
- [ ] Implement QR scanner screen `mobile/app/(auth)/pair.tsx` with camera permission handling.
- [ ] Implement biometric lock screen `mobile/app/(auth)/lock.tsx` using `expo-local-authentication`.
- [ ] Write unit tests testing token exchange, secure storage failure states, and biometric pass/fail flows.

### Task 7: Offline-First Portfolio Dashboard & Holdings Screens
- [ ] Implement `mobile/app/(tabs)/index.tsx` (Dashboard): Net Worth card, Day's Gain/Loss, Asset Allocation summary.
- [ ] Implement `mobile/app/(tabs)/holdings.tsx` (Holdings list): Scheme list grouped by asset class, units, current value, and day's return.
- [ ] Implement pull-to-refresh: checks if server is reachable to sync full snapshot; if unreachable, refreshes public NAVs directly.
- [ ] Write component tests for Dashboard and Holdings in both online and offline states using `@testing-library/react-native`.

### Task 8: Mobile CAS PDF Picker & Sync Outbox Queue
- [ ] Implement `mobile/app/cas-upload.tsx` with `expo-document-picker` to select CAS PDF and securely capture PDF password.
- [ ] Implement sync queue runner (`mobile/src/services/upload-queue.ts`):
  - If online: dispatches multipart upload to `portfolio-api`.
  - If offline: stores file & encrypted password in queue table with status `PENDING_UPLOAD`.
- [ ] Add status feedback UI showing upload progress and background worker ingestion results.
- [ ] Write unit tests testing outbox queuing, online flush, and error retry handling.

### Task 9: Cross-Platform Mobile E2E Testing (Maestro for iOS & Android)
- [ ] Create `mobile/e2e/config.yaml` configuring target application IDs for iOS (`com.portfolio.mobile`) and Android (`com.portfolio.mobile`).
- [ ] Implement `mobile/e2e/flows/01-pair-device.yaml`:
  - Launch app in unpaired state $\to$ verify QR scan prompt $\to$ simulate pairing token submission $\to$ assert dashboard visible.
- [ ] Implement `mobile/e2e/flows/02-offline-navigation.yaml`:
  - Simulate offline mode $\to$ launch app $\to$ assert local SQLite cached net worth and holdings render in $<100$ms without network error.
- [ ] Implement `mobile/e2e/flows/03-cas-upload-queue.yaml`:
  - Pick sample CAS PDF $\to$ enter password $\to$ verify queued status $\to$ simulate online transition $\to$ assert sync success toast.
- [ ] Add `pnpm --filter mobile test:e2e` script and CI workflow integration in `.github/workflows/e2e.yml`.

### Task 10: Hermetic Verification, Gate Checks & Documentation
- [ ] Run backend verification: `(cd backend-rs && ./scripts/verify.sh)`.
- [ ] Run web frontend verification: `pnpm --filter frontend build:verify && pnpm --filter frontend test:unit`.
- [ ] Run mobile verification: `pnpm --filter mobile lint && pnpm --filter mobile typecheck && pnpm --filter mobile knip && pnpm --filter mobile test:unit`.
- [ ] Write `mobile/README.md` documenting architecture, sensor thresholds, Maestro E2E test execution, and iOS/Android build steps.
