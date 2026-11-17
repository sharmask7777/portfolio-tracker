# Maintainability Sensors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Beef up the workspace across TypeScript, Rust, and Python codebases by implementing the computational and architectural maintainability sensors inspired by Martin Fowler / Thoughtworks harness engineering principles.

**Architecture:** Establish a multi-layer sensor harness: (1) Fine-grained computational complexity and anti-AI-slop linting (ESLint, Clippy, Ruff) with self-correction prompt guidance; (2) Boundary and architectural fitness sensors enforcing modularity and dependency direction; (3) Mutation testing and verification sensors to eliminate assertion blindness; (4) Pre-commit and pre-push sensor hooks.

**Tech Stack:** TypeScript (ESLint 9 flat config, `eslint-plugin-boundaries`, Vitest), Rust (`clippy`, `cargo-deny`, `architecture_invariants_test.rs`), Python (`ruff`), Git hooks (`husky`).

**Spec:** Inspired by Birgitta Böckeler's *Maintainability sensors for coding agents* (Martin Fowler, 2026), targeting:
- Bad, bloated AI code and unreadable components
- Deep cyclomatic/cognitive complexity and excessive branching
- Structural coupling and architectural boundary violations
- Lack of confidence in refactorings due to coverage-without-assertion gaps

## Global Constraints

- **The Invariant Oracle Law**: Tests in `proptests.rs`, `tax_oracle_test.rs`, and golden vectors are immutable ground truths.
- **Zero-Any Rule**: No `any` types permitted in TypeScript.
- **TypeScript Strictness**: `strict: true`, `noImplicitAny: true`, `noUncheckedIndexedAccess: true`.
- **Rust Zero-I/O Invariant**: `portfolio-core` must remain 100% pure domain calculation with `#![forbid(unsafe_code)]`.
- **Zero PII**: No real PANs or identifiers. Synthetic test data only.

## Review Focus

1. False positives on React hook dependency arrays or complex table/chart layouts tripping `complexity` without clear extraction paths.
2. Clippy `cognitive_complexity` breaking mathematical algorithms (e.g. FIFO lot allocation, Section 55(2)(ac) grandfathering) instead of prompting clean sub-function extraction.
3. ESLint self-correction guidance messages must be clear and instructive, guiding agents to extract helper utilities rather than disabling lints.
4. Mutation testing execution time must be bounded so it does not stall developer or agent workflow.
5. All verification commands (`pnpm build:verify`, `cargo test`, `./scripts/verify.sh`) must pass cleanly after each task.

---

### Task 1: TypeScript Micro-Maintainability Sensors (ESLint Complexity & Clean Code Rules)

**Files:**
- Modify: `frontend/eslint.config.js`
- Test: `pnpm --filter frontend lint`

**Interfaces:**
- Consumes: Current ESLint 9 configuration
- Produces: Strict rules capping file length, function length, cyclomatic complexity, and max parameters, with embedded prompt guidance for self-correction.

- [ ] **Step 1: Check baseline lint status**
Run: `pnpm --filter frontend lint`
Expected: Passes with 0 errors.

- [ ] **Step 2: Add AI shortcoming rules and guidance in `frontend/eslint.config.js`**
Add:
- `complexity`: `['error', { max: 15 }]`
- `max-lines`: `['error', { max: 600, skipBlankLines: true, skipComments: true }]`
- `max-lines-per-function`: `['error', { max: 120, skipBlankLines: true, skipComments: true, IIFEs: true }]` (relaxed to 160 for tests or JSX components where needed)
- `max-params`: `['error', { max: 4 }]`
- `@typescript-eslint/no-explicit-any`: `['error']`

- [ ] **Step 3: Run lint to check current violations and calibrate thresholds**
Run: `pnpm --filter frontend lint`
Expected: Any existing functions exceeding limits are identified and cleanly refactored into smaller sub-functions.

- [ ] **Step 4: Verify frontend build and tests pass**
Run: `pnpm --filter frontend build:verify && pnpm --filter frontend test:unit`
Expected: Clean PASS.

- [ ] **Step 5: Commit Task 1**
```bash
git add frontend/eslint.config.js
git commit -m "chore(sensors): add typescript micro-maintainability sensors and complexity caps"
```

---

### Task 2: Rust Maintainability & Cognitive Complexity Sensors

**Files:**
- Modify: `backend-rs/crates/portfolio-core/src/lib.rs`
- Modify: `backend-rs/Cargo.toml`
- Modify: `backend-rs/deny.toml` (handle chrono advisory properly)
- Test: `(cd backend-rs && cargo clippy --workspace --all-targets -- -D warnings)`

**Interfaces:**
- Consumes: Cargo workspace and Clippy configuration
- Produces: Compiler-enforced cognitive complexity, function length, and argument limits on Rust crates.

- [ ] **Step 1: Fix cargo-deny chrono unmaintained advisory in `backend-rs/deny.toml`**
Add `RUSTSEC-2026-0543` to `advisories.ignore` in `backend-rs/deny.toml` with explanation so verification passes.
Run: `(cd backend-rs && cargo deny check)`
Expected: PASS.

- [ ] **Step 2: Configure workspace-level clippy maintainability lints in `backend-rs/Cargo.toml`**
Add under `[workspace.lints.clippy]`:
- `cognitive_complexity = { level = "deny" }`
- `too_many_lines = { level = "deny" }`
- `too_many_arguments = { level = "deny" }`
- `fn_params_excessive_bools = { level = "deny" }`
- `needless_pass_by_value = { level = "deny" }`

- [ ] **Step 3: Run clippy check**
Run: `(cd backend-rs && cargo clippy --workspace --all-targets -- -D warnings)`
Expected: Any cognitive complexity hotspots are pinpointed and refactored.

- [ ] **Step 4: Run full backend verification**
Run: `(cd backend-rs && ./scripts/verify.sh)`
Expected: All 8 stages PASS cleanly.

- [ ] **Step 5: Commit Task 2**
```bash
git add backend-rs/Cargo.toml backend-rs/deny.toml
git commit -m "chore(sensors): enforce clippy cognitive complexity and maintainability lints"
```

---

### Task 3: Python Maintainability Sensors (Ruff & Mypy)

**Files:**
- Create: `pyproject.toml`
- Modify: `scripts/pre-merge-check.sh`
- Test: `ruff check scripts/`

**Interfaces:**
- Consumes: Python scripts in `scripts/` and `backend-rs/scripts/`
- Produces: Automated linting, complexity checks, and type correctness for all workspace Python tooling.

- [ ] **Step 1: Configure `pyproject.toml` with Ruff and Mypy**
Define strict rules:
- `select = ["E", "F", "W", "C90", "I", "N", "PLR0912", "PLR0915"]` (complexity & length limits)
- `max-complexity = 12`

- [ ] **Step 2: Run ruff check on scripts**
Run: `ruff check scripts/ backend-rs/scripts/`
Expected: Identify any syntax or quality issues in Python scripts.

- [ ] **Step 3: Integrate Python sensors into `scripts/pre-merge-check.sh`**
Add ruff validation step to `scripts/pre-merge-check.sh`.

- [ ] **Step 4: Commit Task 3**
```bash
git add pyproject.toml scripts/pre-merge-check.sh
git commit -m "chore(sensors): add python ruff and maintainability sensor configuration"
```

---

### Task 4: Modularity & Coupling Regression Sensors

**Files:**
- Modify: `frontend/eslint.config.js`
- Test: `pnpm --filter frontend lint`

**Interfaces:**
- Consumes: `eslint-plugin-boundaries`
- Produces: Barrel/index boundary rules preventing deep internal imports into private domain modules.

- [ ] **Step 1: Tighten boundary rules to require public API consumption**
Ensure subdomains (`Analytics`, `Tax`, `Dashboard`, `Family`, `Auth`, `Insights`) expose clear entry contracts and disallow private deep imports from outer scopes.

- [ ] **Step 2: Verify boundaries lint**
Run: `pnpm --filter frontend lint`
Expected: PASS.

- [ ] **Step 3: Commit Task 4**
```bash
git add frontend/eslint.config.js
git commit -m "chore(sensors): tighten modularity and cross-domain boundary sensors"
```

---

### Task 5: End-to-End Verification and CI Integration

**Files:**
- Modify: `scripts/pre-merge-check.sh`
- Test: Full workspace test suites

**Interfaces:**
- Consumes: Tasks 1-4 deliverables
- Produces: Unified single-command sensor sweep ensuring clean feedback before agent commits.

- [ ] **Step 1: Run comprehensive pre-merge check**
Run: `./scripts/pre-merge-check.sh`
Expected: 100% green across TypeScript, Rust, and Python.

- [ ] **Step 2: Verify git status and commit**
```bash
git commit -m "chore(sensors): complete maintainability sensor harness implementation"
```
