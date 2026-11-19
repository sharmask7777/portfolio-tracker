---
title: "Offline-First Mobile Architecture with Decoupled Valuation and Maintainability Sensors"
date: "2026-11-19"
category: "mobile"
problem_type: "architecture_pattern"
module: "mobile"
component: "offline-persistence-and-feeds"
tags:
  - "mobile"
  - "react-native"
  - "expo"
  - "offline-first"
  - "expo-sqlite"
  - "maintainability-sensors"
  - "decoupled-valuation"
  - "maestro-e2e"
status: "verified"
applies_when:
  - "Porting a complex web application with strict backend domain invariants to a cross-platform mobile client"
  - "Designing offline-resilient portfolio trackers that need live market valuation without constant connection to self-hosted Docker servers"
  - "Enforcing Martin Fowler maintainability sensors (complexity <= 10, function lines <= 50, zero-any, boundary isolation) on a React Native codebase"
  - "Testing cross-platform mobile workflows in CI without requiring heavy emulator/simctl setups"
---

# Offline-First Mobile Architecture with Decoupled Valuation and Maintainability Sensors

## Context
Extending a multi-tier financial analytics application (React web, Axum Rust API, and background workers) to a cross-platform mobile app (iOS and Android) introduces two architectural risks:
1. **Network Fragility:** Self-hosted servers on home LANs, Docker instances, or dynamic IPs are frequently unreachable on mobile cellular networks. A naive mobile client that blocks on server roundtrips results in blank screens or failed app launches.
2. **Invariant Drift & AI Code Bloat:** Implementing mobile-specific business logic can lead to calculation discrepancies against the central Rust calculation engine (`portfolio-core`), unreadable bloated components, or relaxed typing.

## Architectural Patterns & Solutions

### 1. The Decoupled Daily Valuation Pattern
To balance offline availability with mathematical rigor:
- **Server as Authoritative Anchor:** The remote Docker server retains exclusive authority over heavy computations: FIFO lot matching, historical valuation curves, XIRR root-finding, and Schedule CG statutory tax schedules.
- **Client-Side Live Price Evaluation:** Mobile holds active units and purchase costs in local SQLite (`expo-sqlite`). Daily price updates query public financial endpoints (`https://api.mfapi.in/mf/<amfi_code>`) directly over HTTPS.
- **Invariant Protection:** The mobile client only computes holding-level market values (`units * current_nav`) and day's returns (`((latest - prev) / prev) * 100`). Portfolio-level return curves remain pinned to the last server sync snapshot, preventing mathematical drift from the Invariant Oracle Law.

### 2. Reliable Outbox Sync Queue for Documents
Statement uploads (CAS PDFs) require resilient delivery when connection to the self-hosted server drops:
- Rather than uploading directly in the UI thread, user-picked files are enqueued into a local SQLite `sync_queue` table with status `PENDING`.
- Statement passwords (e.g., PAN or DOB) are stored in hardware-backed storage (`expo-secure-store`) keyed to the queue ID (`CAS_PWD_<id>`), never in plaintext SQLite.
- A background queue runner flushes the outbox when online, automatically incrementing retry counts on failure and notifying the user when statements are queued offline.

### 3. Martin Fowler Maintainability Sensors for React Native
The `mobile/` workspace applies strict lint and compiler guardrails:
- **Micro-Maintainability Caps:**
  - Cyclomatic complexity $\le 10$ (`complexity: ["error", 10]`)
  - Function length $\le 50$ lines (`max-lines-per-function: ["error", { max: 50 }]`)
  - Function parameters $\le 3$ (`max-params: ["error", 3]`)
  - File length $\le 300$ lines (`max-lines: ["error", { max: 300 }]`)
  - Zero-Any Rule: `@typescript-eslint/no-explicit-any: "error"`
- **Architectural Boundary Enforcement (`eslint-plugin-boundaries`):**
  - UI screens and components are prohibited from importing raw SQLite database instances; all data operations must flow through services or repository helpers.
  - Type definitions are isolated from all runtime layers to prevent circular dependencies.
- **Dead-Code Auditing:** `knip --production` runs on every build, ensuring zero unused exports or abandoned dependencies.

### 4. Two-Tier Mobile Verification (Maestro + Hermetic CI)
Testing mobile workflows on CI machines that lack Xcode or Android SDK licenses:
- **Declarative Real-Device Flows (Maestro):** `mobile/e2e/flows/` provides declarative YAML flows for running on actual simulators and devices.
- **In-Memory Hermetic E2E Harness:** `mobile/src/e2e/test-harness.ts` provides a zero-I/O in-memory React and SQLite runtime executing identical user journeys (pairing, biometric unlock, offline valuation, outbox queue) in under 400ms without device dependencies.
