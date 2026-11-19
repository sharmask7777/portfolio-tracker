---
title: "Cross-Platform Mobile Continuous Delivery: Standalone APK Builds, Silent OTA Updates, and Static Security Hardening"
date: "2026-11-19"
category: "mobile"
problem_type: "continuous_delivery_and_security"
module: "mobile"
component: "build-pipeline-and-ota"
tags:
  - "mobile"
  - "react-native"
  - "expo"
  - "eas-build"
  - "ota-updates"
  - "codeql"
  - "gradle-wrapper"
  - "static-guardrails"
status: "verified"
applies_when:
  - "Setting up continuous delivery and automated publishing for cross-platform Expo React Native applications"
  - "Distributing standalone Android APKs outside of Google Play Store with silent Over-The-Air (OTA) runtime updates"
  - "Resolving Gradle wrapper bootstrap timeouts on high-latency networks or machines without local Android SDK installations"
  - "Hardening React Native and GitHub Actions codebases against CodeQL security alerts (insecure randomness, unconstrained GITHUB_TOKEN permissions)"
---

# Cross-Platform Mobile Continuous Delivery: Standalone APK Builds, Silent OTA Updates, and Static Security Hardening

## Context
When shipping a cross-platform React Native / Expo application to end users without listing it on public app stores (Google Play or Apple App Store), two operational and architectural challenges emerge:
1. **Distribution & Update Friction:** Users who manually install `.apk` builds have no built-in app store update mechanism. Requiring users to repeatedly download and sideload APKs for every minor UI fix or JavaScript update creates high friction and rapid version fragmentation.
2. **Build Tooling Fragility & Security Alerts:** Compiling native Android projects locally or on CI requires heavy SDK infrastructure (JDK 17, Android SDK platform tools, Gradle wrapper bootstrapping). In addition, static analysis engines (e.g., GitHub Advanced Security / CodeQL) enforce strict security policies regarding cryptographic pseudo-random number generators and minimum GitHub Actions token permissions.

## Key Learnings & Solved Problems

### 1. Zero-Install APK Generation vs. Local SDK Detection
- **Gradle Bootstrap Timeout:** Gradle wrapper defaults to a 10s connection timeout (`timeout=10000ms`), which frequently fails on high-latency connections during the initial bootstrap download of `gradle-x.y.z-bin.zip` from `services.gradle.org` due to multiple HTTP redirects.
  - *Fix:* Configure `networkTimeout=60000` in `gradle/wrapper/gradle-wrapper.properties` and pass connection/read timeouts via `GRADLE_OPTS="-Dorg.gradle.internal.http.connectionTimeout=60000 -Dorg.gradle.internal.http.socketTimeout=60000"`.
- **Friendly Local Preflight:** Compiling native Android binaries locally on macOS requires `ANDROID_HOME` (~4GB+ Android SDK tools). The `build-local-apk.sh` script preflights `ANDROID_HOME` and guides developers without the SDK to run cloud builds (`pnpm eas:build:android`) or install Android Studio, rather than failing abruptly during Gradle execution.
- **Headless CI Publishing:** `.github/workflows/mobile-publish.yml` automatically triggers on successful E2E test runs on `main`, compiling the standalone release APK in an Ubuntu runner with pre-installed Android SDK and attaching `portfolio-tracker-release.apk` to GitHub Releases.

### 2. Dual-Channel Auto-Update Architecture (Native + Silent OTA)
To allow end users to receive updates without reinstalling APKs:
- **Runtime Over-The-Air (OTA) Updates (`expo-updates`):**
  - Configured with `npx eas-cli update --auto --non-interactive` in CI.
  - When the app boots, `src/services/ota-update-service.ts` queries the configured update channel in the background. If a new JavaScript/asset bundle exists, it silently downloads and prepares the update, applying it automatically on the next launch or prompting the user.
- **Native Binary Fallback (`src/services/app-update-service.ts`):**
  - When native dependencies change (e.g., adding native SQLite or biometric modules) that cannot be updated via OTA, the app checks the GitHub Releases API for newer `portfolio-tracker-release.apk` versions and offers a one-tap direct download link.

### 3. Static Security Guardrails & CodeQL Hardening
- **Cryptographic Randomness vs. Pseudo-Randomness:**
  - Using `Math.random()` to generate UUIDs or random keys in storage/queue contexts triggers high-severity CodeQL alerts (`js/insecure-randomness`).
  - *Rule:* Always prefer standard Web Crypto API (`crypto.randomUUID()` and `crypto.getRandomValues()`), falling back only to cryptographically seeded byte arrays.
- **Least-Privilege GitHub Actions Permissions:**
  - CodeQL flags unconstrained workflow jobs (`actions/workflow-without-permissions`).
  - *Rule:* Every job in GitHub Actions workflows must declare an explicit `permissions:` block (e.g., `permissions: contents: read` for build/test jobs, and `permissions: contents: write` only for release publishing jobs).

### 4. Deterministic System Time in Countdown Tests
- Time-dependent React components (e.g., `PairMobileModal.tsx` displaying `Expires in 5:00`) that compute remaining seconds from `Date.now()` can drift by 1 second (showing `Expires in 4:59`) on slower CI runners if real wall-clock time advances between component mount and assertion.
- *Rule:* Always lock system time deterministically in Vitest using `vi.useFakeTimers()` and `vi.setSystemTime(fixedTimestamp)` before rendering time-sensitive countdown components.
