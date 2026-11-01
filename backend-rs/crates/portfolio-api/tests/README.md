# `portfolio-api` Test Architecture & Suite Catalog

This directory contains the integration and contract test suites for `portfolio-api`, the REST API gateway of Portfolio Tracker.

---

## 1. Architectural Invariants

### 1.1 Hermetic Determinism & Zero Network Ports
- Tests execute with `axum::Router::oneshot(req)` against in-memory state (`InMemoryDatabase`, `InMemoryRateLimiter`).
- No physical TCP listeners or Docker containers are required for `cargo test`.
- Third-party endpoints (`api.mfapi.in`) are mocked via in-memory handlers or local loopback servers.

### 1.2 Frontend Contract Synchronization (`ts-rs`)
- All request and response structures derive `ts_rs::TS`.
- `export_bindings.rs` exports TypeScript types directly to `frontend/src/types/generated/`.
- CI enforces zero contract drift between backend DTOs and frontend types.

### 1.3 Strict Data Privacy Mandate
- No real PANs, names, email addresses, or transaction data.
- All tests exclusively use synthetic identifiers (e.g. `ABCDE1234F`, `FOLIO-101`).

---

## 2. Test Suite Catalog & Distinct Responsibilities

| Test File | Primary Domain | Methodology | Distinct Role & Invariants Tested |
| :--- | :--- | :--- | :--- |
| [`contract_tests.rs`](./contract_tests.rs) | REST API Route Parity | End-to-End Axum Route Testing | Validates HTTP status codes, camelCase JSON wire serialization, JWT auth protection (401), registration, login, portfolio CRUD, and X-Ray / stock overlap endpoints. |
| [`nav_resolution_test.rs`](./nav_resolution_test.rs) | NAV Resolution & Day Change | Unit & Integration Testing | Validates date precedence between historical NAVs and transactions, previous trading day discovery (bridging Sundays and holidays), and exact `dayChange` / `dayChangePercentage` math on folios and summary metrics. |
| [`nav_sync_test.rs`](./nav_sync_test.rs) | Rate Limiting & MFAPI Sync | Hermetic Async Mock Testing | Validates the atomic 24-hour rate limit mutex (`InMemoryRateLimiter`, Redis lock) and external MFAPI synchronization (`fetch_and_upsert_latest_nav`). |
| [`export_bindings.rs`](./export_bindings.rs) | Contract Generation | Type Export Harness | Generates TypeScript interfaces to prevent frontend/backend schema divergence. |
