# Portfolio Tracker (MVP)

A deep-analytics portfolio tracking platform for Indian investors. Supports CAMS/Karvy CAS statements, real-time performance tracking, deep X-Ray analytics, and advanced tax optimization.

## 🚀 Quick Start (Pre-built Docker Images)

The easiest way to run the application is using the pre-built images from Docker Hub.

### 1. Setup Environment
Create a `.env` file in your root directory from the example:
```bash
cp .env.example .env
```

**Crucial for Linux/Docker:** Ensure `DOCKER_REGISTRY_USER` is set (e.g., `DOCKER_REGISTRY_USER=local`) to avoid tag errors.

### 2. Linux System Dependencies
If running locally on Linux (Debian/Ubuntu), install these for PDF parsing:
```bash
sudo apt-get update
sudo apt-get install -y python3-pip python3-venv python3-dev build-essential libffi-dev libssl-dev
```

### 3. Run with Docker Compose
```bash
# Build local images with Linux-specific fixes
docker-compose build

# Start all services
docker-compose up -d
```

- **Frontend UI:** `http://localhost:8082` (or your mapped port)
- **Backend API:** `http://localhost:3031` (or your mapped port)
- **Images:** [shaleenks/portfolio-backend](https://hub.docker.com/r/shaleenks/portfolio-backend) | [shaleenks/portfolio-frontend](https://hub.docker.com/r/shaleenks/portfolio-frontend)

---

## 🛠️ Tech Stack

- **Frontend:** React, TypeScript, Vite, Recharts, Lucide Icons, Nginx (Production).
- **Backend:** Node.js, Express, TypeScript, Prisma 7 (PostgreSQL).
- **Caching:** Redis.
- **Infrastructure:** Docker, Multi-stage Builds, Persistent Volumes.
- **Parsing:** Python 3 + `casparser` library.

---

## 💻 Developer Instructions

### Prerequisites
- Docker & Docker Compose
- Node.js (v20+)
- Python 3.10+

### 1. Local Build & Run
The project includes a unified setup script to initialize everything locally.

```bash
chmod +x setup.sh
./setup.sh
```

### 2. Manual Development Setup
If you prefer running services individually:

#### Infrastructure
```bash
docker-compose up -d db redis
```

#### Backend
```bash
cd backend
npm install
python3 -m venv venv
./venv/bin/pip install casparser
npx prisma migrate dev
npm run dev
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

### 3. Building & Pushing Images

The project supports both single-platform and multi-architecture builds. Multi-arch is recommended if you develop on Apple Silicon (M1/M2/M3) but deploy on an Intel-based NAS or VPS.

#### Prerequisites
Ensure `DOCKER_REGISTRY_USER` is set in your `.env` file (e.g., `DOCKER_REGISTRY_USER=shaleenks`).

#### Single-Platform Build (Current Machine)
```bash
# Build & Push
docker-compose build
docker-compose push
```

#### Multi-Architecture Build (Recommended for Deployment)
To support both `arm64` (Mac) and `amd64` (NAS/Intel), use Docker Buildx:

```bash
# 1. Create a builder if you haven't already
docker buildx create --use

# 2. Build & Push both architectures simultaneously
# Backend
docker buildx build --platform linux/amd64,linux/arm64 \
  -t ${DOCKER_REGISTRY_USER}/portfolio-backend:latest ./backend --push

# Frontend
docker buildx build --platform linux/amd64,linux/arm64 \
  -t ${DOCKER_REGISTRY_USER}/portfolio-frontend:latest ./frontend --push
```

#### Verification
Check your Docker Hub repository. It should show "OS/ARCH" as `linux/amd64` and `linux/arm64` for the latest tags.


---

## 🧪 Testing & Quality

- **Unit & PBT:** `npm test --prefix backend`
- **E2E Testing:** `npx playwright test --prefix frontend`
- **Quality Mandates:** Zero-tolerance for `NaN` displays in the UI.

## 📖 Maintenance

- **Database Migrations:** The backend container runs `prisma migrate deploy` automatically on startup.
- **Updating Tax Rules:** Modify logic in `TaxService.ts` (Budget 2024 ready).


---
Created with ❤️ by Gemini CLI.
