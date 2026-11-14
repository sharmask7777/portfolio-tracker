# Interactive Multi-Level Portfolio X-Ray & Drilldown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an institutional-grade, mathematically reconciled interactive multi-level hierarchy drilldown visualization (Nested Squarified Treemap and Concentric Radial Sunburst) that connects overall portfolio net worth across asset classes, macro sectors, individual look-through stocks, and their contributing mutual fund schemes with zero visual chaos and strict financial invariants.

**Architecture:** 
1. Build a pure, deterministic tree transformer utility (`hierarchy-builder.ts`) in `frontend/src/utils/` that consumes `XRayData` (asset classes, sectors, market cap, expense ratios) and `StockExposure[]` (look-through stock holdings & mutual fund contributions) to construct an $N$-level normalized hierarchy (`HierarchyNode`). Implements the **Value Conservation Law** ($\Delta \le ₹0.01$), the **Hare-Niemeyer (Largest Remainder) rounding parity method**, synthetic **tail holding reconciliation** for undisclosed mutual fund positions, ragged hierarchy outer radius expansion, and dual-mode **arbitrage hedging segregation**.
2. Implement an accessible, interactive squarified multi-level Treemap component (`MultiLevelTreemap.tsx`) featuring 4-tier tile rendering rules (omitting text in micro-tiles to prevent overlap), smooth zoom transitions with breadcrumb trail (`All Assets > Equity > Financial Services > HDFC Bank Ltd.`), and roving tabindex keyboard navigation (`WCAG 2.1 AA`).
3. Implement an interactive concentric Sunburst diagram component (`SunburstChart.tsx`) with dynamic center summary hub (eliminating occlusion from floating tooltips), mobile tap-to-lock interaction, and angular threshold coalescing ($< 1.5^\circ$).
4. Implement a dedicated stock detail slide-over drawer (`StockDetailDrawer.tsx`) detailing mutual fund source breakdown with progress bars and cross-navigation into the Stock Intersection tab.
5. Upgrade `XRayDashboard.tsx`, `XRayView.tsx`, and `App.tsx` with a view mode segmented control (`Hierarchical Treemap`, `Concentric Sunburst`, `Classic Grid`), passing look-through exposures, handling arbitrage exclusion, and ensuring dark/light mode palette contrast ($\ge 4.5:1$).

**Tech Stack:** React 19, TypeScript (strict mode, zero-any, unbundled no-knip violations), SVG / CSS modules, Lucide icons, Vitest, Playwright, `@axe-core/playwright`.

**Spec:** Synthesized from Office Hours dialogue, CX/Frontend Engineering Audit, and Quantitative Portfolio Invariant Audit.

---

## Global Constraints & Invariant Laws
- **The Invariant Oracle Law**: All financial amounts must reconcile within $\Delta \le ₹0.01$. Sibling percentages formatted to two decimal places must sum to exactly $100.00\%$ via the Largest Remainder Method.
- **Value Conservation Law**: For any non-leaf node $u$, $\text{Val}(u) \equiv \sum_{v \in \text{Children}(u)} \text{Val}(v) \pm ₹0.01$. The root value must equal total portfolio net worth.
- **Zero-Any Mandate**: No `any` types permitted anywhere in `frontend/src/`.
- **Strict TypeScript & Exact Optionality**: `noImplicitAny: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`. Safe indexing and narrowing required.
- **Architectural Isolation**: `eslint-plugin-boundaries` enforced. Utility files under `src/utils/` must not import UI components.
- **File Naming & Casing**: PascalCase for React components under `src/components/`, kebab-case for utilities under `src/utils/`.
- **Dead-Code & Knip Cleanliness**: Zero unused exports or dead dependencies (`pnpm --filter frontend build:verify`).
- **Indian Financial Numbering**: Rupee formatting in Indian numbering format (`₹X.XX Cr` for $\ge ₹1\text{ Cr}$, `₹X.XX L` for $\ge ₹1\text{ L}$, and `₹XX,XXX` for smaller sums).

---

## Review Focus
1. **Look-Through Coverage Gap & Tail Holdings**: Real mutual funds only disclose their top 80–90% holdings (with 10–20% residual in cash drag and micro-equities). The hierarchy engine must generate a deterministic synthetic leaf node `Other Scheme Holdings (${sectorName})` for any residual sector balance so children sum exactly to their parent sector without visual gaps or missing percentage totals.
2. **The Three-Denominator Problem**: Nodes must carry distinct ratios to avoid ambiguity: `weightOfPortfolio` (% of Net Worth), `weightOfAssetClass` (% of Asset Class), and `weightOfParent` (% of direct parent/zoom context).
3. **Arbitrage & Hedging Segregation**: When `excludeArbitrage` is enabled, hedged cash-futures schemes are isolated into an independent `Arbitrage / Hedged Strategies` asset class to prevent gross equity beta distortion. When disabled, hedged stocks are visually badged and rendered with diagonal stripes.
4. **Tile Readability & Micro-Slices**: Treemap tiles $< 50 \times 32\text{px}$ must suppress text labels completely; Sunburst slices $< 1.5^\circ$ ($\approx 0.4\%$) must be grouped into `Other (<0.4%)` to avoid un-targetable touch targets and visual chaos.
5. **Ragged Hierarchy in Concentric Sunburst**: Debt/Cash branches terminate at shallower depths than Equity. Leaf nodes at depth $d < D_{\max}$ must project their outer radius to $R_{\max}$ to prevent gaping annular voids.

---

### Task 1: Hierarchy Tree Transformation Engine & Financial Invariants

**Files:**
- Create: `frontend/src/utils/hierarchy-builder.ts`
- Test: `frontend/src/utils/hierarchy-builder.test.ts`

- [ ] **Step 1: Write failing unit tests for hierarchy transformation and financial invariants**
  Define comprehensive test suites covering:
  - `test_tree_value_conservation_law`: Assert $\forall u, \text{val}(u) = \sum_{v \in C(u)} \text{val}(v) \pm 0.01$.
  - `test_lookthrough_coverage_gap_reconciliation`: Provide sector with ₹50,000 and disclosed stocks summing to ₹38,000; assert synthetic `Other Scheme Holdings` node of ₹12,000 is created.
  - `test_three_denominator_ratios`: Verify `weightOfPortfolio`, `weightOfAssetClass`, `weightOfParent`, and `weightOfSector` calculate accurately.
  - `test_hare_niemeyer_percentage_parity`: Verify formatted sibling percentages sum exactly to 100.00% without rounding drift.
  - `test_zero_equity_debt_portfolio`: Verify pure debt/liquid portfolios construct a valid multi-asset hierarchy without `0 / 0` or `NaN`.
  - `test_exclude_arbitrage_branching`: Verify arbitrage funds isolate into a dedicated root asset class when `excludeArbitrage: true`.
  - `test_indian_rupee_formatting`: Test format utility across Crores, Lakhs, and Thousands.

- [ ] **Step 2: Run tests to confirm failure**
  Run: `pnpm --filter frontend test:unit src/utils/hierarchy-builder.test.ts`

- [ ] **Step 3: Implement `hierarchy-builder.ts`**
  - Define strongly typed data structures:
    - `NodeMetrics`: `signedValue`, `layoutValue`, `weightOfPortfolio`, `weightOfAssetClass`, `weightOfParent`, `weightOfSector`.
    - `HierarchyNode`: `id`, `name`, `depth`, `metrics`, `color`, `textColor`, `children`, `contributions`, `isSynthetic`, `isTail`, `isHedged`.
  - Implement Largest Remainder Method (`distributeBasisPoints`) for sibling percentage parity.
  - Implement Indian currency compact formatter (`formatIndianRupee`).
  - Implement `buildPortfolioHierarchy(data: XRayData, exposures?: StockExposure[], options?: HierarchyOptions): HierarchyNode`.
  - Implement tail reconciliation logic and micro-allocation grouping ($< 0.3\%$).
  - Implement color mapping adhering to the accessible 10-sector palette (`SECTOR_PALETTE`).

- [ ] **Step 4: Run tests and verify passing**
  Run: `pnpm --filter frontend test:unit src/utils/hierarchy-builder.test.ts`

- [ ] **Step 5: Commit**
  Run: `git add frontend/src/utils/hierarchy-builder.ts frontend/src/utils/hierarchy-builder.test.ts && git commit -m "feat(analytics): implement hierarchy tree engine with value conservation and tail reconciliation"`

---

### Task 2: Interactive Zoomable Squarified Treemap & Stock Detail Drawer

**Files:**
- Create: `frontend/src/components/Analytics/MultiLevelTreemap.tsx`
- Create: `frontend/src/components/Analytics/StockDetailDrawer.tsx`
- Test: `frontend/src/components/Analytics/MultiLevelTreemap.test.tsx`
- Test: `frontend/src/components/Analytics/StockDetailDrawer.test.tsx`

- [ ] **Step 1: Write failing tests for `MultiLevelTreemap` and `StockDetailDrawer`**
  Define tests covering:
  - Initial proportional layout rendering of top-level nodes.
  - Click-to-zoom into sectors updating breadcrumbs and recalibrating local tile dimensions.
  - 4-tier tile rendering rules:
    - Tier 1 ($\ge 80\times 52\text{px}$): Name + Rupee Value + Percentage.
    - Tier 2 ($\ge 50\times 32\text{px}$): Name + Percentage.
    - Tier 3 ($< 50\times 32\text{px}$): Color block only (no text nodes rendered in SVG).
    - Tier 4 ($< 0.3\%$ or $< 15\text{px}$): Grouped into `Other (<0.3%)`.
  - Keyboard navigation (roving tabindex: `Arrow` keys to move, `Enter`/`Space` to zoom, `Esc`/`Backspace` to zoom out).
  - Clicking a stock node opens `StockDetailDrawer` displaying mutual fund contributions, progress bars, and `Inspect in Stock Intersection` CTA.
  - ARIA attributes and `aria-live` polite announcements on drilldown.

- [ ] **Step 2: Run tests to confirm failure**
  Run: `pnpm --filter frontend test:unit src/components/Analytics/MultiLevelTreemap.test.tsx src/components/Analytics/StockDetailDrawer.test.tsx`

- [ ] **Step 3: Implement `StockDetailDrawer.tsx` and `MultiLevelTreemap.tsx`**
  - Implement pure TypeScript squarified layout algorithm (aspect ratio $\le 4:1$).
  - Add SVG `<clipPath>` for text truncation and 2px tile inner borders.
  - Add hatched SVG pattern for hedged arbitrage assets.
  - Build accessible breadcrumb navigation `<nav aria-label="Hierarchy Breadcrumbs">` with Zoom Out button.
  - Build slide-over / bottom sheet `StockDetailDrawer` with scheme progress bars and cross-tab navigation callback.
  - Implement full keyboard accessibility and screen reader announcements.

- [ ] **Step 4: Run tests and verify passing**
  Run: `pnpm --filter frontend test:unit src/components/Analytics/MultiLevelTreemap.test.tsx src/components/Analytics/StockDetailDrawer.test.tsx`

- [ ] **Step 5: Commit**
  Run: `git add frontend/src/components/Analytics/MultiLevelTreemap.tsx frontend/src/components/Analytics/StockDetailDrawer.tsx frontend/src/components/Analytics/MultiLevelTreemap.test.tsx frontend/src/components/Analytics/StockDetailDrawer.test.tsx && git commit -m "feat(analytics): implement interactive zoomable treemap and stock detail drawer"`

---

### Task 3: Interactive Concentric Radial Sunburst Component

**Files:**
- Create: `frontend/src/components/Analytics/SunburstChart.tsx`
- Test: `frontend/src/components/Analytics/SunburstChart.test.tsx`

- [ ] **Step 1: Write failing tests for `SunburstChart`**
  Define tests covering:
  - Concentric SVG arc geometry partitions: $\sum \Delta\theta_{\text{children}} \equiv \Delta\theta_{\text{parent}}$.
  - Minimum angular threshold ($1.5^\circ$): slices $< 1.5^\circ$ coalesced into `Other (<0.4%)`.
  - Ragged hierarchy handling: leaf nodes at depth $d < D_{\max}$ extend $r_{\text{out}}$ to $R_{\max}$ without leaving blank outer rings.
  - Center summary hub: defaults to total portfolio net worth; updates on hover/focus to display node name, rupee value, and dual percentages (`% of Portfolio | % of Parent`).
  - Mobile tap-to-lock interaction: first tap locks center hub, second tap triggers zoom/drawer, canvas tap unlocks.

- [ ] **Step 2: Run tests to confirm failure**
  Run: `pnpm --filter frontend test:unit src/components/Analytics/SunburstChart.test.tsx`

- [ ] **Step 3: Implement `SunburstChart.tsx`**
  - Pure trigonometry SVG arc generators ($r_{\text{in}}, r_{\text{out}}, \theta_1, \theta_2$) with sweep angle clamping to avoid browser arc wrap glitches.
  - Concentric radii geometry:
    - Hub: $r \in [0, 0.24 \cdot R_{\max}]$
    - Asset Class: $r \in [0.26 \cdot R_{\max}, 0.48 \cdot R_{\max}]$
    - Sector: $r \in [0.50 \cdot R_{\max}, 0.74 \cdot R_{\max}]$
    - Stock: $r \in [0.76 \cdot R_{\max}, 1.00 \cdot R_{\max}]$
  - Interactive Center Hub display with high contrast text and Indian rupee formatting.
  - Synchronized color mapping with `SECTOR_PALETTE`.

- [ ] **Step 4: Run tests and verify passing**
  Run: `pnpm --filter frontend test:unit src/components/Analytics/SunburstChart.test.tsx`

- [ ] **Step 5: Commit**
  Run: `git add frontend/src/components/Analytics/SunburstChart.tsx frontend/src/components/Analytics/SunburstChart.test.tsx && git commit -m "feat(analytics): implement interactive concentric radial sunburst chart"`

---

### Task 4: View Switcher, Dashboard Integration & Arbitrage Toggle

**Files:**
- Modify: `frontend/src/components/Analytics/XRayDashboard.tsx`
- Modify: `frontend/src/components/Analytics/XRayView.tsx`
- Modify: `frontend/src/components/Analytics/types.ts`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/components/Analytics/XRayDashboard.test.tsx`
- Test: `frontend/src/components/Analytics/XRayView.test.tsx`

- [ ] **Step 1: Write failing component integration tests**
  - Verify view mode segmented control: `Zoomable Treemap` | `Concentric Sunburst` | `Classic Grid` (persisted in `localStorage`).
  - Verify passing `exposures` into `XRayView` from `App.tsx`.
  - Verify switching `excludeArbitrage` updates the hierarchy tree without resetting active drilldown zoom if the current sector exists in both states.
  - Verify pure debt/liquid portfolio empty state handling.
  - Verify cross-tab navigation callback switches to `intersection` tab with search pre-filled.

- [ ] **Step 2: Run tests to confirm failure**
  Run: `pnpm --filter frontend test:unit src/components/Analytics/XRayView.test.tsx`

- [ ] **Step 3: Integrate components in `XRayView`, `XRayDashboard`, and `App.tsx`**
  - Update `XRayViewProps` to accept `exposures?: StockExposure[]`, `excludeArbitrage?: boolean`, `onToggleExcludeArbitrage?: (exclude: boolean) => void`, and `onNavigateToIntersection?: (stockName: string) => void`.
  - In `App.tsx`, pass `exposures`, `excludeArbitrage`, and handlers to `<XRayView />`.
  - Implement view mode switcher with local storage persistence.
  - Connect `StockDetailDrawer` cross-link to set active tab to `intersection` and pre-filter by the selected stock name.
  - Ensure zero type errors, zero lint warnings, and clean boundary compliance.

- [ ] **Step 4: Run all analytics unit tests**
  Run: `pnpm --filter frontend test:unit src/components/Analytics/`

- [ ] **Step 5: Commit**
  Run: `git add frontend/src/components/Analytics/ frontend/src/App.tsx && git commit -m "feat(analytics): integrate multi-level drilldown into xray dashboard and view"`

---

### Task 5: Static Build Verification & Playwright E2E Suite

**Files:**
- Create: `frontend/tests/xray-drilldown.spec.ts`

- [ ] **Step 1: Add Playwright E2E tests for the complete drilldown workflow**
  - Navigate to X-Ray tab.
  - Verify segmented view mode control displays and switches between Treemap, Sunburst, and Classic Grid.
  - Test clicking a sector in the Treemap to zoom in and verify breadcrumb shows `All Assets > Equity > [Sector]`.
  - Test clicking a stock tile to open `StockDetailDrawer` and verify contributing mutual funds appear.
  - Test clicking `Inspect in Stock Intersection` switches tab and pre-fills stock search.
  - Test keyboard navigation (`Arrow` keys, `Enter`, `Escape`).
  - Test responsive layout across mobile ($375\text{px}$) and desktop ($1440\text{px}$).
  - Run accessibility audit using `@axe-core/playwright`.

- [ ] **Step 2: Execute full hermetic verification sequence**
  - Run `pnpm --filter frontend build:verify` (`lint`, `typecheck`, `knip`).
  - Run `pnpm --filter frontend test:unit`.
  - Run `pnpm --filter frontend test:coverage`.
  - Run `pnpm --filter frontend build`.

- [ ] **Step 3: Commit**
  Run: `git add frontend/tests/xray-drilldown.spec.ts && git commit -m "test(e2e): add playwright and accessibility spec for multi-level xray drilldown"`
