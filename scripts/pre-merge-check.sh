#!/bin/bash
# Pre-merge validation and sensor harness script for Portfolio Tracker
set -e

echo "🚀 Starting Pre-Merge Sensor & Quality Validation..."

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 1. Python Maintainability & Security Sensors
echo "🐍 [1/4] Running Python Sensors (Ruff & Anti-PII)..."
if command -v ruff >/dev/null 2>&1; then
  ruff check "$REPO_ROOT/scripts" "$REPO_ROOT/backend-rs/scripts"
  echo "✅ Python Ruff linter passed."
else
  echo "⚠️  Ruff not found on PATH; skipping Python static linting."
fi
python3 "$REPO_ROOT/scripts/check-privacy-and-pii.py"

# 2. Rust Backend Sensors & Hermetic Pipeline
echo "🦀 [2/4] Running Rust Backend Sensor Suite..."
(cd "$REPO_ROOT/backend-rs" && ./scripts/verify.sh)

# 3. TypeScript Frontend Sensors (Lint, Types, Knip, Unit Tests)
echo "⚡ [3/4] Running Frontend Sensors & Verification..."
pnpm --filter frontend build:verify
pnpm --filter frontend test:unit

# 4. Summary
echo "================================================================================"
echo "🎉 All Multi-Language Maintainability Sensors & Verification Stages PASSED!"
echo "================================================================================"
