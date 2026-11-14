---
title: "Multi-Level Look-Through Portfolio Hierarchy: Value Conservation, Tail Reconciliation & Dual-Mode Arbitrage Segregation"
date: "2026-11-14"
category: "analytics"
tags:
  - "portfolio-xray"
  - "look-through-analytics"
  - "value-conservation"
  - "hare-niemeyer"
  - "arbitrage-segregation"
  - "squarified-treemap"
  - "concentric-sunburst"
status: "verified"
---

# Multi-Level Look-Through Portfolio Hierarchy: Value Conservation, Tail Reconciliation & Dual-Mode Arbitrage Segregation

## 1. Problem Statement & Context

### 1.1 The Look-Through Coverage Gap & Area Conservation Breakdown
In institutional mutual fund reporting (e.g. Morningstar X-Ray), portfolios consist of direct assets (stocks, bonds, cash, gold) and indirect mutual fund holdings. Mutual funds publish monthly portfolio disclosures detailing their individual stock holdings. However, published disclosures rarely account for 100% of a fund's valuation:
- Top 10 to 30 holdings disclose 75% to 90% of the fund's gross assets.
- The remaining 10% to 25% consists of cash drag, collateral (TREPS), unlisted holdings, and an undisclosed tail of micro-holdings.

If an analytics engine naively nests disclosed stock exposures under macro industrial sectors, $\sum \text{Stock Exposures} < \text{Sector Valuation}$. This violates geometric area conservation in squarified treemaps and produces gaping angular voids in radial sunbursts.

### 1.2 The Three-Denominator Problem
In multi-level portfolio drilldown, presenting an unqualified `"percentage"` creates investor confusion:
- HDFC Bank may simultaneously represent **4.5% of Total Net Worth**, **6.5% of Equity Assets**, and **22.1% of Financial Services Sector**.
- Without clear multi-ratio data contracts, zooming into a sector without re-anchoring confuses users.

### 1.3 Arbitrage Fund Market Beta Distortion
Arbitrage funds maintain $\ge 65\%$ gross equity in spot shares, completely hedged with short futures contracts ($\beta_{\text{net}} \approx 0$). If folded into directional equity sectors, they artificially inflate equity allocations and distort sector exposures despite carrying zero equity directional risk.

### 1.4 Visual Clutter & Floating Tooltip Occlusion
- Rendering text inside micro-tiles ($< 50 \times 32\text{px}$) produces overlapping, illegible text strings.
- Slices $< 1.5^\circ$ in radial diagrams are physically untargetable on touchscreens.
- Floating tooltips that follow the cursor occlude adjacent radial slices in circular charts.

---

## 2. Architecture & Algorithmic Solution

### 2.1 The Value Conservation Law ($\Delta \le ₹0.01$)
For every non-leaf node $u$ in the hierarchy tree:
$$\text{Val}(u) = \sum_{v \in \text{Children}(u)} \text{Val}(v) \pm ₹0.01$$
$$\text{Val}(\text{Root}) \equiv \text{Total Portfolio Net Worth}$$

### 2.2 Tail Reconciliation Engine (`hierarchy-builder.ts`)
To preserve mathematical completeness without phantom equity:
$$\Delta_{\text{residual}}(S) = \text{Val}_{\text{sector}}(S) - \sum_{\text{stock} \in S} \text{Val}_{\text{disclosed}}(\text{stock})$$
If $\Delta_{\text{residual}}(S) > ₹0.01$, the engine synthesizes a deterministic leaf node:
`Other Scheme Holdings (${sectorName})` with `isSynthetic: true` and `isTail: true`. This strictly preserves 100% sum-of-parts equality across every sector.

### 2.3 Hare-Niemeyer (Largest Remainder) Percentage Parity
To eliminate floating-point rounding drift ($99.99\%$ or $100.01\%$):
1. Raw basis points: $b_i = w_i \times 10,000$
2. Integer floors: $f_i = \lfloor b_i \rfloor$
3. Remainder: $r = 10,000 - \sum_{i=1}^N f_i$
4. Distribute $+1\text{ bp}$ to the $r$ nodes with the largest fractional parts $(b_i - f_i)$.
This guarantees $\sum_{i=1}^N \text{displayPct}_i \equiv 100.00\%$.

### 2.4 Dual-Mode Arbitrage Segregation
- **Directional Risk Mode (`excludeArbitrage: true`)**: Arbitrage schemes are segregated into an independent top-level root asset class (`Arbitrage / Hedged Strategies`), ensuring Equity strictly reflects genuine directional beta.
- **Gross Statutory Mode (`excludeArbitrage: false`)**: Hedged stocks are tagged with `isHedged: true` and rendered with diagonal hatched stripes (`<pattern id="hedged-stripes">`).

### 2.5 4-Tier Tile Readability & Center Hub Sunburst
- **Treemap Tiering**:
  - $\ge 80 \times 52\text{px}$: Name + Rupee Value + Percentage.
  - $\ge 50 \times 32\text{px}$: Name + Percentage.
  - $< 50 \times 32\text{px}$: Color block only (no text nodes rendered in SVG).
  - Micro-allocations $< 0.3\%$: Grouped into `Other (<0.3%)`.
- **Radial Sunburst Center Hub**:
  - Central display hub shows Net Worth when idle, dynamically updating on hover/focus with node name, Indian currency format (`₹X.XX L` / `₹X.XX Cr`), and dual weights: `% of Portfolio | % of Parent`.
  - Outer radius of ragged leaf nodes (e.g. Debt/Cash) projected to $R_{\max}$, eliminating empty annular rings.

---

## 3. Verification & Guardrails

- **Hermetic Tests**: 10 unit test suites in `hierarchy-builder.test.ts` validating value conservation, tail reconciliation, 100.00% Hare-Niemeyer parity, and pure debt zero-equity handling.
- **Interaction & A11y Tests**: Vitest suites in `MultiLevelTreemap.test.tsx`, `SunburstChart.test.tsx`, `StockDetailDrawer.test.tsx`, and `XRayView.test.tsx`.
- **E2E Playwright Suite**: `tests/xray-drilldown.spec.ts` testing multi-level zoom, breadcrumb navigation, slide-over drawer, cross-tab filtering into Stock Intersection, mobile viewport stability, and `@axe-core/playwright` accessibility audits (0 violations).
