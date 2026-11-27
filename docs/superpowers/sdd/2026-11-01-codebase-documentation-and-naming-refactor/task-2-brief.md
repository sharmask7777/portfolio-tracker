# Task 2 Brief: portfolio-db Comprehensive Rust Docs, Query Explanations & Repository Clarity

## Task Objective
Enhance Rust docs (`///`), method descriptions, SQL query explanations, and variable clarity across `backend-rs/crates/portfolio-db/`, covering:
1. `src/schema.rs`: Document all database tables, columns, indexes, foreign keys, and unique constraints (including `"FundHolding_isin_asOfDate_stockName_key"`).
2. `src/entities.rs`: Document all entity structs and their fields, mapping to database columns and serde conventions.
3. `src/repositories/fund_holdings_repo.rs`, `portfolio_repo.rs`, `transaction_repo.rs`, and `family_repo.rs`:
   - Document repository traits and methods.
   - Explain SQL queries, especially CTE queries (e.g. `latest_dates` partitioned by ISIN in batch holdings), `ON CONFLICT DO UPDATE` upserts, and transaction scoping.
4. `src/test_mocks.rs`:
   - Document `InMemoryDatabase` and `InMemoryDatabaseState`.
   - Explain concurrency model (`RwLock`), sub-millisecond Zero-I/O testing, and deterministic sorting/filtering.
5. Refactor any short/cryptic variable names in repositories or mocks to self-documenting identifiers.

## Plan Excerpt
**Files:**
- Modify: `backend-rs/crates/portfolio-db/src/schema.rs`
- Modify: `backend-rs/crates/portfolio-db/src/entities.rs`
- Modify: `backend-rs/crates/portfolio-db/src/repositories/fund_holdings_repo.rs`
- Modify: `backend-rs/crates/portfolio-db/src/repositories/portfolio_repo.rs`
- Modify: `backend-rs/crates/portfolio-db/src/repositories/transaction_repo.rs`
- Modify: `backend-rs/crates/portfolio-db/src/repositories/family_repo.rs`
- Modify: `backend-rs/crates/portfolio-db/src/test_mocks.rs`

## Steps
1. Add comprehensive `///` doc comments for all structs, enums, traits, methods, and fields.
2. Add inline comments explaining SQL query construction, CTE semantics, and indexing rationales.
3. Refactor any ambiguous/cryptic variable names to clear, self-documenting names.
4. Verify tests and linting:
   - `(cd backend-rs && cargo test --package portfolio-db)`
   - `(cd backend-rs && cargo clippy --package portfolio-db --all-targets -- -D warnings)`
   - `(cd backend-rs && cargo fmt --check)`
5. Commit: `git add backend-rs/crates/portfolio-db && git commit -m "docs(portfolio-db): add comprehensive rust docs and query explanations"`.

## Constraints & Mandates
- Follow `AGENTS.md`: Universal Generality Mandate; The Invariant Oracle Law; Synthetic data only.
- Working directory: `/Users/shaleensharma/workplace/gemini_ws/portfolio-tracker`.
