#!/usr/bin/env bash
# ==============================================================================
# emulate-android.sh - Launch local Android Emulator & Portfolio Tracker App
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${MOBILE_DIR}/.." && pwd)"

export DEVELOPER_DIR="/Library/Developer/CommandLineTools"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
export PATH="${JAVA_HOME}/bin:${HOME}/.maestro/bin:${ANDROID_HOME}/emulator:${ANDROID_HOME}/platform-tools:${PATH}"

echo "📱 ======================================================================"
echo "   Portfolio Tracker - Interactive Local Android Emulation"
echo "=========================================================================="

# 1. Check or start Android Emulator
if ! adb devices | grep -q "emulator"; then
    echo "==> Starting Android Studio Emulator (Medium Phone API 37)..."
    "${ANDROID_HOME}/emulator/emulator" -avd Medium_Phone_API_37.0 &
    echo "==> Waiting for Android Emulator to finish booting..."
    adb wait-for-device
    while [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" != "1" ]; do
        sleep 2
    done
    echo "✅ Android Emulator booted and ready."
else
    echo "✅ Android Emulator is already running."
fi

# 2. Check or start Backend Server (port 8080)
if ! curl -sf http://localhost:8080/health >/dev/null 2>&1 && ! curl -sf http://localhost:8080/api/health >/dev/null 2>&1; then
    echo "==> Starting backend-rs REST API server on port 8080..."
    (cd "${REPO_ROOT}/backend-rs" && PORT=8080 cargo run --package portfolio-api) > /tmp/portfolio-api.log 2>&1 &
    sleep 3
    echo "✅ Backend API server running on http://localhost:8080 (http://10.0.2.2:8080 in emulator)."
else
    echo "✅ Backend API server is already running."
fi

# Seed test account
curl -sf -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}' >/dev/null 2>&1 || true

# 3. Ensure APK exists and install to emulator
APK_PATH="${MOBILE_DIR}/android/app/build/outputs/apk/release/app-release.apk"
if [ ! -f "${APK_PATH}" ]; then
    APK_PATH="${MOBILE_DIR}/android/app/build/outputs/apk/debug/app-debug.apk"
fi

if [ ! -f "${APK_PATH}" ]; then
    echo "==> APK not found. Compiling native release build..."
    (cd "${MOBILE_DIR}/android" && ./gradlew assembleRelease --no-daemon)
    APK_PATH="${MOBILE_DIR}/android/app/build/outputs/apk/release/app-release.apk"
fi

echo "==> Installing Portfolio Tracker on Android Emulator..."
adb install -r "${APK_PATH}"

echo "==> Launching app..."
adb shell am start -n com.portfolio.mobile/.MainActivity

echo ""
echo "=========================================================================="
echo "🎉 Portfolio Tracker is now running on your Android Emulator!"
echo "   Direct Login Credentials for testing:"
echo "     • Server URL: http://10.0.2.2:8080"
echo "     • Email:      admin@example.com"
echo "     • Password:   password123"
echo "=========================================================================="
