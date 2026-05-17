# Agent Maintenance Guide: Portfolio Tracker

This document provides instructions for future agents to maintain the high standards and quality of the Portfolio Tracker project.

## Core Mandates

### 1. Robust Financial Math
- **XIRR & CAGR:** Any changes to the performance calculation engine MUST be validated using Property-Based Testing (PBT) in `robustness.pbt.spec.ts`. 
- **Numerical Stability:** We use `node-irr` for its bisection fallback. Never replace it with a library that only uses Newton-Raphson, as it fails on complex real-world cash flows.
- **Sign Consistency:** Always ensure investments are negative and redemptions/current values are positive before passing to `calculateXIRR`.

### 2. Tax Integrity (Indian Rules)
- **Budget Compliance:** The engine is refined for **Budget 2024** (STCG 20%, LTCG 12.5%). Any legislative changes must be updated in `TaxService` with corresponding PBT scenarios.
- **Loss Set-off:** Maintain the hierarchy: STCL can set off both STCG/LTCG, but LTCL can ONLY set off LTCG.
- **Grandfathering:** The Jan 31, 2018 price rule is critical for equity assets. Always verify the `max(actual_cost, min(fmv, sale_price))` formula.

### 3. Data Ingestion
- **CAS Schema:** We follow the `casparser` JSON standard. When adding support for new RTA fields, update the `MockCASGenerator.ts` to ensure synthetic tests remain valid. See `SOP_CAS_ADAPTATION.md` for the full validation and adaptation protocol.
- **Deduplication:** Always use the MD5 transaction hashing logic in `SyncService` to prevent data duplication on re-imports.

### 4. Quality Standards
- **Testing:** 
    - **Unit Tests:** For specific business logic and regressions.
    - **PBT (fast-check):** For mathematical invariants and edge-case discovery.
    - **Linting:** Strict ESLint and Prettier rules must be followed.
- **Type Safety:** Avoid `any` where possible. Use Prisma-generated types for all DB operations.
- **Analytics Performance:** Ensure `XRayService` and `OverlapService` maintain weighted-aggregation accuracy. Use database indexes for performance.

## Agent Skills
The project includes a suite of specialized SOPs and scripts in the root `skills/` directory. These are designed to be AI-agnostic—any agent can read these Markdown files to learn how to perform complex tasks.

- **[quality-audit](./skills/quality-audit/SKILL.md)**: Mathematical and UI integrity checks.
- **[pdd](./skills/pdd/SKILL.md)**: Architectural planning and design.
- **[code-assist](./skills/code-assist/SKILL.md)**: TDD implementation guidance.

Refer to [skills/README.md](./skills/README.md) for the full manifest.

## Maintaining the Test Suite
- **Run Unit Tests:** `cd backend && npm test`
- **Run Robustness Tests:** `cd backend && npm test src/services/robustness.pbt.spec.ts`
- **Generate Synthetic Data:** Use `MockCASGenerator.generate()` in new test suites to stress-test your features.

## Architecture Highlights
- **Python Bridge:** The PDF parsing lives in `backend/scripts/parse_cas.py`. It requires the `casparser` library in the local `venv`.
- **Redis Caching:** Market data (NAVs, Holdings) is cached to avoid API rate limits and ensure fast UI responses.
- **Vanilla CSS:** Maintain the data-dense, minimalist aesthetic. Avoid adding heavy UI libraries that bloat the bundle.
