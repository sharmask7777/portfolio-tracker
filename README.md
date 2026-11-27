# Portfolio Tracker

A privacy-first, self-hosted portfolio tracking and analytics platform for Indian investors. Supports CAMS/KFintech Consolidated Account Statements (CAS), real-time valuation, deep X-Ray stock overlap analytics, Budget 2024 capital gains tax optimization, and an offline-first mobile companion app.

---

## ✨ Key Capabilities

- **CAS Statement Ingestion:** Upload password-protected CAMS/KFintech CAS PDFs for automated, clean-slate transaction reconstruction.
- **Portfolio X-Ray & Overlap:** Look through mutual fund holdings to see underlying company exposures, sector allocations, market-cap breakdowns, and cross-fund overlap.
- **Tax Optimization (Budget 2024 Ready):** FIFO capital gains accounting, Section 112A LTCG grandfathering (Jan 31, 2018 FMV) & ₹1.25L harvesting, Section 50AA debt taxation, sell simulation, and ITR Schedule CG export.
- **Family Portfolio Management:** Track multiple PAN profiles individually or in a consolidated family view.
- **Offline-First Mobile App:** Native Android & iOS companion with biometric lock, QR pairing, on-device AMFI NAV refreshes, and offline CAS upload queuing.

---

## 🐳 Self-Hosting (Docker Quick Start)

You can run the full web application and backend on any machine or home server (NAS/VPS) using Docker—no source code checkout or local build required.

### 1. Create a Project Folder
```bash
mkdir portfolio-tracker
cd portfolio-tracker
```

### 2. Create `.env` Configuration
Create a `.env` file in this folder and update the passwords, JWT secret, and host IP:
```env
# Database
PORTFOLIO_DB_USER=portfolio_admin
PORTFOLIO_DB_PASSWORD=your_secure_password_here
PORTFOLIO_DB_NAME=portfolio_tracker

# Network & Storage
TZ_GLOBAL=UTC
VOLUME_PREFIX_GLOBAL=.
VITE_API_PORT=3031
# Replace localhost with your server's LAN IP (e.g., 192.168.1.100) if accessing from other devices
IP_GLOBAL=localhost

# Authentication (generate with: openssl rand -hex 32)
JWT_SECRET=your_secure_jwt_secret_here
JWT_EXPIRES_IN=7d
```

### 3. Create `docker-compose.yml`
```yaml
services:
  postgres:
    image: postgres:15-alpine
    container_name: portfolio_tracker_db
    restart: always
    environment:
      POSTGRES_USER: ${PORTFOLIO_DB_USER}
      POSTGRES_PASSWORD: ${PORTFOLIO_DB_PASSWORD}
      POSTGRES_DB: ${PORTFOLIO_DB_NAME}
      TZ: ${TZ_GLOBAL}
    volumes:
      - "${VOLUME_PREFIX_GLOBAL}/appdata/portfolio/db:/var/lib/postgresql/data"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${PORTFOLIO_DB_USER} -d ${PORTFOLIO_DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: portfolio_tracker_redis
    restart: always
    environment:
      TZ: ${TZ_GLOBAL}
    volumes:
      - "${VOLUME_PREFIX_GLOBAL}/appdata/portfolio/redis:/data"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    image: shaleenks/portfolio-backend:latest
    container_name: portfolio_tracker_backend
    restart: always
    ports:
      - "${VITE_API_PORT:-3031}:3001"
    environment:
      DATABASE_URL: "postgresql://${PORTFOLIO_DB_USER}:${PORTFOLIO_DB_PASSWORD}@postgres:5432/${PORTFOLIO_DB_NAME}?schema=public"
      REDIS_HOST: redis
      REDIS_PORT: 6379
      PORT: 3001
      PYTHON_PATH: python3
      UPLOADS_DIR: /app/uploads
      TZ: ${TZ_GLOBAL}
      JWT_SECRET: ${JWT_SECRET}
    volumes:
      - shared_uploads:/app/uploads
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  worker:
    image: shaleenks/portfolio-backend:latest
    container_name: portfolio_tracker_worker
    restart: always
    command: ["portfolio-worker"]
    environment:
      DATABASE_URL: "postgresql://${PORTFOLIO_DB_USER}:${PORTFOLIO_DB_PASSWORD}@postgres:5432/${PORTFOLIO_DB_NAME}?schema=public"
      REDIS_HOST: redis
      REDIS_PORT: 6379
      PYTHON_PATH: python3
      UPLOADS_DIR: /app/uploads
      TZ: ${TZ_GLOBAL}
    volumes:
      - shared_uploads:/app/uploads
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      backend:
        condition: service_started

  frontend:
    image: shaleenks/portfolio-frontend:latest
    container_name: portfolio_tracker_frontend
    restart: always
    ports:
      - "8082:80"
    environment:
      VITE_API_URL: "http://${IP_GLOBAL}:${VITE_API_PORT}"
      TZ: ${TZ_GLOBAL}
    depends_on:
      - backend

volumes:
  shared_uploads:
```

> [!TIP]
> **Uploads Volume Permissions:** Keep the named Docker volume `shared_uploads:/app/uploads` so the `backend` and `worker` containers share upload permissions cleanly. If you bind-mount a host directory instead, ensure it is writable by UID:GID `1000:1000`.

### 4. Start & Update
```bash
# Start the stack
docker compose up -d

# Later, pull the latest published images and recreate containers
docker compose pull && docker compose up -d
```

Once running, open the app:
- **Web UI:** `http://localhost:8082` (or `http://<your-server-ip>:8082`)
- **Backend API:** `http://localhost:3031` (or `http://<your-server-ip>:3031`)

Database schema initialization runs automatically on backend startup—no manual migration steps are required.

---

## 📱 Mobile App (Android & iOS)

### Downloading & Installing
- **Android (Direct APK):** Download `portfolio-tracker-release.apk` from the latest release on **GitHub Releases** and install it directly on your Android device.
- **iOS / Building from Source:** See the [Mobile Guide](mobile/README.md) for EAS cloud builds, Xcode installation, and Over-The-Air (OTA) updates.

### Pairing with Your Self-Hosted Server
1. Open the **Web Dashboard** and click **Pair Mobile App** to generate a single-use QR code.
2. Open the mobile app and scan the QR code (or tap **Enter Pairing Code Manually** to enter your server URL such as `http://192.168.1.100:3031` and the 64-character pairing secret).
3. Enable **Biometric Lock** (Face ID / Touch ID / Fingerprint) to protect your stored device credentials.

Once paired, the mobile app caches your portfolio locally in SQLite for instant offline access and fetches daily mutual fund NAVs directly from public AMFI feeds (`api.mfapi.in`) without exposing any personal identifiers.

---

## 📚 Documentation & Contributing

Looking to understand the domain, self-build Docker images, or contribute code?

- **[CONTRIBUTING.md](CONTRIBUTING.md)** — Local development setup, Rust & TypeScript workspace architecture, build-time guardrails, testing, coverage gates, and Docker image publishing.
- **[CONCEPTS.md](CONCEPTS.md)** — Shared domain vocabulary (Portfolios, Folios, Clean-Slate Reconstruction, XIRR, Withdrawal Simulation).
- **[docs/README.md](docs/README.md)** — Architecture docs, tax engine internals, feature guides, design specs, and documented solutions.
- **[mobile/README.md](mobile/README.md)** — Mobile architecture, standalone APK/EAS builds, OTA updates, and Maestro E2E testing.
- **[AGENTS.md](AGENTS.md)** — Engineering mandates and verification gates for AI coding agents.
