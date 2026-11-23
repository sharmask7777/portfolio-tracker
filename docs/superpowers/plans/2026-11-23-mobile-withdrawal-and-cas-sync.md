# Mobile Withdrawal Simulation & CAS Upload Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the missing withdrawal simulation action in the mobile app (Holdings folios and schemes) sharing the common Rust backend calculation (`POST /api/tax/simulate-sell`), enforce cross-platform feature parity with a comprehensive parity test suite, and fix the mobile CAS upload sync failure on reachable local network endpoints with dedicated E2E tests.

**Architecture:** 
1. **Withdrawal Simulation**: Add a dedicated withdrawal simulation action button (`testID="folio-simulate-btn-${id}"`) to mobile `FolioChildRow` and `SchemeGroupCard`. In `holdings.tsx` and `tax.tsx`, wire the action to open `SimulationModal`. Connect `SimulationModal` to a new `tax-simulation-service` that invokes the shared backend endpoint (`POST /api/tax/simulate-sell`) using generated TypeScript types (`SimulationSellRequest`, `SimulationSellResponse`), with transparent fallback to local calculation when offline.
2. **Feature Parity**: Add a comprehensive withdrawal simulation parity test suite in `mobile/tests/mobile-feature-parity.test.ts` verifying identical contract, types, and calculation reconciliation between backend API responses and mobile presentation.
3. **CAS Upload Sync Fix**: Resolve upload sync failure by recognizing `202 Accepted` status from backend in `upload-queue.ts`, consistently applying `normalizeServerUrl` in reachability checks and endpoint URL construction, allowing LAN numerical IP connections in iOS ATS (`NSAllowsArbitraryLoads: true`), correcting dev server default ports to 8080, and adding full reachable-endpoint sync E2E test in `cas-upload-queue.test.tsx`.

**Tech Stack:** React Native (Expo), TypeScript (`strict: true`, Zero-Any), Rust backend (`portfolio-api`, `portfolio-core`), SQLite (`expo-sqlite`), Vitest, `@portfolio/core-view`.

**Spec:** Direct user request:
- "Create a separate worktree again main."
- "I realized that there is no "withdrawal simulation action" in mobile app, similar to how the web experience has it. It got missed out in the parity check."
- "1. Ensure that they share the common backend, and any changes in the backend get reflected accordingly"
- "2. Ensure that there is a parity check for this functionality."
- "Also, in this change, also fix CAS upload functionality. The sync fails despite being in the same network and a reachable endpoint. make sure the e2e tests test this functionality too."

## Global Constraints

- Zero `any` types in TypeScript code (`mobile/src/`, `mobile/tests/`).
- Must strictly use generated TypeScript contracts (`mobile/src/types/generated/SimulationSellRequest.ts`, `SimulationSellResponse.ts`).
- Maximum compiler rigor (`strict: true`, `noImplicitAny: true`, `noUncheckedIndexedAccess: true`).
- Maintainability sensors in `mobile/`: complexity $\le 10$, function length $\le 50$, parameters $\le 3$, file lines $\le 300$.
- Invariant: Values must conserve money bounds ($\Delta \le ₹0.01$).
- Synthetic data only: No real PANs or identifiers.

## Review Focus

1. **Backend 202 Accepted status mismatch**: `executeUploadRequest` previously rejected 202 as non-ok, keeping items in PENDING state and reporting sync failure.
2. **Offline resilience**: When the mobile app is not connected to a server or server is unreachable, withdrawal simulation must fall back to local `simulateSellRedemption` without erroring or blocking the UI.
3. **URL Normalization across platforms**: `localhost` / `127.0.0.1` must resolve to `10.0.2.2` on Android emulator and actual server host on iOS/physical devices, with correct default port 8080.
4. **iOS ATS LAN blocking**: iOS `NSAllowsLocalNetworking` rejects numeric LAN IPs (e.g. `192.168.x.x`). Adding `NSAllowsArbitraryLoads: true` ensures Wi-Fi LAN endpoints connect seamlessly.
5. **Single-folio vs Multi-folio scheme triggers**: Ensure withdrawal simulation can be launched both from single-folio schemes and from expanded multi-folio child rows in Holdings.

---

### Task 1: Fix CAS Upload & Sync Network / Status Handling

**Files:**
- Modify: `mobile/src/services/upload-queue.ts`
- Modify: `mobile/src/services/upload-actions.ts`
- Modify: `mobile/src/services/auth-service.ts`
- Modify: `mobile/src/services/portfolio-service.ts`
- Modify: `mobile/app.json`
- Test: `mobile/src/services/upload-queue.test.ts`

**Interfaces:**
- Consumes: Backend `POST /api/portfolio/upload` (returns `StatusCode::ACCEPTED` = 202)
- Produces: `executeUploadRequest`, `buildUploadUrl`, `checkServerReachable`

- [ ] **Step 1: Write failing unit test in `upload-queue.test.ts` verifying 202 Accepted response succeeds**

Add test in `mobile/src/services/upload-queue.test.ts`:
```ts
it('flushes pending upload and marks COMPLETED when server responds with 202 Accepted', async () => { ... })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mobile && pnpm vitest run src/services/upload-queue.test.ts`
Expected: FAIL because `res.ok` is currently false for status 202.

- [ ] **Step 3: Implement fixes in `upload-queue.ts`, `auth-service.ts`, `portfolio-service.ts`, and `app.json`**

1. In `mobile/src/services/upload-queue.ts`:
   - In `executeUploadRequest`: update `ok: res.status >= 200 && res.status < 300` (accepts 200, 201, 202).
   - In `buildUploadUrl`: call `normalizeServerUrl(serverUrl)`.
2. In `mobile/src/services/auth-service.ts`:
   - Update `DEFAULT_SERVER_URL` port from 8082 to 8080.
3. In `mobile/src/services/portfolio-service.ts`:
   - In `checkServerReachable`: call `normalizeServerUrl(serverUrl)`.
4. In `mobile/app.json`:
   - Set `"NSAllowsArbitraryLoads": true` in `ios.infoPlist.NSAppTransportSecurity`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mobile && pnpm vitest run src/services/upload-queue.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile/src/services/upload-queue.ts mobile/src/services/upload-actions.ts mobile/src/services/auth-service.ts mobile/src/services/portfolio-service.ts mobile/app.json mobile/src/services/upload-queue.test.ts
git commit -m "fix(mobile): resolve CAS upload sync failure on 202 status and LAN reachability"
```

---

### Task 2: Implement Backend-Shared Tax Simulation Service for Mobile

**Files:**
- Create: `mobile/src/services/tax-simulation-service.ts`
- Test: `mobile/src/services/tax-simulation-service.test.ts`
- Modify: `mobile/src/services/portfolio-service.ts`

**Interfaces:**
- Consumes: `SimulationSellRequest`, `SimulationSellResponse` from `mobile/src/types/generated/`, `simulateSellRedemption` from `mobile/src/services/tax-harvesting.ts`
- Produces: `simulateWithdrawal(request: WithdrawalSimulationRequest): Promise<SimulationSellResult>`

- [ ] **Step 1: Write unit tests in `mobile/src/services/tax-simulation-service.test.ts`**

Tests:
1. Calls backend API `POST /api/tax/simulate-sell` with JWT token when server is reachable.
2. Converts backend `SimulationSellResponse` to `SimulationSellResult` with exact figures.
3. Gracefully falls back to local `simulateSellRedemption` when server is offline or unreachable.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mobile && pnpm vitest run src/services/tax-simulation-service.test.ts`
Expected: FAIL (file doesn't exist yet).

- [ ] **Step 3: Implement `tax-simulation-service.ts`**

Export:
```ts
export interface WithdrawalSimulationParams {
  folioId?: string | undefined;
  schemeName?: string | undefined;
  assetClass?: ('EQUITY' | 'DEBT' | 'HYBRID' | 'OTHER') | undefined;
  isElss?: boolean | undefined;
  unitsToSell: number;
  currentNav: number;
  taxSlab?: number | undefined;
  lots?: SimulationLot[] | undefined;
}

export async function simulateWithdrawal(params: WithdrawalSimulationParams): Promise<SimulationSellResult>
```
Logic:
1. Check stored credentials (`getStoredCredentials()`).
2. If `serverUrl` and `token` exist and `isServerReachable(serverUrl)`:
   - Call `${serverUrl}/api/tax/simulate-sell` with `SimulationSellRequest`.
   - On 200 response, map `SimulationSellResponse` to `SimulationSellResult`.
3. If not reachable or error occurs:
   - Fall back to local `simulateSellRedemption()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mobile && pnpm vitest run src/services/tax-simulation-service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile/src/services/tax-simulation-service.ts mobile/src/services/tax-simulation-service.test.ts
git commit -m "feat(mobile): add backend-shared tax simulation service with offline fallback"
```

---

### Task 3: Wire Simulation Action in Holdings Folios and Update SimulationModal

**Files:**
- Modify: `mobile/src/components/Holdings/FolioChildRow.tsx`
- Modify: `mobile/src/components/Holdings/SchemeGroupCard.tsx`
- Modify: `mobile/src/components/Holdings/scheme-card-rows.tsx`
- Modify: `mobile/app/(tabs)/holdings.tsx`
- Modify: `mobile/src/components/Tax/SimulationModal.tsx`
- Test: `mobile/tests/holdings-breakdown.test.tsx`

**Interfaces:**
- Consumes: `simulateWithdrawal` from `tax-simulation-service.ts`
- Produces: Action button with `testID="folio-simulate-btn-${folio.id}"` on folio rows and single-folio cards; `SimulationModal` opened from Holdings screen.

- [ ] **Step 1: Write failing component test in `mobile/tests/holdings-breakdown.test.tsx`**

Test that:
1. `FolioChildRow` renders a withdrawal simulation button (`testID="folio-simulate-btn-${folio.id}"`).
2. Pressing the button calls `onSimulateWithdrawal(folio)`.
3. `HoldingsScreen` mounts `SimulationModal` and opens it when withdrawal button is pressed.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mobile && pnpm vitest run tests/holdings-breakdown.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement UI updates**

1. In `FolioChildRow.tsx`:
   - Add `onSimulate?: ((folio: FolioInput) => void) | undefined` prop.
   - Render a Calculator/Withdrawal action button (`testID={`folio-simulate-btn-${folio.id}`}`) with accessibility label.
2. In `scheme-card-rows.tsx` and `SchemeGroupCard.tsx`:
   - Forward `onSimulate` down to `FolioChildRow`.
   - In `CardSubRow` or `SchemeHeader` for single-folio schemes, add a quick simulate button (`testID={`scheme-simulate-btn-${group.id}`}`).
3. In `mobile/app/(tabs)/holdings.tsx`:
   - Add state: `simTarget: { folioId, schemeName, currentNav, units, isElss } | null`.
   - Render `SimulationModal` controlled by `simTarget`.
4. In `mobile/src/components/Tax/SimulationModal.tsx`:
   - Update `useSellSimulation` to invoke `simulateWithdrawal()` asynchronously with loading state.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mobile && pnpm vitest run tests/holdings-breakdown.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/Holdings/FolioChildRow.tsx mobile/src/components/Holdings/SchemeGroupCard.tsx mobile/src/components/Holdings/scheme-card-rows.tsx mobile/app/(tabs)/holdings.tsx mobile/src/components/Tax/SimulationModal.tsx mobile/tests/holdings-breakdown.test.tsx
git commit -m "feat(mobile): add withdrawal simulation action to holdings folios and schemes"
```

---

### Task 4: Parity Test Suite for Withdrawal Simulation

**Files:**
- Modify: `mobile/tests/mobile-feature-parity.test.ts`

**Interfaces:**
- Consumes: `simulateWithdrawal` from `tax-simulation-service`, `SimulationSellRequest`, `SimulationSellResponse`
- Produces: Parity check suite verifying Web and Mobile calculation contracts and UI actions

- [ ] **Step 1: Write parity tests in `mobile/tests/mobile-feature-parity.test.ts`**

Add `describe('Withdrawal Simulation Parity Check', () => { ... })`:
1. **Contract Parity**: Verifies mobile request payload conforms to generated `SimulationSellRequest` schema and endpoint `/api/tax/simulate-sell`.
2. **Calculation Reconciliation**: Verifies that backend response mapping to `SimulationSellResult` preserves exact gross value, total gain, tax liability, exit load, and net in-hand proceeds ($\Delta = 0$).
3. **Statutory Tax Rates**: Verifies that Budget 2024 rates (12.5% LTCG, 20% STCG) and 4% cess are preserved identically in both online backend response mapping and offline fallback.
4. **Action Parity**: Verifies that `FolioChildRow` exposes the withdrawal simulation action matching Web's `FolioRowActionButtons` calculator trigger.

- [ ] **Step 2: Run parity test to verify it passes**

Run: `cd mobile && pnpm vitest run tests/mobile-feature-parity.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add mobile/tests/mobile-feature-parity.test.ts
git commit -m "test(mobile): add withdrawal simulation feature parity test suite"
```

---

### Task 5: Mobile E2E Test Suite for CAS Upload Reachable Endpoint & Sync

**Files:**
- Modify: `mobile/src/e2e/cas-upload-queue.test.tsx`

**Interfaces:**
- Consumes: `UploadTabScreen`, `isServerReachable`, `flushUploadQueue`
- Produces: E2E test covering reachable endpoint, 202 Accepted response, and successful sync

- [ ] **Step 1: Add reachable-endpoint E2E test in `cas-upload-queue.test.tsx`**

Add test case:
```tsx
it('successfully uploads and syncs CAS statement when server is reachable on local network', async () => { ... })
```
Flow:
1. Mock server reachable (`isServerReachable` -> true).
2. Mock `flushUploadQueue` returning `{ succeeded: 1, failed: 0 }`.
3. Pick PDF, enter password, press "Upload Statement".
4. Verify status message: "Statement uploaded and processed successfully!".
5. Verify Outbox queue reflects COMPLETED state with 0 pending.
6. Verify manual "Sync Now" button triggers sync and succeeds.

- [ ] **Step 2: Run test to verify it passes**

Run: `cd mobile && pnpm vitest run src/e2e/cas-upload-queue.test.tsx`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add mobile/src/e2e/cas-upload-queue.test.tsx
git commit -m "test(mobile): add reachable endpoint CAS upload and sync E2E test"
```

---

### Task 6: Full Verification Sequence

- [ ] **Step 1: Run mobile verification**
  Run: `pnpm --filter mobile build:verify && pnpm --filter mobile test:unit`
- [ ] **Step 2: Run frontend verification**
  Run: `pnpm --filter frontend build && pnpm --filter frontend test:unit`
- [ ] **Step 3: Run backend verification**
  Run: `(cd backend-rs && ./scripts/verify.sh)`
- [ ] **Step 4: Final commit and summary**
