#!/usr/bin/env bash
# ==============================================================================
# build-local-apk.sh - Build standalone Android APK locally with network resilience
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

# 2. Increase Gradle wrapper network timeout and ensure stable distribution URL
WRAPPER_PROPS="${MOBILE_DIR}/android/gradle/wrapper/gradle-wrapper.properties"
if [ -f "${WRAPPER_PROPS}" ]; then
    # Increase network timeout from 10000ms to 60000ms to prevent SocketTimeoutException
    if grep -q "networkTimeout=" "${WRAPPER_PROPS}"; then
        sed -i '' 's/networkTimeout=.*/networkTimeout=60000/' "${WRAPPER_PROPS}" || true
    else
        echo "networkTimeout=60000" >> "${WRAPPER_PROPS}"
    fi
fi

# 3. Build Release APK via Gradle
echo "==> Compiling Release APK via Gradle..."
cd android

# Pass Gradle JVM arguments with higher connection and read timeouts
export GRADLE_OPTS="-Dorg.gradle.internal.http.connectionTimeout=60000 -Dorg.gradle.internal.http.socketTimeout=120000 -Djava.net.preferIPv4Stack=true"

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
