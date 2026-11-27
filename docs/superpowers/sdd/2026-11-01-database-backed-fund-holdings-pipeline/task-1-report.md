# Task 1 Report: DDL Schema, FundHoldingEntity, and FundHoldingsRepository Trait in portfolio-db

## Summary
Successfully implemented the `FundHolding` database table DDL, `FundHoldingEntity` Rust model, `FundHoldingsRepository` trait, `SqlxFundHoldingsRepo` PostgreSQL implementation, and `InMemoryDatabase` mock implementation with full hermetic unit test coverage.

## Changes Made
1. **DDL Schema (`backend-rs/crates/portfolio-db/src/schema.rs`)**:
   - Added `"FundHolding"` table with columns `id`, `isin`, `schemeName`, `asOfDate`, `stockName`, `stockIsin`, `sector`, `weight`, `createdAt`.
   - Added unique constraint on `("isin", "asOfDate", "stockName")` and indices on `isin` and `asOfDate`.
   - Updated `schema_test.rs` to verify `"FundHolding"` table creation in DDL.

2. **Entity Struct (`backend-rs/crates/portfolio-db/src/entities.rs`)**:
   - Defined `FundHoldingEntity` with `sqlx::FromRow`, `Serialize`, `Deserialize`, `PartialEq`, `Eq`.
   - Added camelCase field mapping and defaults (`sector = "Other"`, `stockIsin = None`).

3. **Repository Trait & SQLx Implementation (`backend-rs/crates/portfolio-db/src/repositories/fund_holdings_repo.rs`)**:
   - Created `FundHoldingsRepository` trait declaring:
     - `upsert_fund_holdings(&self, holdings: &[FundHoldingEntity]) -> Result<(), DbError>`
     - `get_latest_holdings_by_isin(&self, isin: &str) -> Result<Vec<FundHoldingEntity>, DbError>`
     - `get_latest_holdings_batch(&self, isins: &[&str]) -> Result<HashMap<String, Vec<FundHoldingEntity>>, DbError>`
   - Implemented `SqlxFundHoldingsRepo` with transactional batch upsert (`ON CONFLICT ("isin", "asOfDate", "stockName") DO UPDATE`), date subquery for latest holdings, and `ANY($1)` batch query.
   - Re-exported in `repositories/mod.rs` and `lib.rs`.

4. **In-Memory Hermetic Test Support (`backend-rs/crates/portfolio-db/src/test_mocks.rs`)**:
   - Implemented `FundHoldingsRepository` for `InMemoryDatabase`, enabling deterministic, zero-I/O testing of downstream services.

5. **Tests (`backend-rs/crates/portfolio-db/tests/persistence_tests.rs`)**:
   - Added `test_fund_holding_entity_serde`: Verifies roundtrip serialization/deserialization and default field values.
   - Added `test_fund_holdings_repository_crud`: Verifies date-partitioned latest holding selection, empty ISIN handling, batch retrieval, and conflict update behavior.

## Verification
- TDD cycle verified: initial test failed to compile as expected, passed after implementation.
- `cargo test --package portfolio-db`: All 14 tests passed (8 in persistence, 5 in market_data, 1 in schema).
- `cargo clippy --package portfolio-db --all-targets -- -D warnings`: 0 warnings.
- `cargo fmt --check`: Clean formatting.

## Commits
- Commit: `80357ae feat(portfolio-db): add FundHolding schema, entity, and Sqlx repository`
