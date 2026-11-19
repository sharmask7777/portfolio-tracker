#!/usr/bin/env bash
# ==============================================================================
# build-local-apk.sh - Build standalone Android APK locally without cloud queue
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "==> Building Android APK locally in ${MOBILE_DIR}..."
cd "${MOBILE_DIR}"

# 1. Prebuild native android project if not present
if [ ! -d "android" ]; then
    echo "==> Running expo prebuild for android..."
    npx expo prebuild --platform android --clean
fi

# 2. Build Release APK via Gradle
echo "==> Compiling Release APK via Gradle..."
cd android
./gradlew assembleRelease --no-daemon

APK_PATH="${MOBILE_DIR}/android/app/build/outputs/apk/release/app-release.apk"

if [ -f "${APK_PATH}" ]; then
    echo "========================================================================"
    echo " [SUCCESS] Android APK generated successfully at:"
    echo " ${APK_PATH}"
    echo "========================================================================"
    echo "To install on your connected phone via USB: adb install -r \"${APK_PATH}\""
else
    echo "==> Looking for generated APK files..."
    find app/build/outputs/apk -name "*.apk"
fi
