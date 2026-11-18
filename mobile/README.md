# Portfolio Tracker — React Native Mobile Client (iOS & Android)

A native, offline-first mobile companion for the Portfolio Tracker ecosystem built with React Native and Expo. Designed for Indian mutual fund and stock investors who demand instant glanceability, local privacy, offline independence, and statutory accuracy.

---

## 📱 Highlights & Capabilities

- **Instant Glanceability:** Sub-100ms startup rendering total net worth, day's returns, asset allocation, and active holdings directly from an on-device database.
- **Offline-First Independence:** Operates completely disconnected without failing or displaying blank screens when away from home Wi-Fi or when the self-hosted Docker server is unreachable.
- **Direct Public AMFI NAV Feeds:** Evaluates latest mutual fund values on-device over public HTTPS via `api.mfapi.in`, recomputing portfolio valuation and day change without requiring connection to the self-hosted server.
- **Seamless Document Ingestion:** Built-in CAS PDF document picker (`expo-document-picker`) with encrypted password capture, local staging outbox queue (`sync_queue`), and automated retry/sync to the Docker worker.
- **Frictionless QR Code Pairing:** Zero manual typing of API keys. Instantly pair with the self-hosted server by scanning a Web Dashboard QR code (`expo-camera`) and exchanging a single-use cryptographically signed secret for a long-lived device token.
- **Hardware-Backed Biometric Security:** Biometric unlock (`expo-local-authentication`: Face ID, Touch ID, BiometricPrompt) protecting credentials held in iOS Keychain and Android KeyStore via `expo-secure-store`.
- **Martin Fowler Maintainability Sensors:** Strict ESLint micro-maintainability caps (cyclomatic complexity $\le 10$, function length $\le 50$, parameters $\le 3$, file length $\le 300$) and layer boundary isolation (`eslint-plugin-boundaries`).
- **Shared Rust Contract Parity:** 100% type safety and zero drift via TypeScript contracts automatically generated from the Rust backend (`backend-rs`).
- **Dual-Tier E2E Verification:** Automated hermetic simulator-free E2E test runner (`pnpm --filter mobile test:e2e`) combined with native cross-platform Maestro flows (`pnpm --filter mobile test:e2e:maestro:ios` / `android`).

---

## 🏛️ Architecture Overview

The mobile client follows a unidirectional, offline-first architecture separating Presentation, Business Logic/Services, Data Feeds, and Local Storage.

```
+--------------------------------------------------------------------------+
|                       Mobile App (React Native / Expo)                   |
|                                                                          |
|  +------------------------------------+    +--------------------------+  |
|  | Presentation Layer (Expo Router)   |    | Local Storage Vault      |  |
|  | - app/(auth): pair.tsx, lock.tsx   |    | - expo-sqlite            |  |
|  | - app/(tabs): dashboard, holdings, |<-->|   (portfolios, folios,   |  |
|  |               upload, settings     |    |    holdings, nav_history,|  |
|  | - src/components/: UI widgets      |    |    sync_queue)           |  |
|  +------------------------------------+    | - expo-secure-store      |  |
|                   |                        |   (Server URL & tokens)  |  |
|                   v                        +--------------------------+  |
|  +------------------------------------+                  ^               |
|  | Services & Domain Engine           |                  |               |
|  | - Portfolio & Valuation Calculator |------------------+               |
|  | - Sync Queue & Outbox Manager      |                                  |
|  | - Auth & Biometric Service         |                                  |
|  +------------------------------------+                                  |
+-------------------|------------------------------------------------------+
                    |
                    +------------> [ Public Market Feeds ]
                    |              - api.mfapi.in/mf/<amfi_code> (Per-scheme NAVs)
                    |              (Direct HTTPS, No Self-Hosted Server Needed)
                    |
                    +------------> [ Self-Hosted Docker Server ]
                                   - portfolio-api (Axum REST API: /api/v1/auth/pair, /api/v1/cas/upload)
                                   - portfolio-worker (Asynchronous CAS PDF parsing)
                                   - PostgreSQL (Primary persistent ledger)
```

### 1. Presentation Layer (`app/` & `src/components/`)
- Uses **Expo Router** file-based navigation with native animations and responsive layouts.
- **`(auth)` Route Group:** Handles server pairing via QR scanning (`pair.tsx`) and biometric application lock (`lock.tsx`).
- **`(tabs)` Route Group:** Provides four core tabs:
  - `index.tsx`: Main Dashboard showing Net Worth card, Day Return banner, and Asset Allocation breakdown.
  - `holdings.tsx`: Filterable holdings list with search by scheme name, grouped by asset class.
  - `upload.tsx`: CAS PDF picker, password input, and outbox queue management.
  - `settings.tsx`: Server connection details, offline/online status indicator, cache management, and unpair button.

### 2. Local Database Layer (`src/db/`)
- Powered by `expo-sqlite`, providing offline relational storage for instant launch.
- **`portfolios`**: User portfolio identifiers and sync metadata.
- **`folios`**: Folio numbers, AMC identifiers, and investor PAN associations.
- **`holdings`**: Scheme details, units, invested cost, latest NAV, current valuation, and asset classification.
- **`nav_history`**: Historical NAV dates and values indexed by `(amfi_code, date)` for daily return calculations.
- **`sync_queue`**: CAS upload outbox tracking staged files, encrypted credentials, retry attempts, and upload states (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`).

### 3. Direct Public AMFI Feeds (`src/feeds/`)
- Fetches real-time mutual fund NAVs from public AMFI endpoints (`https://api.mfapi.in/mf/<amfi_code>`).
- If the phone has public internet access, it refreshes daily NAVs directly on the device, calculates day change against the previous close, and updates the local SQLite database.
- Completely decouples daily valuation updates from self-hosted server availability.

### 4. Upload Queue & Outbox Sync (`src/services/upload-queue.ts`)
- Manages offline document uploads. When the user picks a CAS PDF while offline:
  1. The PDF reference is staged in local storage.
  2. The PDF password is encrypted and stored in `expo-secure-store`.
  3. A record is added to `sync_queue` with `PENDING` status.
  4. When connectivity is restored, the queue runner flushes items via `POST /api/v1/cas/upload` on `portfolio-api`.

---

## 🛡️ Martin Fowler Maintainability Sensors

To prevent code rot, circular spaghetti, and unbounded cognitive burden, this codebase strictly enforces agent-native micro-maintainability sensors configured in `eslint.config.js`:

| Sensor Metric | Configured Rule | Threshold / Enforcement | Rationale |
| :--- | :--- | :--- | :--- |
| **Cyclomatic Complexity** | `complexity` | **$\le 10$** (`error`) | Caches decision tree branching; forces extraction of pure calculation helpers. |
| **Function Length** | `max-lines-per-function` | **$\le 50$ lines** (`error`) | Ensures single responsibility principle; eliminates monolithic rendering functions. |
| **Function Parameters** | `max-params` | **$\le 3$ params** (`error`) | Prevents parameter explosion; mandates cohesive options/input objects. |
| **File Length** | `max-lines` | **$\le 300$ lines** (`error`) | Forces modular cohesion across components, hooks, and services. |
| **The Zero-Any Rule** | `@typescript-eslint/no-explicit-any` | **`error`** | Zero `any` allowed in production TypeScript code. |
| **Layer Boundaries** | `eslint-plugin-boundaries` | **`error`** | Programmatically blocks cross-layer architecture violations. |
| **Dead-Code Auditing** | `knip --production` | **0 unused** (`error`) | Barred unused exports, dead files, or orphaned dependencies. |

### Architectural Boundary Rules:
- **`components`** cannot directly import from `db` (must access via `services` or `feeds`).
- **`screens` (`app/`)** cannot directly import from `db`.
- **`types`** must not import from any implementation layers.
- **`db`** cannot import from higher layers (`components`, `screens`, `services`, `feeds`, `api`).
- **`services`**, **`feeds`**, and **`api`** cannot import `components` or `screens`.

Verify sensors locally at any time:
```bash
pnpm --filter mobile lint
pnpm --filter mobile typecheck
pnpm --filter mobile knip
```

---

## 🔗 Pairing with Self-Hosted Server

The mobile app pairs seamlessly with your self-hosted Portfolio Tracker instance:

```
[ Web Dashboard ]                                              [ Mobile App ]
      |                                                              |
1. Click "Pair Mobile App"                                           |
      |                                                              |
2. POST /api/v1/auth/pair/init                                       |
   Returns { pairingSecret, expiresAt }                              |
      |                                                              |
3. Displays QR code containing:                                      |
   { serverUrl, pairingSecret, expiresAt }                           |
      |                                                              |
      +------------------------ (User Scans QR) -------------------->|
                                                                     |
                                                       4. POST /api/v1/auth/pair/claim
                                                          Payload: { pairingSecret }
                                                                     |
                                                       5. Axum API validates secret &
                                                          issues long-lived device token
                                                                     |
                                                       6. Securely saved to Keychain /
                                                          KeyStore via expo-secure-store
                                                                     |
                                                       7. Biometric lock enabled
                                                          (Face ID / Fingerprint)
```

### Manual Pairing Fallback
If the device camera is unavailable, tap **"Enter Pairing Code Manually"** on the mobile screen to input the server URL (e.g., `http://192.168.1.100:3031`) and the 64-character pairing secret displayed beneath the Web QR code.

---

## 💻 Running in Development

### Prerequisites
- Node.js 20+ and `pnpm` 9+
- iOS development: macOS with Xcode 15+ and CocoaPods
- Android development: Android Studio with Android SDK 34+ and Android Virtual Device (AVD)
- Optional: Physical iOS/Android device with the **Expo Go** application installed

### Setup & Launch
1. Install repository dependencies:
   ```bash
   pnpm install
   ```

2. Start the Metro development server:
   ```bash
   pnpm --filter mobile dev
   ```

3. Launch on target platform:
   - **iOS Simulator:** Press `i` in the Expo terminal or run:
     ```bash
     pnpm --filter mobile ios
     ```
   - **Android Emulator:** Press `a` in the Expo terminal or run:
     ```bash
     pnpm --filter mobile android
     ```
   - **Physical Device (Expo Go):** Scan the terminal QR code using the iOS Camera app or the Android Expo Go app. Ensure your phone and development machine are connected to the same local Wi-Fi network.

---

## 🧪 Testing & Verification

The mobile application utilizes a comprehensive dual-tier testing strategy ensuring 100% verifiable correctness both in simulator-free CI environments and on real device emulators.

### 1. Hermetic Unit Tests
Hermetic unit tests cover the database repository, price feed engine, portfolio calculations, upload queue, and tab navigation components:
```bash
pnpm --filter mobile test
```

### 2. Hermetic Simulator-Free E2E Suite
A high-speed, simulator-free E2E test harness (`src/e2e/test-harness.ts`) runs within Vitest:
```bash
pnpm --filter mobile test:e2e
```
This suite automatically parses and verifies the declarative Maestro user flows in memory:
- **`01-pair-device.test.tsx`**: Tests initial launch in unpaired state, manual pairing secret entry, token storage in `expo-secure-store`, and navigation to Dashboard.
- **`02-offline-navigation.test.tsx`**: Tests offline startup, biometric authentication prompt (`expo-local-authentication`), fast SQLite cache hydration (<100ms), and search filtering on the Holdings tab.
- **`03-cas-upload-queue.test.tsx`**: Tests CAS PDF document picking, password encryption, outbox queuing, and network synchronization triggers.
- **`e2e-runner.test.tsx`**: Automated Maestro YAML interpreter asserting UI element visibility and state transitions.

### 3. Native Cross-Platform Maestro E2E Suite
For real device simulation on iOS Simulators and Android Emulators:

1. Install the [Maestro CLI](https://maestro.mobile.dev/getting-started/installing-maestro):
   ```bash
   curl -FsSL "https://get.maestro.mobile.dev" | bash
   ```

2. Run on iOS:
   ```bash
   pnpm --filter mobile test:e2e:maestro:ios
   ```

3. Run on Android:
   ```bash
   pnpm --filter mobile test:e2e:maestro:android
   ```

---

## 📂 Project Directory Structure

```
mobile/
├── app/                          # Expo Router File-Based Routing
│   ├── (auth)/                   # Authentication & Pairing Flows
│   │   ├── _layout.tsx           # Stack configuration
│   │   ├── pair.tsx              # QR camera scanner & manual pair form
│   │   └── lock.tsx              # Biometric lock screen
│   ├── (tabs)/                   # Core Application Tabs
│   │   ├── _layout.tsx           # Bottom navigation tabs config
│   │   ├── index.tsx             # Dashboard screen (Net worth, returns, allocation)
│   │   ├── holdings.tsx          # Holdings list with search
│   │   ├── upload.tsx            # CAS PDF picker & sync outbox
│   │   ├── settings.tsx          # Server connection & cache controls
│   │   └── tabs.test.tsx         # Tab screen unit tests
│   ├── _layout.tsx               # Root application layout & QueryClient provider
│   └── index.tsx                 # App entry & initial auth redirector
├── e2e/                          # Cross-Platform Maestro E2E Flows
│   ├── config.yaml               # Target appId (com.portfolio.mobile) & test env
│   └── flows/
│       ├── 01-pair-device.yaml   # Device pairing flow
│       ├── 02-offline-navigation.yaml # Offline viewing & biometrics flow
│       └── 03-cas-upload-queue.yaml   # CAS PDF upload & sync queue flow
├── src/
│   ├── components/               # Reusable Modular UI Components
│   │   ├── NetWorthCard.tsx      # Total value & cost display
│   │   ├── DayReturnBanner.tsx   # Today's profit/loss percentage
│   │   ├── AssetAllocationCard.tsx # Equity/Debt/Hybrid breakdown
│   │   ├── HoldingCard.tsx       # Scheme item card
│   │   ├── UploadFormCard.tsx    # CAS picker & password form
│   │   ├── UploadQueueCard.tsx   # Outbox queue status card
│   │   ├── ScannerView.tsx       # Expo Camera QR scanner component
│   │   ├── ManualPairForm.tsx    # Manual pairing inputs
│   │   └── useCasUpload.ts       # Document selection hook
│   ├── db/                       # Local SQLite Storage Engine
│   │   ├── schema.ts             # DDL statements & entity definitions
│   │   ├── client.ts             # Database connection singleton
│   │   ├── repository.ts         # Pure CRUD functions (Complexity <= 10)
│   │   └── repository.test.ts    # Database unit tests
│   ├── feeds/                    # Direct Market Feeds
│   │   ├── nav-fetcher.ts        # api.mfapi.in HTTP client & valuation
│   │   ├── types.ts              # Feed response types
│   │   └── nav-fetcher.test.ts   # Feeds unit tests
│   ├── services/                 # Application Business Logic
│   │   ├── auth-service.ts       # SecureStore & biometric auth
│   │   ├── portfolio-service.ts  # Snapshot aggregation & valuation
│   │   ├── portfolio-calculations.ts # Pure financial math calculations
│   │   ├── upload-queue.ts       # Outbox queue runner & sync logic
│   │   ├── upload-actions.ts     # Upload actions helper
│   │   └── *.test.ts             # Service unit tests
│   ├── types/
│   │   └── generated/            # Shared contracts exported from backend-rs
│   └── e2e/                      # Simulator-Free In-Memory E2E Test Suite
│       ├── test-harness.ts       # React Native virtual testing harness
│       ├── 01-pair-device.test.tsx
│       ├── 02-offline-navigation.test.tsx
│       ├── 03-cas-upload-queue.test.tsx
│       └── e2e-runner.test.tsx   # Automated Maestro YAML interpreter
├── app.json                      # Expo application manifest
├── eslint.config.js              # Fowler Maintainability Sensors configuration
├── knip.json                     # Dead-code sensor configuration
├── package.json                  # Scripts & dependencies
├── tsconfig.json                 # Strict TypeScript configuration
└── vitest.config.ts              # Unit and E2E test runner configuration
```

---

## 🔒 Security & Privacy Invariants

- **Synthetic Data Mandate:** Strictly synthetic identifiers only (`ABCDE1234F`). Real PANs or personal identifiable information (PII) are permanently prohibited from code and test fixtures, enforced by `scripts/check-privacy-and-pii.py`.
- **Zero Plaintext Tokens:** All auth tokens and document passwords are stored exclusively in hardware-backed storage (`expo-secure-store`).
- **Zero Remote Leakage:** Daily public NAV queries (`api.mfapi.in`) send only the mutual fund AMFI scheme code. No investor identifiers, portfolio sizes, or unit balances are ever transmitted over public feeds.
