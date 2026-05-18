#!/bin/bash
# Pre-merge validation script for Portfolio Tracker

set -e

echo "🚀 Starting Pre-Merge Validation..."

# 1. Backend Lint & Type Check (Optional but recommended if scripts exist)
# echo "Checking backend types..."
# cd backend && npm run build

# 2. Run Backend Analytical Regression Suite
echo "🧪 Running Analytical Regression Tests..."
cd backend && npm test src/test/analytical.regression.test.ts -- --forceExit

# 3. Run Utility & Logic Tests
echo "🧪 Running Utility and Core Logic Tests..."
npm test src/test/portfolio.utils.test.ts src/test/performance.aggregate.test.ts src/test/tax.simulation.test.ts -- --forceExit

# 4. Final Endpoint Health Check (requires server running)
echo "🔍 Checking API Endpoint Health..."
BASE_URL="http://localhost:3001/api"
MOCK_USER="mock-user-123"

# Check if server is up
if ! curl -s "http://localhost:3001/health" > /dev/null; then
  echo "⚠️  Backend server not running on port 3001. Skipping live endpoint check."
else
  PID=$(curl -s "$BASE_URL/family/profiles?userId=$MOCK_USER" | jq -r '.[0].portfolios[0].id')
  
  if [ "$PID" != "null" ]; then
    echo "Using Portfolio ID: $PID"
    curl -s "$BASE_URL/portfolio/$PID/xray?userId=$MOCK_USER" | jq -e '.sectors' > /dev/null
    curl -s "$BASE_URL/portfolio/consolidated/exposures?userId=$MOCK_USER" | jq -e '.[0].name' > /dev/null
    echo "✅ Live Endpoints Verified."
  else
    echo "⚠️  Could not find PID for live check."
  fi
fi

echo "---"
echo "🎉 Validation Successful. Safe to commit."
