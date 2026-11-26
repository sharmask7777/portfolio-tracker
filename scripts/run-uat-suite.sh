#!/usr/bin/env bash
# ==============================================================================
# Agent-Driven Comprehensive User Acceptance Testing (UAT) Suite
# ==============================================================================
# Executes end-to-end user acceptance tests across Web and Mobile (Android & iOS)
# validating real user interaction flows with synthetic financial datasets:
# - Authentication & Profile Lifecycle
# - Zero-Balance Same-Day CAS Ingestion & Transitivity Resilience
# - True Reality Check Drag Decomposition (Fisher Deflator & Inflation Loss)
# - Statutory Tax Compliance (Section 112A ₹1.25L, Schedule CG Table F)
# - Multi-PAN Family Consolidated Scope Switching
# - Analytics Look-Through, Treemap & Stock Overlap
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

echo "================================================================================"
echo "🚀 Starting Agent-Driven Comprehensive UAT Suite"
echo "Working directory: ${REPO_ROOT}"
echo "================================================================================"

START_TIME=$(date +%s)

echo ""
echo "▶ [1/4] Preflight Guardrail: Privacy & View Layer Isolation"
python3 scripts/check-privacy-and-pii.py
python3 scripts/check-view-layer-boundaries.py

echo ""
echo "▶ [2/4] Web UAT Suite: Playwright E2E Verification"
echo "Running comprehensive user acceptance scenarios on Web..."
pnpm --filter frontend test:e2e tests/uat/comprehensive-uat.spec.ts

echo ""
echo "▶ [3/4] Mobile UAT Suite: Android & iOS Platform Journeys"
echo "Running multi-platform user acceptance scenarios on Mobile..."
pnpm --filter mobile test:e2e src/e2e/uat-comprehensive.test.tsx

echo ""
echo "▶ [4/4] Backend Differential Invariant Parity Gate"
(cd backend-rs && cargo run --package portfolio-parity)

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "================================================================================"
echo "✅ AGENT-DRIVEN UAT SUITE CERTIFICATION: ALL SCENARIOS PASSED"
echo "Total Execution Duration: ${DURATION}s"
echo "Coverage: Web Chrome, Mobile Android, Mobile iOS, Rust Invariant Engine"
echo "================================================================================"
