#!/usr/bin/env bash
# ==============================================================================
# Unified Hermetic Verification Pipeline Script for Rust Backend
# ==============================================================================
# Enforces strict formatting, type checking, lints, rustdoc guardrails,
# workspace tests, dependency audit (cargo-deny), unused dependency checks,
# and differential parity validation.
# ==============================================================================

set -euo pipefail

# Ensure standard cargo and homebrew binary paths are included in PATH
export PATH="/opt/homebrew/bin:${HOME}/.cargo/bin:${PATH}"

# Auto-cd to backend-rs root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}/.."

echo "================================================================================"
echo "Starting Unified Rust Backend Verification Pipeline"
echo "Working directory: $(pwd)"
echo "================================================================================"

echo ""
echo "▶ [1/8] Formatting Check: cargo fmt --check"
cargo fmt --check

echo ""
echo "▶ [2/8] Type Checking: cargo check --workspace --all-targets"
cargo check --workspace --all-targets

echo ""
echo "▶ [3/8] Strict Clippy Lints: cargo clippy --workspace --all-targets -- -D warnings"
cargo clippy --workspace --all-targets -- -D warnings

echo ""
echo "▶ [4/8] Static Rustdoc Guardrails: RUSTDOCFLAGS=\"-D warnings\" cargo doc --workspace --no-deps"
RUSTDOCFLAGS="-D warnings" cargo doc --workspace --no-deps

echo ""
echo "▶ [5/8] Workspace Tests: cargo test --workspace"
cargo test --workspace

echo ""
echo "▶ [6/8] Dependency Auditing: cargo deny check"
if command -v cargo-deny >/dev/null 2>&1 || command -v cargo-deny.exe >/dev/null 2>&1 || cargo deny --version >/dev/null 2>&1; then
    cargo deny check
else
    echo "⚠️  cargo-deny not found in PATH; skipping cargo deny check (install via 'cargo install --locked cargo-deny' or 'brew install cargo-deny')"
fi

echo ""
echo "▶ [7/8] Unused Dependency Checking: cargo machete"
if command -v cargo-machete >/dev/null 2>&1 || cargo machete --version >/dev/null 2>&1; then
    cargo machete
else
    echo "ℹ️  cargo-machete is optional and not installed; skipping unused dependency check"
fi

echo ""
echo "▶ [8/8] Parity Validation Harness: cargo run --package portfolio-parity"
cargo run --package portfolio-parity

echo ""
echo "================================================================================"
echo "✅ All verification pipeline stages passed successfully!"
echo "================================================================================"
