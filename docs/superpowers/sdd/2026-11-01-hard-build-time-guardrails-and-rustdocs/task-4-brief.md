# Task 4 Brief: Dependency Auditing with `cargo-deny` (`deny.toml`)

## Task Objective
Configure dependency security, licensing, source, and bans auditing using `cargo-deny` with a root configuration file `backend-rs/deny.toml`, ensuring `(cd backend-rs && cargo deny check)` passes cleanly on the workspace lockfile.

## Plan Excerpt
- Create: `backend-rs/deny.toml`

## Steps
1. Create `backend-rs/deny.toml` with the following configuration:
   - `[advisories]`:
     - `vulnerability = "deny"`
     - `unmaintained = "warn"`
     - `yanked = "deny"`
     - `notice = "warn"`
   - `[licenses]`:
     - `unlicensed = "deny"`
     - `allow = ["MIT", "Apache-2.0", "Apache-2.0 WITH LLVM-exception", "ISC", "BSD-2-Clause", "BSD-3-Clause", "Unicode-3.0", "Unicode-DFS-2016", "OpenSSL", "Zlib"]`
     - `confidence-threshold = 0.8`
     - Add any legitimate clarifying exceptions/clarifications needed for the workspace lockfile dependencies.
   - `[bans]`:
     - `multiple-versions = "warn"`
     - `wildcards = "allow"`
     - `highlight = "all"`
   - `[sources]`:
     - `unknown-registry = "deny"`
     - `unknown-git = "deny"`
     - `allow-registry = ["https://github.com/rust-lang/crates.io-index"]`
2. Run `(cd backend-rs && cargo deny check)`.
3. If any licenses (e.g., dual-licensed crates like `MIT OR Apache-2.0`, `Unicode-3.0`, etc.) need clarification or allowance, refine `backend-rs/deny.toml` until `cargo deny check` passes with 0 errors.
4. Verify workspace tests and clippy still pass:
   - `(cd backend-rs && cargo clippy --workspace --all-targets -- -D warnings)`
   - `(cd backend-rs && cargo test --workspace)`
5. Commit:
   `git add backend-rs/deny.toml && git commit -m "feat(security): add cargo-deny configuration for dependency license and advisory auditing"`

## Constraints & Mandates
- Follow `AGENTS.md`: The Invariant Oracle Law (never alter test assertion values or numerical bounds); Universal Generality Mandate.
- Working directory: `/Users/shaleensharma/workplace/gemini_ws/portfolio-tracker`.
