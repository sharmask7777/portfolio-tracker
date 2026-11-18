# Design Document: React Native (Expo) Cross-Platform Mobile Client

**Date:** 2026-11-18  
**Status:** Approved  
**Target Platforms:** iOS & Android  
**Primary Framework:** React Native (Expo SDK) with TypeScript  
**Isolation Worktree:** `.worktrees/feat-mobile-app` (branch: `feat/mobile-app`)

---

## 1. Intent and the "Why"

The portfolio tracker currently operates as a React 19 web frontend connected to a high-performance, Zero-I/O Rust backend (`backend-rs`) backed by PostgreSQL and an asynchronous worker (`portfolio-worker`). While the web interface provides comprehensive financial reporting, deep analytics, and statutory ITR tax schedules, users need an ergonomic, privacy-centric mobile client for iOS and Android.

Key user expectations:
- **Instant Glanceability:** Check net worth, active holdings, asset allocation, and day's returns immediately upon opening the app.
- **Offline Independence & Resilience:** The app must not fail or show blank screens when away from home Wi-Fi or when the self-hosted Docker server is unreachable. All portfolio snapshots, historical NAVs, and transactions are persisted locally.
- **Decoupled Daily Valuation:** Daily NAV updates for mutual funds can be fetched directly on the phone over public HTTPS (via lightweight per-scheme queries to `api.mfapi.in`), recomputing today's market value without requiring an active remote server connection.
- **Seamless Document Ingestion:** Ability to pick CAMS/KFintech CAS PDFs from the mobile device, enter the PDF password, and synchronize them with the remote Docker worker when connected, or queue them locally if offline.
- **Frictionless & Modern Security:** Instant server pairing via QR code scanning from the web dashboard and hardware-backed local biometric unlock (Face ID / Touch ID / Fingerprint) guarding long-lived tokens in Keychain/KeyStore.
- **Martin Fowler Maintainability Sensors:** Full conformance to agent-native coding standards: micro-maintainability caps (cyclomatic complexity $\le 10$, function length $\le 50$, parameters $\le 3$), strict architectural boundaries (`eslint-plugin-boundaries`), Zero-Any mandate, and contract parity with Rust.
- **Cross-Platform Mobile E2E:** Verifiable end-to-end testing for iOS and Android using Maestro declarative UI tests and hermetic component/integration tests via React Native Testing Library.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **G1. True Native Cross-Platform:** High-performance, 60+ FPS native application for both iOS and Android built with React Native and Expo.
- **G2. Offline-First Local Snapshot:** Persistent local database (`expo-sqlite`) caching complete portfolio state (folios, schemes, units, purchase cost, asset classifications, and recent transactions).
- **G3. Direct Public Price Fetcher:** Client-side background or on-demand fetcher that retrieves latest NAVs directly from public sources (lightweight `api.mfapi.in` endpoints) and re-evaluates holding values locally.
- **G4. Remote Docker Synchronization:** Unidirectional read-only snapshot cache (server $\to$ mobile SQLite) + upload outbox for files (mobile $\to$ server).
- **G5. CAS PDF Mobile Upload:** File picker integration for CAS PDFs with local staging, encrypted password capture in Keychain/KeyStore, outbox queue, and progress/status tracking.
- **G6. Modern Authentication:** QR code pairing flow (encoding server URL + one-time secret token) and local biometric unlock (`expo-local-authentication`).
- **G7. Shared Contract Rigor & Zero Drift:** Automatic TypeScript bindings generated from `portfolio-api` export tests directly into `mobile/src/types/generated/`.
- **G8. Maintainability Sensors:** Full ESLint maintainability sensor suite capping complexity and enforcing boundary isolation.
- **G9. Mobile E2E Testing:** Declarative cross-platform Maestro test suite covering pairing, biometric unlock, offline viewing, and document upload on both iOS and Android.

### Non-Goals
- **NG1. Embedded Heavy Rust Domain Execution:** The mobile client will not bundle a full local Rust compile of `portfolio-core` or embedded PostgreSQL database; complex tax oracles (Section 55(2)(ac) grandfathering, Section 112A/111A capital gains tax schedules, and full CAS PDF OCR/regex parsing) are executed on the remote Docker server worker.
- **NG2. Multi-tenant Broker Integrations:** No direct OAuth integration with private brokerage APIs on the mobile client.
- **NG3. Offline Mutation of Transactions:** Mobile does not support offline manual creation/editing of past transactions; changes are ingested via CAS uploads or synced from the server.

### Anti-Goals
- **AG1. Webview Shell:** The app must not be a simple Capacitor/Cordova webview wrapper. It must utilize native mobile navigation, native scrolling, gesture handling, and mobile-optimized charts.
- **AG2. Server-Dependent Launch:** Opening the app must NEVER block on a remote network handshake. The app must render the cached state in sub-100ms.
- **AG3. Insecure Credential Storage:** Plaintext storage of server passwords, API tokens, or encryption keys in standard AsyncStorage is strictly forbidden.
- **AG4. Architectural Drift:** Any usage of `any` or unbounded complexity in TypeScript is strictly barred by static sensors.

---

## 3. Architecture & System Structure

```
+-------------------------------------------------------------+
|                  Mobile App (React Native / Expo)           |
|                                                             |
|  +--------------------+             +--------------------+  |
|  | Presentation Layer |             |  Local Storage     |  |
|  | (Expo Router,      |             |  - expo-sqlite     |  |
|  |  React Native,     | <---------> |    (Holdings, NAVs,|  |
|  |  Wagmi/Victory)    |             |     Transactions)  |  |
|  +--------------------+             |  - expo-secure-    |  |
|            |                        |    store (Tokens)  |  |
|            v                        +--------------------+  |
|  +--------------------+                       ^             |
|  | Sync & Data Layer  |                       |             |
|  | - Direct Public    | ----------------------+             |
|  |   Price Fetcher    |                                     |
|  | - Upload Queue     |                                     |
|  | - Snapshot Sync    |                                     |
|  +--------------------+                                     |
+------------|------------------------------------------------+
             |
             +------------+ (When Public Internet Available)
             |            v
             |     [ Public Market Feeds ]
             |     - api.mfapi.in (Per-scheme lightweight JSON)
             |
             +------------+ (When Remote Server Reachable)
                          v
             [ Self-Hosted Docker Server ]
             - portfolio-api (Axum REST API: /api/v1/auth/pair, /api/v1/sync, etc.)
             - portfolio-worker (CAS PDF processing & valuation)
             - PostgreSQL (Central source of truth)
```

---

## 4. Key Architectural Decisions

### 4.1 Framework, Toolchain & Sensors
- **Framework:** React Native with Expo SDK (Managed Workflow).
- **Navigation:** Expo Router (File-based routing, native tab bar, stack navigation, and deep linking).
- **Styling:** NativeWind / Tailwind CSS for React Native.
- **State Management & Server Cache:** TanStack Query (`@tanstack/react-query`) with persistent offline storage hydration.
- **Maintainability Sensors:**
  - `eslint.config.js` with cognitive complexity $\le 10$, max function lines $\le 50$, max params $\le 3$.
  - `eslint-plugin-boundaries` preventing UI components from accessing raw SQLite queries directly (forcing usage of repository/service layer).
  - TypeScript strictness (`noImplicitAny`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
  - `knip --production` ensuring zero dead code.

### 4.2 Local Storage & Offline Engine
- **Database:** `expo-sqlite`
  - Tables: `portfolios`, `folios`, `holdings`, `nav_history`, `transactions`, `sync_queue`.
- **Public Price Feed Engine:**
  - Client queries public endpoint (`https://api.mfapi.in/mf/<amfi_code>`).
  - Matches scheme AMFI codes cached in local holdings.
  - Updates local `current_nav`, `nav_date`, and computes `current_value = units * current_nav`.
  - Computes day's gain/loss using previous close NAV.

### 4.3 Mobile CAS Upload & Sync Queue
- Native document picker (`expo-document-picker`) allows selecting CAS PDF files.
- Collects PDF password, stages the file reference, and securely saves the password in `expo-secure-store`.
- If online, calls `POST /api/v1/cas/upload` on `portfolio-api` with multipart/form-data.
- If offline, stores file reference in `sync_queue` table with status `PENDING_UPLOAD` and uploads when network is available.

### 4.4 Authentication: QR Code Pairing & Local Biometrics
- **Pairing Flow:**
  1. Web app displays QR code containing: `{ serverUrl: "https://...", pairingSecret: "...", expiresAt: 123456 }`.
  2. Mobile app scans QR code via `expo-camera`.
  3. Mobile app exchanges pairing secret with `portfolio-api` for a long-lived device token.
  4. Token is stored securely in iOS Keychain / Android KeyStore via `expo-secure-store`.
- **Local Biometrics:**
  - Local lock screen backed by `expo-local-authentication` (Face ID, Touch ID, Biometric Prompt, Device Passcode fallback).

### 4.5 Testing & E2E Verification
- **Unit & Integration:** Vitest + React Native Testing Library (`@testing-library/react-native`).
- **Mobile E2E:** Maestro YAML flows (`mobile/e2e/`) running across both iOS and Android:
  - `pair-flow.yaml`: QR scan simulation, token storage, and initial hydration.
  - `offline-dashboard.yaml`: Disconnected startup, reading from SQLite, and AMFI feed valuation.
  - `cas-upload.yaml`: Document selection, password entry, outbox queuing, and server sync.

---

## 5. Directory Structure & Code Organization

The mobile project lives in `mobile/` in the repository root:

```
portfolio-tracker/
├── backend-rs/                  # Rust Backend (Zero-I/O portfolio-core, API, DB, Worker)
│   └── crates/portfolio-api/    # Pairing endpoints & token exchange
├── frontend/                    # Web React 19 Frontend (includes "Pair Mobile App" QR modal)
│   └── src/types/generated/     # Rust-exported TypeScript contracts
├── mobile/                      # Cross-Platform React Native App
│   ├── app/                     # Expo Router file-based screens
│   │   ├── (auth)/              # QR scan pairing, Biometric lock screen
│   │   ├── (tabs)/              # Dashboard, Holdings, Analytics, Settings
│   │   └── cas-upload.tsx       # Document picker & upload screen
│   ├── src/
│   │   ├── api/                 # Axios / TanStack Query client to portfolio-api
│   │   ├── db/                  # Local SQLite schema, migrations, queries
│   │   ├── feeds/               # AMFI & public price fetching service
│   │   ├── services/            # Biometrics, Sync Queue
│   │   ├── components/          # Native UI widgets, cards, charts
│   │   └── types/generated/     # Shared generated types exported from backend-rs
│   ├── e2e/                     # Cross-platform Maestro E2E test flows
│   │   ├── pair-flow.yaml
│   │   ├── offline-dashboard.yaml
│   │   └── cas-upload.yaml
│   ├── eslint.config.js         # Fowler Maintainability Sensors configuration
│   ├── knip.json                # Dead code sensor configuration
│   ├── package.json
│   ├── app.json                 # Expo configuration
│   └── tsconfig.json
```
