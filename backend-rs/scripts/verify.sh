#!/usr/bin/env bash
# ==============================================================================
# Unified Hermetic Verification Pipeline Script for Rust Backend
# ==============================================================================
# Enforces strict formatting, type checking, lints, rustdoc guardrails,
# workspace tests, dependency audit (cargo-deny), unused dependency checks,
# and differential parity validation.
# ==============================================================================

set -euo pipefail

# Ensure standard cargo, homebrew, and developer tools binary paths are included in PATH
if [ -d "/Library/Developer/CommandLineTools" ]; then
  export DEVELOPER_DIR="/Library/Developer/CommandLineTools"
  export SDKROOT="/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk"
fi
export PATH="/Library/Developer/CommandLineTools/usr/bin:/opt/homebrew/bin:${HOME}/.cargo/bin:${PATH}"

# Auto-cd to backend-rs root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}/.."

echo "================================================================================"
echo "Starting Unified Rust Backend Verification Pipeline"
echo "Working directory: $(pwd)"
echo "================================================================================"

echo ""
echo "▶ [1/10] Formatting Check: cargo fmt --check"
cargo fmt --check

echo ""
echo "▶ [2/10] Type Checking: cargo check --workspace --all-targets"
cargo check --workspace --all-targets

echo ""
echo "▶ [3/10] Strict Clippy Lints: cargo clippy --workspace --all-targets -- -D warnings"
cargo clippy --workspace --all-targets -- -D warnings

echo ""
echo "▶ [4/10] Static Rustdoc Guardrails: RUSTDOCFLAGS=\"-D warnings\" cargo doc --workspace --no-deps"
RUSTDOCFLAGS="-D warnings" cargo doc --workspace --no-deps

echo ""
echo "▶ [5/10] Workspace Tests: cargo test --workspace"
cargo test --workspace

echo ""
echo "▶ [6/10] Dependency Auditing: cargo deny check"
if command -v cargo-deny >/dev/null 2>&1 || command -v cargo-deny.exe >/dev/null 2>&1 || cargo deny --version >/dev/null 2>&1; then
    cargo deny check
else
    echo "❌ ERROR: cargo-deny not found in PATH (install via 'cargo install --locked cargo-deny' or 'brew install cargo-deny')"
    exit 1
fi

echo ""
echo "▶ [7/10] Unused Dependency Checking: cargo machete"
if command -v cargo-machete >/dev/null 2>&1 || cargo machete --version >/dev/null 2>&1; then
    cargo machete
else
    if [ "${CI:-false}" = "true" ]; then
        echo "❌ ERROR: cargo-machete is required in CI (install via 'cargo install cargo-machete')"
        exit 1
    else
        echo "ℹ️  cargo-machete is optional locally and not installed; skipping unused dependency check"
    fi
fi

echo ""
echo "▶ [8/10] Parity Validation Harness: cargo run --package portfolio-parity"
cargo run --package portfolio-parity

echo ""
echo "▶ [9/10] TypeScript Contract Parity Export & Drift Gate"
cargo test --package portfolio-api --test export_bindings
git diff --exit-code "${SCRIPT_DIR}/../../frontend/src/types/generated" "${SCRIPT_DIR}/../../mobile/src/types/generated"
if [ -n "$(git status --porcelain "${SCRIPT_DIR}/../../frontend/src/types/generated" "${SCRIPT_DIR}/../../mobile/src/types/generated")" ]; then
    echo "❌ ERROR: Untracked or modified files detected in generated types!"
    git status --porcelain "${SCRIPT_DIR}/../../frontend/src/types/generated" "${SCRIPT_DIR}/../../mobile/src/types/generated"
    exit 1
fi

echo ""
echo "▶ [10/10] Static Privacy & Anti-PII Guardrail: scripts/check-privacy-and-pii.py"
python3 "${SCRIPT_DIR}/../../scripts/check-privacy-and-pii.py"

echo ""
echo "================================================================================"
echo "✅ All verification pipeline stages passed successfully!"
echo "================================================================================"
