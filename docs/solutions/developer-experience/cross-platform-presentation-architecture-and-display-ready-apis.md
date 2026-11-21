---
title: "Cross-Platform Presentation Architecture: Display-Ready Backend Contracts, Pluggable Scope Management & AST Parity Guardrails"
date: "2026-11-21"
category: "developer-experience"
problem_type: "architecture_pattern"
module: "packages/core-view, backend-rs, frontend, mobile"
component: "cross-platform-architecture"
severity: "high"
tags:
  - "cross-platform"
  - "shared-package"
  - "core-view"
  - "display-ready-api"
  - "scope-management"
  - "ast-guardrail"
  - "monorepo"
  - "parity"
status: "verified"
applies_when:
  - "Sharing presentation, consolidation, and formatting logic across web and React Native mobile clients in a monorepo"
  - "Eliminating client-side aggregation divergence with pre-computed display-ready backend API contracts"
  - "Bridging platform-specific persistence (localStorage vs SecureStore) behind a pluggable state adapter"
  - "Enforcing cross-platform architectural parity at build time using static AST code analyzers"
---

# Cross-Platform Presentation Architecture: Display-Ready Backend Contracts, Pluggable Scope Management & AST Parity Guardrails

## Context

When expanding a feature-rich web financial dashboard to a cross-platform mobile application, client implementations frequently drift apart. In this repository, while the core portfolio data was available to both platforms, the experiences diverged in UX and business logic:

1. **UX Inconsistency**: The web experience supported granular breakdown by individual PAN alongside a consolidated family view using an interactive chip selector. In contrast, the mobile client had only a consolidated view, and isolated managed profiles to an orphaned bottom navigation tab (previously `mobile/app/(tabs)/family.tsx`, removed by this refactor).
2. **Duplicated Business Logic**: Complex mutual fund scheme consolidation (grouping disparate folios of the same master scheme, computing FIFO-weighted XIRR and CAGR returns, aggregating tax liabilities, and managing search/filter/sort pipelines) was implemented in `frontend/src/utils/consolidation.ts` and re-implemented with subtle variations in mobile screens.
3. **Client-Side Valuation Disparities**: Because the backend returned raw folios without member-level totals, clients independently grouped folios to compute per-PAN corpus percentages, risking rounding divergence ($\sum \% \ne 100\%$).
4. **Platform-Specific Monorepo Packaging Pitfalls**: Introducing a shared workspace package (`@portfolio/core-view`) exposed bundler resolution quirks across Vite, Vitest, Docker multi-stage builds, and Expo Metro.

To reach permanent parity with zero logic duplication, we re-architected the presentation layer into display-ready backend contracts, a shared `@portfolio/core-view` package with pluggable persistence adapters, and automated AST parity guardrails.

---

## Guidance & Architectural Pattern

### 1. Display-Ready Backend API Contracts (`backend-rs`)

Instead of requiring heterogeneous clients to independently compute portfolio partition statistics, compute display-ready member attributions directly within the backend REST gateway ([`backend-rs/crates/portfolio-api/src/routes/portfolio.rs`](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/backend-rs/crates/portfolio-api/src/routes/portfolio.rs)):

```rust
#[derive(Debug, Serialize, Deserialize, Clone, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../../../frontend/src/types/generated/")]
pub struct PanBreakdownDto {
    pub pan: String,
    pub member_name: String,
    pub invested_amount: Decimal,
    pub current_value: Decimal,
    pub day_change: Decimal,
    pub day_change_percentage: Decimal,
    pub xirr: Decimal,
    pub folio_count: usize,
}
```

- In `get_portfolio_summary`, pre-aggregate folios into `pan_breakdowns: Vec<PanBreakdownDto>` providing exact member-level valuation, invested capital, day change, weighted XIRR, and folio counts.
- Derive `ts-rs` bindings to export TypeScript definitions to both `frontend/src/types/generated/` and `mobile/src/types/generated/` during `cargo test --test export_bindings`.
- Clients render member badges directly using these values, deriving corpus share percentages from `(breakdown.currentValue / totalValuation) * 100` without having to group or recalculate underlying folios.

---

### 2. The `@portfolio/core-view` Shared Workspace Package

We extracted pure presentation, aggregation, and scope management logic into an isolated pnpm workspace package:

```
packages/core-view/
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── src/
    ├── consolidation/      # Scheme grouping, sorting, and FIFO returns aggregation
    ├── formatters/         # Indian Rupee (Lakhs/Crores), percentage, and date formatters
    ├── holdings/           # useConsolidatedHoldings hook (search, filter, sort, expand state)
    ├── scope/              # usePortfolioScope hook with ScopeStorageAdapter interface
    └── index.ts            # Public unified entrypoint
```

#### Dual-Platform Scope Adapter Pattern
Web and Mobile share identical active scope logic (`consolidated` vs `member` with `profileId` and `pan`), while abstracting the underlying storage mechanism:

```typescript
export interface ScopeStorageAdapter {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem?(key: string): void | Promise<void>;
}
```

- **Web Adapter**: `LocalStorageScopeStorageAdapter` backed synchronously by browser `localStorage`.
- **Mobile Adapter**: `SecureStoreScopeStorageAdapter` backed asynchronously by `expo-secure-store`.
- Both serialize structured JSON (`{"type":"member","profileId":"...","pan":"..."}`) while maintaining backward-compatible deserialization for legacy raw string IDs.

---

### 3. Unified Cross-Platform UX Paradigms

1. **Retire Disconnected Tabs**: The mobile `Family` bottom navigation tab was removed from `mobile/app/(tabs)/_layout.tsx`. Managed profile CRUD operations were integrated into `Settings` via `FamilyProfilesCard`.
2. **Sticky Scope Selector**: Both Web (`FamilySelector`) and Mobile (`ScopeSelectorHeader`) mount identical sticky pill selectors across Dashboard, Analytics, Holdings, and Tax screens:
   - "Consolidated" pill displaying overall PAN count and total folios.
   - Per-member PAN chips displaying investor name, masked PAN, total folios, and corpus share % badge.
3. **Expandable Multi-Folio Scheme Groups**: Holdings on mobile (`SchemeGroupCard` and `FolioChildRow`) match Web's hierarchy:
   - Group header displays master scheme name, category badge, total valuation, return metrics, and member PAN chips.
   - Expanding the group reveals constituent folios with individual folio numbers and account-specific metrics.

---

### 4. Monorepo Bundler & Test Runner Packaging Rules

When sharing a TypeScript package across Vite, Vitest, and Docker without publish steps:

1. **Package.json Exports Configuration**: To allow Vitest and Vite to import the workspace dependency directly in development and test environments without requiring a pre-build step:
   ```json
   {
     "name": "@portfolio/core-view",
     "main": "src/index.ts",
     "module": "src/index.ts",
     "types": "src/index.ts",
     "exports": {
       ".": {
         "types": "./src/index.ts",
         "import": "./src/index.ts",
         "default": "./src/index.ts"
       }
     }
   }
   ```
2. **Docker Multi-Stage Context**: Docker containers building the frontend must explicitly copy and build the shared workspace package before building the consumer application:
   ```dockerfile
   COPY packages/core-view ./packages/core-view
   RUN pnpm --filter @portfolio/core-view build
   COPY frontend ./frontend
   RUN pnpm --filter frontend build
   ```
3. **Safe Property Narrowing**: Always safely narrow optional identity strings (e.g. `profile.pan ? profile.pan.trim().toUpperCase() : ''`) to avoid runtime exceptions when managed profiles lack demographic properties.

---

### 5. Static AST Parity Guardrails (`scripts/verify-web-mobile-parity.ts`)

To mathematically prevent future drift, AST verification was codified in `scripts/verify-web-mobile-parity.ts` and bound to `pnpm parity:check`:

```typescript
// AST Invariants checked across Web & Mobile:
// 1. App.tsx & holdings.tsx must import from '@portfolio/core-view'
// 2. holdings.tsx must import SchemeGroupCard & ScopeSelectorHeader
// 3. SchemeGroupCard must render group.pans member badges
// 4. Mobile (tabs)/_layout.tsx must NOT contain a 'family' tab screen
```

If an engineer introduces localized consolidation logic or re-creates an isolated Family tab, CI fails before tests even execute.

---

## Verification & Parity Results

- **Rust Backend**: All 29 contract tests passing, including `test_portfolio_summary_display_ready_pan_breakdowns_contract`.
- **Shared Package**: 61/61 unit tests passing in `@portfolio/core-view` with >95% test coverage.
- **Web Frontend**: 29 unit test files (219 tests) and 60/60 Playwright E2E Docker integration tests passing.
- **Mobile Client**: 13 unit test files (173 tests) and 8 sequential E2E simulation specs passing.
- **Static Gate**: `pnpm parity:check` confirms 100% domain and AST parity across 8 core domains.
