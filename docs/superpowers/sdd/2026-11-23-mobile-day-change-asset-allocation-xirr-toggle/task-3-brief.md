### Task 3: Performance Mode (XIRR / ABS) Toggle Implementation

**Files:**
- Create: `mobile/src/services/settings-service.ts`
- Create: `mobile/src/components/Common/PerformanceModeToggle.tsx`
- Modify: `mobile/src/components/NetWorthCard.tsx`
- Modify: `mobile/src/components/Holdings/holdings-controls.tsx`
- Modify: `mobile/app/(tabs)/use-holdings-screen.ts`
- Modify: `mobile/app/(tabs)/holdings.tsx`
- Modify: `mobile/app/(tabs)/index.tsx`
- Test: `mobile/src/services/settings-service.test.ts`
- Test: `mobile/src/components/Common/PerformanceModeToggle.test.tsx`

**Interfaces:**
- Consumes: `@portfolio/core-view` `PerformanceMode` ('XIRR' | 'ABS').
- Produces: `usePerformanceMode()` hook, `PerformanceModeToggle` component, and integration into Dashboard and Holdings.

- [ ] **Step 1: Write failing unit test for `settings-service` and `PerformanceModeToggle`**

Create `mobile/src/services/settings-service.test.ts`:
- Test getting and setting `performanceMode` with SecureStore persistence and default `'XIRR'`.

Create `mobile/src/components/Common/PerformanceModeToggle.test.tsx`:
- Test rendering buttons for 'XIRR' and 'ABS'.
- Test triggering `onToggle` callback when pressing the non-active option.
- Test accessibility role "button" and min touch target.

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter mobile test:unit mobile/src/services/settings-service.test.ts mobile/src/components/Common/PerformanceModeToggle.test.tsx`
Expected: FAIL (files do not exist).

- [ ] **Step 3: Implement `settings-service.ts` and `PerformanceModeToggle.tsx`**

In `mobile/src/services/settings-service.ts`:
- Implement `getStoredPerformanceMode()` and `setStoredPerformanceMode(mode: PerformanceMode)` using `expo-secure-store` with in-memory fallback.
- Implement React hook `usePerformanceMode()` returning `[mode, setMode]`.

In `mobile/src/components/Common/PerformanceModeToggle.tsx`:
- Render segmented control with `[ XIRR | ABS ]`.
- Style active button with `#2563eb` background, inactive with `#18181b` and `#27272a` border.
- Ensure $\ge 44 \times 44\text{pt}$ touch target and `accessibilityRole="button"`.
- Set `testID="performance-mode-toggle"`, `testID="toggle-mode-xirr"`, `testID="toggle-mode-abs"`.

- [ ] **Step 4: Integrate toggle into `NetWorthCard`, `HoldingsFilterControls`, and screens**

In `mobile/src/components/NetWorthCard.tsx`:
- Accept optional `performanceMode?: PerformanceMode`, `overallXirr?: number`, and `onTogglePerformanceMode?: (mode: PerformanceMode) => void`.
- When `performanceMode` is supplied, display `PerformanceModeToggle` in the top right of the card or alongside Total Net Worth, and render the return metric formatted as XIRR vs ABS.

In `mobile/src/components/Holdings/holdings-controls.tsx`:
- Add `performanceMode: PerformanceMode` and `onTogglePerformanceMode: (mode: PerformanceMode) => void` to `HoldingsFilterControlsProps`.
- Render `PerformanceModeToggle` next to sort chips.

In `mobile/app/(tabs)/use-holdings-screen.ts`:
- Add `performanceMode` state to `useHoldingsFilters` and pass it to `useConsolidatedHoldings({ ..., performanceMode })`.

In `mobile/app/(tabs)/holdings.tsx`:
- Pass `performanceMode` to `HoldingsFilterControls` and `SchemeGroupCard`.

In `mobile/app/(tabs)/index.tsx`:
- Connect `usePerformanceMode()` and pass to `NetWorthCard`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter mobile test:unit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/services/settings-service.ts mobile/src/components/Common/PerformanceModeToggle.tsx mobile/src/components/NetWorthCard.tsx mobile/src/components/Holdings/holdings-controls.tsx mobile/app/(tabs)/use-holdings-screen.ts mobile/app/(tabs)/holdings.tsx mobile/app/(tabs)/index.tsx mobile/src/services/settings-service.test.ts mobile/src/components/Common/PerformanceModeToggle.test.tsx
git commit -m "feat(mobile): add XIRR/ABS performance mode toggle across dashboard and holdings"
```

---

