#!/bin/bash
# Pre-merge validation and sensor harness script for Portfolio Tracker
set -e

echo "🚀 Starting Pre-Merge Sensor & Quality Validation..."

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 1. Python Maintainability & Security Sensors
echo "🐍 [1/7] Running Python Sensors (Ruff & Anti-PII)..."
if command -v ruff >/dev/null 2>&1; then
  ruff check "$REPO_ROOT/scripts" "$REPO_ROOT/backend-rs/scripts"
  echo "✅ Python Ruff linter passed."
else
  echo "❌ ERROR: ruff not found on PATH; install ruff to run Python static linting."
  exit 1
fi
python3 "$REPO_ROOT/scripts/check-privacy-and-pii.py"

# 2. Rust Backend Sensors, Hermetic Pipeline & Coverage
echo "🦀 [2/7] Running Rust Backend Sensor Suite & Coverage..."
(cd "$REPO_ROOT/backend-rs" && ./scripts/verify.sh)
pnpm run test:coverage:backend

# 3. Shared Core-View Package Sensors & Coverage
echo "📦 [3/7] Running @portfolio/core-view Sensors & Coverage..."
pnpm --filter @portfolio/core-view typecheck
pnpm --filter @portfolio/core-view test:coverage

# 4. TypeScript Frontend Sensors (Build, Lint, Types, Knip, Unit Tests)
echo "⚡ [4/7] Running Frontend Sensors & Verification..."
pnpm --filter frontend build
pnpm --filter frontend test:unit

# 5. Mobile Client Sensors & E2E
echo "📱 [5/7] Running Mobile Sensors & E2E..."
pnpm --filter @portfolio/core-view build:verify
pnpm --filter mobile build:verify
pnpm --filter mobile test:e2e

# 6. Cross-Platform Feature Parity Gate
echo "🔄 [6/7] Running Web-Mobile Domain Parity Verification Gate..."
pnpm parity:check

# 7. Cross-Platform Visual Parity & Architecture Invariants Gate
echo "👁️  [7/7] Running Web-Mobile Visual Parity & Architecture Invariants Gate..."
pnpm parity:visual

# 7. Summary
echo "================================================================================"
echo "🎉 All Multi-Language Maintainability Sensors & Verification Stages PASSED!"
echo "================================================================================"
