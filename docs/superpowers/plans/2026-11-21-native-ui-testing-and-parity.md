# Native UI Testing, Local Emulation, and Visual Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide an automated native UI testing pipeline (using Maestro on the booted Android Studio emulator) that captures real screenshots, verifies cross-platform visual parity with Web, and enables effortless local emulation via direct Email/Password login.

**Architecture:**
1. **Mobile Credential Authentication:** Add `loginWithCredentials` to `mobile/src/services/auth-service.ts` and `CredentialLoginForm` to `mobile/app/(auth)/pair.tsx` so users and automated flows can authenticate directly against `/api/auth/login` without requiring physical camera QR scanning.
2. **History Caching Parity:** Fix `portfolio_history` database query in `mobile/src/db/history-repository.ts` so historical timeline points cached during server sync reliably render across all 7 range presets in the mobile dashboard chart.
3. **Native UI Testing Pipeline (Maestro):** Create executable Maestro test flows (`mobile/e2e/flows/`) and runner scripts (`mobile/scripts/run-native-e2e.sh`) to exercise credential login, scope selection, historical chart interaction, and asset allocation on the live Android emulator.
4. **Visual Parity Inner Loop & Screenshot Comparison:** Capture matching full-screen captures from Playwright (Web) and Maestro/ADB (Mobile), run automated visual invariant assertions, and generate comparative side-by-side evidence before merge.

**Tech Stack:**
- React Native / Expo 58 / Expo Router
- Maestro 2.12.1 for Native Mobile UI E2E Automation
- Android Debug Bridge (ADB) & Android Emulator (API 37 / Pixel 6)
- Playwright for Web UI Automation
- SQLite (`expo-sqlite`) for offline mobile caching
- Rust (`portfolio-api`, `portfolio-core`) for backend SSoT APIs

---

## Global Constraints

- **Invariant Oracle Law:** Never relax numerical bounds ($\Delta \le ₹0.01$, XIRR $\Delta \le 10^{-6}$) or modify golden tax vectors.
- **Zero-Any Rule:** Strictly forbidden to use `any` in TypeScript (`frontend/`, `mobile/`, `packages/`).
- **Fowler Complexity Sensors in Mobile:** Function complexity $\le 10$, lines $\le 50$, file lines $\le 300$, parameters $\le 3$.
- **Zero Real PII Mandate:** Only synthetic test identifiers permitted.
- **No Merges Without Native Verification:** Every change must be validated against the live Android emulator UI before merge.

## Review Focus

1. **Emulator Networking:** Android emulator maps host `localhost:8080` to `10.0.2.2:8080`. Default server URL in mobile login must resolve `10.0.2.2:8080` when running inside Android emulator.
2. **History Point Isolation:** Multiple portfolios in SQLite must not collide, and default lookups must cleanly resolve the active portfolio history.
3. **Status Bar & Notch Ergonomics:** ScopeSelectorHeader must maintain safe area top padding ($\ge 38$px) without overlapping status bar icons on real device displays.
4. **Asset Categorization SSoT:** Asset allocation card must render canonical categories (`Equity`, `Debt`, `Hybrid`, `Gold`, `Cash`, `Arbitrage`, `Other`), never collapsing into `'Gold/Others'`.
5. **Headless & CI Compatibility:** The native runner must run seamlessly both interactively and headlessly in CI.

---

## Tasks

### Task 1: Add Direct Email & Password Login to Mobile

**Files:**
- Create: `mobile/src/components/Auth/CredentialLoginForm.tsx`
- Modify: `mobile/src/services/auth-service.ts`
- Modify: `mobile/app/(auth)/pair.tsx`
- Test: `mobile/src/services/auth-service.test.ts`
- Test: `mobile/tests/credential-login.test.tsx`

- [ ] **Step 1: Write unit tests for `loginWithCredentials` in `mobile/src/services/auth-service.test.ts`**
  - Test valid email/password exchange against `/api/auth/login`.
  - Test server error (401 invalid credentials) handling.
  - Test saving credentials and server URL to `SecureStore`.
- [ ] **Step 2: Implement `loginWithCredentials` in `mobile/src/services/auth-service.ts`**
  - Signature: `loginWithCredentials(serverUrl: string, email: string, password: string): Promise<UserResponse>`.
  - Normalize URL; default empty URL to `http://10.0.2.2:8080` (or `http://localhost:8080`).
  - Send `POST /api/auth/login`, parse response, call `saveStoredCredentials(serverUrl, token, user)`.
- [ ] **Step 3: Build `mobile/src/components/Auth/CredentialLoginForm.tsx`**
  - Form inputs with testIDs: `login-server-url-input`, `login-email-input`, `login-password-input`, `login-submit-button`, `login-error-text`.
  - Maintain Fowler metrics ($\le 3$ params, complexity $\le 10$, lines $\le 50$ per function).
- [ ] **Step 4: Update `mobile/app/(auth)/pair.tsx` with Mode Switcher**
  - Add segmented mode toggle: `['Scan QR', 'Email Login', 'Pairing Code']`.
  - Mount `CredentialLoginForm` when 'Email Login' is active.
  - On login success: invoke `refreshPortfolio()`, then navigate to `/(tabs)/`.
- [ ] **Step 5: Run unit tests and verify**
  - Run `pnpm --filter mobile test:unit`.
  - Commit: `feat(mobile): add direct email and password login for local emulation and testing`.

---

### Task 2: Fix Portfolio History SQLite Lookup & Dashboard Cache Resolution

**Files:**
- Modify: `mobile/src/db/history-repository.ts`
- Modify: `mobile/src/services/history-service.ts`
- Modify: `mobile/app/(tabs)/index.tsx`
- Test: `mobile/src/db/repository.test.ts`
- Test: `mobile/tests/historical-chart-parity.test.tsx`

- [ ] **Step 1: Write test reproducing empty history when `portfolioId` defaults**
  - Save history for portfolio `'port-real-123'`.
  - Call `getPortfolioHistory(db, 'default')` and verify it falls back to the first available portfolio if `'default'` has no rows.
- [ ] **Step 2: Update `getPortfolioHistory` SQL query in `mobile/src/db/history-repository.ts`**
  - Query:
    ```sql
    SELECT portfolio_id, date, value, invested_amount
    FROM portfolio_history
    WHERE portfolio_id = ?
       OR portfolio_id = (SELECT id FROM portfolios LIMIT 1)
    ORDER BY date ASC;
    ```
- [ ] **Step 3: Update `useDashboardData` in `mobile/app/(tabs)/index.tsx`**
  - Pass the active portfolio ID when loading cached history.
- [ ] **Step 4: Verify with unit tests**
  - Run `pnpm --filter mobile test:unit`.
  - Commit: `fix(mobile): resolve cached history points across active and default portfolio ids`.

---

### Task 5: Build Maestro Native UI Test Flows & Local Emulation Runner

**Files:**
- Create: `mobile/e2e/flows/01-credential-login.yaml`
- Create: `mobile/e2e/flows/02-dashboard-parity.yaml`
- Create: `mobile/scripts/run-native-e2e.sh`
- Modify: `mobile/package.json`

- [ ] **Step 1: Create Maestro Login Flow (`01-credential-login.yaml`)**
  - Launches app `com.portfolio.mobile`.
  - Switches to Email Login tab.
  - Inputs `http://10.0.2.2:8080`, `admin@example.com`, `password123`.
  - Taps Login and asserts Dashboard header appears.
  - Takes screenshot: `mobile/e2e/screenshots/01-login-success.png`.
- [ ] **Step 2: Create Maestro Dashboard Parity Flow (`02-dashboard-parity.yaml`)**
  - Verifies ScopeSelectorHeader has top padding and no status bar overlap.
  - Takes screenshot: `mobile/e2e/screenshots/02-scope-selector.png`.
  - Verifies historical trend chart with 7 range buttons.
  - Taps range buttons (`1M`, `6M`, `1Y`, `ALL`) and verifies chart re-renders.
  - Takes screenshot: `mobile/e2e/screenshots/03-historical-chart.png`.
  - Scrolls to Asset Allocation Card; verifies categories: `Equity`, `Debt`, `Hybrid`, `Gold`, `Cash`, `Arbitrage`, `Other` (no `'Gold/Others'`).
  - Takes screenshot: `mobile/e2e/screenshots/04-asset-allocation.png`.
- [ ] **Step 3: Implement `mobile/scripts/run-native-e2e.sh`**
  - Checks if Android emulator is running; if not, starts `emulator -avd Medium_Phone_API_37.0 -no-window -no-audio`.
  - Waits for `adb shell getprop sys.boot_completed`.
  - Runs Maestro test flows against the emulator.
  - Pulls captured screenshots to `mobile/e2e/screenshots/`.
- [ ] **Step 4: Add npm script in `mobile/package.json`**
  - `"test:e2e:native": "bash scripts/run-native-e2e.sh"`.
- [ ] **Step 5: Execute native E2E test on live emulator**
  - Run script, inspect logs, confirm test passes.
  - Commit: `test(mobile): add native maestro e2e test flows and emulator automation runner`.

---

### Task 4: Web vs Mobile Visual Comparison & Screenshot Parity Report

**Files:**
- Create: `scripts/compare-web-mobile-ui.ts`
- Create: `frontend/tests/capture-web-screenshots.spec.ts`
- Modify: `scripts/pre-merge-check.sh`

- [ ] **Step 1: Create Playwright Web Screenshot Capture Test**
  - In `frontend/tests/capture-web-screenshots.spec.ts`, log in, capture:
    - `screenshots/web-dashboard-overview.png`
    - `screenshots/web-historical-chart.png`
    - `screenshots/web-asset-allocation.png`
    - `screenshots/web-scope-selector.png`
- [ ] **Step 2: Build Visual Comparison & Parity Verifier (`scripts/compare-web-mobile-ui.ts`)**
  - Checks that matching screenshots exist for both Web and Mobile.
  - Validates visual invariants:
    1. Scope selector / member list: no `ABCDE1234F` dummy profile.
    2. Status bar padding: mobile header has proper top inset.
    3. Historical chart: 7 range options on both web and mobile.
    4. Asset allocation: canonical labels match web SSoT.
  - Generates Markdown comparison report artifact with side-by-side images.
- [ ] **Step 3: Update `scripts/pre-merge-check.sh`**
  - Make native UI verification and visual comparison a mandatory pre-merge gate.
- [ ] **Step 4: Verify and commit**
  - Commit: `ci(parity): add automated web and mobile visual screenshot comparison gate`.

---

### Task 5: Staff Systems & Architecture Review & Verification

- [ ] **Step 1: Run Full Verification Pipeline**
  - Backend: `./scripts/verify.sh`
  - Frontend: `pnpm --filter frontend build:verify && pnpm --filter frontend test:unit`
  - Mobile: `pnpm --filter mobile build:verify && pnpm --filter mobile test:e2e`
  - Native UI: `pnpm --filter mobile test:e2e:native`
  - Parity check: `pnpm parity:check`
- [ ] **Step 2: Invoke Staff Systems & Architecture Auditor Subagent**
  - Review all changes and visual comparison artifacts.
- [ ] **Step 3: Rebase and Fast-Forward Merge to `main`**
