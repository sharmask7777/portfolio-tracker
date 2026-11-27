# Task 3 Brief: portfolio-api & portfolio-worker Comprehensive Rust Docs & Variable Naming Refactoring

## Task Objective
Enhance Rust docs (`///`), route handler documentation, complex algorithm explanations, and refactor ambiguous/cryptic variable names across `portfolio-api` and `portfolio-worker`:
1. `backend-rs/crates/portfolio-api/src/routes/portfolio.rs`:
   - In `compute_portfolio_exposures`: Refactor cryptic variable names (`val_dec` -> `current_holding_value`, `norm_key` -> `normalized_stock_key`, `h` -> `disclosed_holding`, `ctx` -> `core_transaction`, `t` -> `transaction_entity`, `folio_val` -> `folio_market_value`, `stock_val` -> `allocated_stock_value`).
   - Add thorough doc comments explaining:
     - `compute_portfolio_exposures`: Dynamic batch DB lookup by scheme ISIN, denominator handling under `exclude_arbitrage`, and fallback heuristics.
     - `resolve_holdings`: Purpose of category-level fallback portfolios (NASDAQ 100, S&P 500, US Total Stock Market, distinct AMC Arbitrage funds, Nifty 50, Nifty Next 50) and why they are generic.
     - `get_stock_sector`: Keyword-based sector taxonomy for equities.
     - `get_overlap`: Cross-fund pairwise common stock overlap calculation.
     - `get_portfolio_summary`, `get_xray`, `get_exposures`.
2. `backend-rs/crates/portfolio-api/src/routes/fund_holdings.rs`:
   - Document `POST /api/fund-holdings/ingest` and `GET /api/fund-holdings/:isin` handlers, DTOs, and validation logic.
3. `backend-rs/crates/portfolio-api/src/routes/tax.rs`:
   - Document `GET /api/portfolio/:id/tax` and `POST /api/portfolio/:id/tax/simulate-sell`.
   - Explain advance tax quarter mapping (`Q1`, `Q2a`, `Q2b`, `Q3`, `Q4`, `Q5`), Section 112A annual exemption calculation, and locked ELSS validation.
4. `backend-rs/crates/portfolio-api/src/services/nav_sync.rs`:
   - Document `NavSyncService`, daily rate-limiting mutex/hashset, hermetic fallback, and lazy background synchronization.
5. `backend-rs/crates/portfolio-worker/src/jobs/cas_parser.rs` & `nav_refresh.rs`:
   - Document CAS upload worker job lifecycle, PDF parsing fallback, BullMQ queue conventions, and NAV refresh scheduling.

## Plan Excerpt
**Files:**
- Modify: `backend-rs/crates/portfolio-api/src/routes/portfolio.rs`
- Modify: `backend-rs/crates/portfolio-api/src/routes/fund_holdings.rs`
- Modify: `backend-rs/crates/portfolio-api/src/routes/tax.rs`
- Modify: `backend-rs/crates/portfolio-api/src/services/nav_sync.rs`
- Modify: `backend-rs/crates/portfolio-worker/src/jobs/cas_parser.rs`
- Modify: `backend-rs/crates/portfolio-worker/src/jobs/nav_refresh.rs`

## Steps
1. Refactor cryptic variable names in `routes/portfolio.rs` and other files to self-documenting identifiers.
2. Add comprehensive doc comments (`///`) and explanatory inline comments.
3. Verify tests and linting:
   - `(cd backend-rs && cargo test --package portfolio-api && cargo test --package portfolio-worker)`
   - `(cd backend-rs && cargo clippy --package portfolio-api --package portfolio-worker --all-targets -- -D warnings)`
   - `(cd backend-rs && cargo fmt --check)`
4. Commit: `git add backend-rs/crates/portfolio-api backend-rs/crates/portfolio-worker && git commit -m "refactor(portfolio-api): improve variable naming clarity and add comprehensive rust docs"`.

## Constraints & Mandates
- Follow `AGENTS.md`: Universal Generality Mandate; The Invariant Oracle Law; Synthetic data only.
- Working directory: `/Users/shaleensharma/workplace/gemini_ws/portfolio-tracker`.
