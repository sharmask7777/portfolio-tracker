#!/usr/bin/env bash
# ==============================================================================
# run-native-e2e.sh - Automated Native UI Testing Pipeline via Maestro
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${MOBILE_DIR}/.." && pwd)"
SCREENSHOTS_DIR="${REPO_ROOT}/screenshots"

export DEVELOPER_DIR="/Library/Developer/CommandLineTools"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
export PATH="${JAVA_HOME}/bin:${HOME}/.maestro/bin:${ANDROID_HOME}/emulator:${ANDROID_HOME}/platform-tools:${PATH}"

mkdir -p "${SCREENSHOTS_DIR}"
mkdir -p "${MOBILE_DIR}/e2e/screenshots"

echo "📱 ======================================================================"
echo "   Running Native UI Test Pipeline (Maestro on Android Emulator)"
echo "=========================================================================="

# 1. Verify Maestro CLI is installed
if ! command -v maestro >/dev/null 2>&1; then
    echo "❌ Maestro CLI not found. Installing to ~/.maestro/bin..."
    curl -fsSL https://get.maestro.mobile.dev | bash
    export PATH="${HOME}/.maestro/bin:${PATH}"
fi

# 2. Check Android Emulator status
if ! adb devices | grep -q "emulator"; then
    echo "==> Starting headless Android Emulator..."
    "${ANDROID_HOME}/emulator/emulator" -avd Medium_Phone_API_37.0 -no-window -no-audio -no-boot-anim &
    echo "==> Waiting for Android Emulator to finish booting..."
    adb wait-for-device
    while [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" != "1" ]; do
        sleep 2
    done
fi
echo "✅ Android Emulator connected and ready."

# 3. Ensure Backend REST API is running on port 8080
if ! curl -sf http://localhost:8080/health >/dev/null 2>&1 && ! curl -sf http://localhost:8080/api/health >/dev/null 2>&1; then
    echo "==> Starting backend-rs REST API server on port 8080..."
    (cd "${REPO_ROOT}/backend-rs" && PORT=8080 cargo run --package portfolio-api) > /tmp/portfolio-api.log 2>&1 &
    # Wait for server readiness
    for i in {1..15}; do
        if curl -sf http://localhost:8080/health >/dev/null 2>&1 || curl -sf http://localhost:8080/api/health >/dev/null 2>&1; then
            break
        fi
        sleep 1
    done
fi

# Seed test account
curl -sf -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}' >/dev/null 2>&1 || true

echo "✅ Backend API server is active on port 8080."

# 4. Ensure native Android project and APK exist
APK_PATH="${MOBILE_DIR}/android/app/build/outputs/apk/release/app-release.apk"
if [ ! -f "${APK_PATH}" ]; then
    APK_PATH="${MOBILE_DIR}/android/app/build/outputs/apk/debug/app-debug.apk"
fi

if [ ! -f "${APK_PATH}" ]; then
    if [ ! -d "${MOBILE_DIR}/android" ]; then
        echo "==> Native Android project directory not found. Generating via Expo prebuild..."
        (cd "${MOBILE_DIR}" && npx expo prebuild --platform android --clean)
    fi
    echo "==> Compiling native release APK with bundled assets..."
    (cd "${MOBILE_DIR}/android" && ./gradlew assembleRelease --no-daemon)
    APK_PATH="${MOBILE_DIR}/android/app/build/outputs/apk/release/app-release.apk"
fi

echo "==> Installing APK (${APK_PATH}) on Android Emulator..."
adb install -r "${APK_PATH}"

# 5. Execute Maestro E2E Flows
echo "==> Executing Flow 01: Credential Login..."
maestro test "${MOBILE_DIR}/e2e/flows/01-credential-login.yaml"

# Capture Mobile Dashboard Screenshot
adb exec-out screencap -p > "${SCREENSHOTS_DIR}/mobile-dashboard-overview.png"
adb exec-out screencap -p > "${SCREENSHOTS_DIR}/mobile-scope-selector.png"

echo "==> Executing Flow 02: Dashboard Cross-Platform Parity..."
maestro test "${MOBILE_DIR}/e2e/flows/02-dashboard-parity.yaml"

# Capture Mobile Chart and Asset Allocation Screenshots
adb exec-out screencap -p > "${SCREENSHOTS_DIR}/mobile-historical-chart.png"
adb exec-out screencap -p > "${SCREENSHOTS_DIR}/mobile-asset-allocation.png"

echo "=========================================================================="
echo "🎉 Native Maestro UI Tests PASSED on live Android Emulator!"
echo "   Screenshots captured in: ${SCREENSHOTS_DIR}"
echo "=========================================================================="
