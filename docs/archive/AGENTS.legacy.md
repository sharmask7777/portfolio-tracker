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
- **Data Integrity & NaN Prevention:** 
    - **Zero-Tolerance for NaN:** No UI element should ever display "NaN". Always use fallbacks (`0`, `N/A`, or empty states) and verify formatting functions handle undefined/null inputs gracefully.
    - **Verification:** Every new visualization or data table must include an E2E test check specifically looking for "NaN" strings to prevent regression.
- **Type Safety:** Avoid `any` where possible. Use Prisma-generated types for all DB operations.
- **Analytics Performance:** Ensure `XRayService` and `OverlapService` maintain weighted-aggregation accuracy. Use database indexes for performance.

### 5. Docker & Deployment
- **Image Hub:** We use `shaleenks/portfolio-backend:latest` and `shaleenks/portfolio-frontend:latest` (multi-platform: linux/amd64, linux/arm64).
- **Push Protocol:** Whenever a significant code push is made, evaluate if the Docker images should be updated. If unsure, nudge the user for a decision.
- **Milestone Releases:** For every major end-to-end flow implementation or milestone completion, you MUST nudge the user to tag and push updated Docker configurations.

### 6. Data Anonymization & Privacy Protection
- **Zero Real Data Commitment:** Strict prohibition against hardcoding, committing, staging, or logging real personal identifying information (PII) or real portfolio data.
- **Forbidden Identifiers:** Absolutely NO real PANs (Permanent Account Numbers), investor names, email addresses, phone numbers, folio numbers, bank/demat details, or actual statement files (CAS PDFs, `parsed_cas.json`, `*.cas.json`).
- **Synthetic Test Data Only:** All tests, fixtures, mocks, and examples MUST use synthetic, fictitious data (e.g. synthetic PANs such as `ABCDE1234F`, `ALPAC1001A`, fictitious names like "Aarav Sharma", "Neha Patel", etc.).
- **Ignore Verification:** Real CAS statements or parsed JSON files must remain permanently git-ignored and never committed to the repository.

### 7. Mock Portfolio Test Suite & Financial Scenarios
- **Comprehensive Mock Suite:** All financial features, calculations, consolidation behaviors, and UI views MUST be validated against the 10+ synthetic mock portfolios suite (`backend/src/test/mock-portfolios.spec.ts`, `frontend/src/utils/mock-portfolios.test.ts`, and `frontend/tests/mock-portfolios.spec.ts`).
- **Core Financial Scenarios Covered:**
  1. **Scheme Consolidation:** Grouping multiple folios/PANs for the same scheme without duplicate valuation.
  2. **Zero-Holding / Full Redemption Isolation:** Fully redeemed positions must never show active holdings/valuation and must be cleanly isolated in closed positions.
  3. **Partial Redemptions:** FIFO accounting of remaining units, invested cost, and realized gains.
  4. **Stock Intersection & X-Ray:** Accurate underlying company allocation and multi-fund overlap without NaN or phantom exposure.
  5. **Asset-Class Specific States:** Correct behavior for pure debt/liquid (empty equity states) and mixed multi-asset allocations.
  6. **Alternative Assets:** Unlisted assets, SGBs, Physical Gold, and Real Estate integration.
  7. **Multi-Member Profiles:** Family profile switching, aggregation, and cascading deletion integrity.
  8. **Tax Rules & Grandfathering:** Section 112A LTCG grandfathering (Jan 31, 2018 FMV formula) and loss set-off rules.
  9. **Lock-In Restrictions:** ELSS 3-year lock-in and statutory withdrawal constraints.
  10. **Folio Lifecycle:** Manual closing and deletion of folios and managed profiles.
- **Continuous Evolution:** All future use cases, edge cases, and bug fixes MUST be baked into these mock portfolios so regressions are caught permanently.
- **Hook & CI Enforcement:** Mock portfolio tests MUST run as part of hermetic unit tests (`npm test`), the pre-push hook (`.husky/pre-push`), and GitHub Actions workflows (`.github/workflows/e2e.yml`).

## Agent Skills
The project includes a suite of specialized SOPs and scripts in the `genai-artifacts/skills/` directory. These are designed to be AI-agnostic—any agent can read these Markdown files to learn how to perform complex tasks.

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

## Troubleshooting & Common Pitfalls
- **Browser Extensions (uBlock Origin):** Privacy/Ad-blockers may block calls to endpoints like `/api/portfolio/upload` or `/api/portfolio/summary` if they perceive them as tracking or "suspicious" due to local IP/port combinations. If uploads fail silently or with network errors, try whitelisting the application domain.
- **Alpine Linux Dependencies:** The Python parser requires specific system libraries (`libffi`, `gcompat`, `py3-cryptography`) on Alpine-based Docker images. Always ensure these are present in the `Dockerfile` to avoid "Password or format" errors caused by library load failures.

## Custom Instructions

<!-- This section is maintained by developers and agents during day-to-day work.
     It is NOT auto-generated by codebase-summary and MUST be preserved during refreshes.
     Add project-specific conventions, gotchas, and workflow requirements here. -->

### GenAI Workspace Directory
**CRITICAL:** The `genai-artifacts/` directory is the workspace root for all future GenAI workflows. All generated documents, plans, SOPs, skills, scratchpads, and agent-specific directories MUST be placed inside `genai-artifacts/` to keep the project root clean.

### E2E Testing with Playwright
When building automated agents that interact with terminal scripts, Playwright’s default behavior can frustrate the control loop (e.g., retries, long trace files, interactive HTML reports, or keeping the process active while it generates stdout).

The project is configured for **fail-fast behavior** in `frontend/playwright.config.ts` (`maxFailures: 1`, `workers: 1`, `reporter: 'line'`). This ensures the terminal process terminates immediately on failure with an exit code of `1`.

- **Run E2E Tests:** `cd frontend && npx playwright test`
- **Global Auth Bypass:** Playwright is configured to inject a `bypass-auth` flag via `storageState` globally. For tests requiring a natural login/logout flow (like `logout.spec.ts`), you MUST explicitly disable this isolation at the top of your test file:
  `test.use({ storageState: { cookies: [], origins: [] } });`
  *Note: The backend `AuthService.verifyToken` explicitly accepts `'mock-token'` in non-production environments to authenticate the test user (`test-user`) without failing E2E tests.*

### BullMQ Queue & File Lifecycle
The BullMQ PDF upload queue in `queue.ts` is configured with `attempts: 1`. Since the temporary uploaded files are cleaned up (deleted) in the `finally` block of the first processing attempt, any automatic BullMQ retries would immediately fail with a `"File not found"` error. Ensure queue attempts remain at `1` to prevent this test regression.

### Docker Pre-flight Checks
Standard local testing (`npm test`) bypasses the exact combination of factors that can crash the production container (Compiled JS + Docker Environment + Missing `.env` file).

Always run the Docker Smoke Test locally before pushing a new backend image to catch `prisma.config.ts` or environment variable loading issues:
- **Run Docker Test:** `cd backend && npm run test:docker`
  *(This builds a temporary image and runs `npx prisma validate` with a dummy `DATABASE_URL` to ensure the config loads cleanly without crashing).*
