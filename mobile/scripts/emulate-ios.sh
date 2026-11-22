#!/usr/bin/env bash
# ==============================================================================
# emulate-ios.sh - Launch local iOS Simulator & Portfolio Tracker App
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${MOBILE_DIR}/.." && pwd)"

export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
export PATH="${HOME}/.maestro/bin:${PATH}"

echo "🍎 ======================================================================"
echo "   Portfolio Tracker - Interactive Local iOS Emulation"
echo "=========================================================================="

# 1. Check or start iOS Simulator device
BOOTED_DEVICE_ID="$(xcrun simctl list devices | grep "Booted" | head -n 1 | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/' || true)"

if [ -z "${BOOTED_DEVICE_ID}" ]; then
    DEFAULT_DEVICE="iPhone 17 Pro"
    echo "==> Booting iOS Simulator (${DEFAULT_DEVICE})..."
    xcrun simctl boot "${DEFAULT_DEVICE}" 2>/dev/null || {
        # Fallback to first available shutdown iPhone
        FIRST_IPHONE="$(xcrun simctl list devices | grep -E "iPhone.*Shutdown" | head -n 1 | sed -E 's/.*iPhone/iPhone/' | sed -E 's/ *\(([A-F0-9-]+)\).*/\1/')"
        if [ -n "${FIRST_IPHONE}" ]; then
            xcrun simctl boot "${FIRST_IPHONE}"
        else
            echo "❌ No iOS Simulator device found. Please verify Xcode -> Settings -> Platforms."
            exit 1
        fi
    }
    echo "✅ iOS Simulator booted successfully."
else
    echo "✅ iOS Simulator is already running (Device: ${BOOTED_DEVICE_ID})."
fi

echo "==> Opening Simulator window..."
open -a Simulator
osascript -e 'tell application "Simulator" to activate' 2>/dev/null || true

# 2. Check Backend Server (Docker on 8082 preferred, or local dev on 8080)
# Note: iOS Simulator shares host Mac network, so http://localhost:8082 works directly!
TARGET_SERVER_URL="http://localhost:8080"
if curl -sf http://localhost:8082/api/health >/dev/null 2>&1; then
    echo "✅ Docker Web Stack detected running on http://localhost:8082."
    TARGET_SERVER_URL="http://localhost:8082"
elif ! curl -sf http://localhost:8080/health >/dev/null 2>&1 && ! curl -sf http://localhost:8080/api/health >/dev/null 2>&1; then
    echo "==> Starting backend-rs REST API server on port 8080..."
    (cd "${REPO_ROOT}/backend-rs" && PORT=8080 cargo run --package portfolio-api) > /tmp/portfolio-api.log 2>&1 &
    sleep 3
    echo "✅ Backend API server running on http://localhost:8080."
else
    echo "✅ Backend API server running on http://localhost:8080."
fi

# 3. Ensure native iOS project and build exist
FORCE_REBUILD="${1:-}"
APP_BUNDLE_PATH="${MOBILE_DIR}/ios/build/Build/Products/Debug-iphonesimulator/PortfolioTracker.app"
if [ ! -d "${APP_BUNDLE_PATH}" ]; then
    APP_BUNDLE_PATH="${MOBILE_DIR}/ios/build/Build/Products/Release-iphonesimulator/PortfolioTracker.app"
fi

if [ ! -d "${APP_BUNDLE_PATH}" ] || [ "${FORCE_REBUILD}" = "--rebuild" ] || [ "${FORCE_REBUILD}" = "-r" ]; then
    if [ ! -d "${MOBILE_DIR}/ios" ]; then
        echo "==> Native iOS project directory not found. Generating via Expo prebuild..."
        (cd "${MOBILE_DIR}" && npx expo prebuild --platform ios --clean)
    fi
    echo "==> Compiling native iOS app for simulator via xcodebuild..."
    (cd "${MOBILE_DIR}/ios" && xcodebuild -workspace PortfolioTracker.xcworkspace \
               -scheme PortfolioTracker \
               -configuration Debug \
               -sdk iphonesimulator \
               -derivedDataPath build \
               build)
    APP_BUNDLE_PATH="${MOBILE_DIR}/ios/build/Build/Products/Debug-iphonesimulator/PortfolioTracker.app"
fi

echo "==> Installing Portfolio Tracker on iOS Simulator..."
xcrun simctl install booted "${APP_BUNDLE_PATH}"

echo "==> Launching app..."
xcrun simctl launch booted com.portfolio.mobile

echo ""
echo "=========================================================================="
echo "🎉 Portfolio Tracker is now running on your iOS Simulator!"
echo "   Target Server: ${TARGET_SERVER_URL}"
echo "   Master Edge-Case Synthetic Account (Zero PII):"
echo "     • Email:    synthetic.master@example.com"
echo "     • Password: password123"
echo "=========================================================================="
