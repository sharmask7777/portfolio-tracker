# Task 4 Brief: Dynamic Look-Through Integration in compute_portfolio_exposures

## Task Objective
Update `compute_portfolio_exposures` in `backend-rs/crates/portfolio-api/src/routes/portfolio.rs` to dynamically batch-query persisted fund disclosures by scheme ISIN from the database (`FundHoldingsRepository`), using authentic database holdings and sectors when available, and seamlessly falling back to `resolve_holdings` heuristics when disclosures are not present in the database.

## Plan Excerpt
**Files:**
- Modify: `backend-rs/crates/portfolio-api/src/routes/portfolio.rs`
- Test: `backend-rs/crates/portfolio-api/tests/contract_tests.rs`

**Interfaces:**
- Consumes: `FundHoldingsRepository` via `state.backend`, `resolve_holdings` heuristic as fallback.
- Produces: Dynamic exposure resolution in `GET /api/portfolio/:id/exposures` prioritizing persisted database disclosures over in-memory fallback heuristics.

## Steps
1. Write failing contract test in `contract_tests.rs`:
   - `test_dynamic_exposure_uses_db_holdings_when_available`:
     - Sets up a user with a portfolio containing an equity folio with ISIN `"INF209K01157"` (e.g. 100,000 INR).
     - Prior to disclosure ingestion, `GET /api/portfolio/{id}/exposures` resolves via `resolve_holdings` heuristic.
     - Ingest a disclosure via `POST /api/fund-holdings/ingest` for `"INF209K01157"` containing custom synthetic stock "Synthetic Cloud Technologies Ltd." with weight `15.0%` and sector `"Technology"`.
     - After ingestion, `GET /api/portfolio/{id}/exposures` dynamically resolves "Synthetic Cloud Technologies Ltd." at 15.0% (and 15,000 INR value) under sector "Technology".
     - In the same portfolio or another portfolio, an un-ingested fund (e.g. UTI Nifty 50) continues to resolve via `resolve_holdings` fallback seamlessly.
2. Run test to verify failure: `(cd backend-rs && cargo test --package portfolio-api --test contract_tests test_dynamic_exposure_uses_db_holdings_when_available)`.
3. In `backend-rs/crates/portfolio-api/src/routes/portfolio.rs`:
   - In `compute_portfolio_exposures`:
     - Collect unique ISINs from `active_equity_folios`:
       `let isin_list: Vec<&str> = active_equity_folios.iter().filter_map(|(a, _)| a.isin.as_deref()).filter(|s| !s.is_empty()).collect();`
     - Query batch holdings:
       - Match `state.backend`:
         - `DbBackend::InMemory(ref mem)` -> `mem.get_latest_holdings_batch(&isin_list).await?`
         - `DbBackend::Postgres(ref pool)` -> `SqlxFundHoldingsRepo::new(pool.clone()).get_latest_holdings_batch(&isin_list).await?`
     - When constructing exposures for each `(asset, folio_val)`:
       - If `asset.isin` is present and `db_holdings.get(isin)` has non-empty entries:
         - Map each `FundHoldingEntity` to `portfolio_core::xray::holdings::FundHolding::new(&h.stock_name, h.weight)`
         - Use `h.sector` as the stock's sector! (with fallback to `get_stock_sector(&h.stock_name)` if sector is empty or "Other").
       - Otherwise:
         - Fallback to `resolve_holdings(isin, &asset.name)`.
4. Run all contract tests: `(cd backend-rs && cargo test --package portfolio-api --test contract_tests)`.
5. Run clippy & fmt: `(cd backend-rs && cargo clippy --package portfolio-api --all-targets -- -D warnings)` and `(cd backend-rs && cargo fmt --check)`.
6. Commit: `git add backend-rs/crates/portfolio-api && git commit -m "feat(portfolio-api): dynamically prioritize database fund disclosures in portfolio exposures"`.

## Constraints & Mandates
- Follow `AGENTS.md`: Universal Generality Mandate (strictly no portfolio-specific hacks; apply generically across all mutual fund schemes); zero-I/O in domain core; synthetic data only.
- Working directory: `/Users/shaleensharma/workplace/gemini_ws/portfolio-tracker`.
