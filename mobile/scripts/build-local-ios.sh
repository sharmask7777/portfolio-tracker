#!/usr/bin/env bash
# ==============================================================================
# build-local-ios.sh - Build local iOS IPA or Simulator build via Xcode
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

TARGET="${1:-simulator}" # "simulator" or "device"

echo "==> Building iOS (${TARGET}) in ${MOBILE_DIR}..."
cd "${MOBILE_DIR}"

# 1. Prebuild native iOS project if not present
if [ ! -d "ios" ]; then
    echo "==> Running expo prebuild for iOS..."
    npx expo prebuild --platform ios --clean
fi

# 2. Build via xcodebuild
cd ios
if [ "${TARGET}" = "simulator" ]; then
    echo "==> Building for iOS Simulator..."
    xcodebuild -workspace PortfolioTracker.xcworkspace \
               -scheme PortfolioTracker \
               -configuration Release \
               -sdk iphonesimulator \
               -derivedDataPath build \
               clean build
    echo "==> Simulator build completed in ios/build/Build/Products/Release-iphonesimulator/"
else
    echo "==> Building archive for iOS Device..."
    xcodebuild -workspace PortfolioTracker.xcworkspace \
               -scheme PortfolioTracker \
               -configuration Release \
               -archivePath build/PortfolioTracker.xcarchive \
               clean archive
    echo "==> Archive created at ios/build/PortfolioTracker.xcarchive"
    echo "Export using your Apple Developer Team provisioning profile or use EAS build."
fi
