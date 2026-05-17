---
name: quality-audit
description: Audits portfolio reporting accuracy, financial invariants, and UI state consistency. Use when validating real-data ingestion (CAS PDFs), verifying performance metrics (XIRR/Net Worth), or ensuring UI toggles (XIRR/ABS) are correctly reflected in the data.
---

# Quality Audit Skill

This skill provides a suite of automated and manual procedures to verify the integrity of the Portfolio Tracker. It focuses on mathematical accuracy, data consistency, and feature-level validation.

## Core Workflows

### 1. Real-Data Validation (Ground Truth)
Use this when a user provides a CAS PDF to verify that the system correctly parses and ingests the data without regressions.

1. **Parse & Ingest**: Use `scripts/parse_and_sync.ts` to ingest a PDF into a temporary test user.
2. **Mathematical Audit**: Run `scripts/audit_engine.ts` to check for "Red Flags" (XIRR > 1000%, negative NW, basis erasure).
3. **Manual Tally**: Follow the protocol in `references/financial_invariants.md` to pick 2 schemes and verify units/cost against the PDF.

### 2. Feature-Level Validation
Use this to verify specific product capabilities after a major code change.

- **Performance Toggles**: Verify that switching `SettingsContext` between XIRR and ABS updates the UI values predictably.
- **Tax Harvesting**: Audit the simulation logic—verify that `sell_value - gain` matches the original cost basis.
- **Family Aggregation**: Verify that `Sum(Member_NW) === Portfolio_NW`.

## Bundled Resources

### Scripts
- `scripts/audit_engine.ts`: Scans the database for mathematical anomalies and reporting errors.
- `scripts/sync_validation.ts`: Streamlined utility to ingest a parsed JSON and report success/failure.

### References
- `references/financial_invariants.md`: A catalog of financial rules and "Red Flag" definitions.
- `references/ui_behavior_spec.md`: Defines expected UI state transitions and reactive behaviors.

### Assets
- `assets/audit_report_template.md`: A template for presenting audit findings to the user.

## Quality Standards

- **Zero Duplicates**: Each fund appears exactly once in the portfolio.
- **Invariant Integrity**: Post-Tax XIRR MUST always be $\le$ Pre-Tax XIRR.
- **Unit Precision**: Database units MUST match statement units to 3 decimal places.
- **Idempotency**: Re-uploading the same statement MUST NOT create duplicate transactions.

---
*Status: Active | Scope: Portfolio Data & Feature Integrity*
