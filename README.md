# Portfolio Tracker (MVP)

A deep-analytics portfolio tracking platform for Indian investors. Supports CAMS/Karvy CAS statements, real-time performance tracking, deep X-Ray analytics, and advanced tax optimization.

## 🚀 Quick Start (Pre-built Docker Images)

The easiest way to run the application is using the pre-built images from Docker Hub.

### 1. Setup Environment
Create a `.env` file in your root directory:
```bash
# DB Credentials
PORTFOLIO_DB_USER=portfolio_admin
PORTFOLIO_DB_PASSWORD=select_a_strong_password
PORTFOLIO_DB_NAME=portfolio_tracker

# Network
IP_GLOBAL=192.168.x.x  # Your machine/NAS IP
```

### 2. Run with Docker Compose
Create a `docker-compose.yml` (or use the one in this repo) and run:
```bash
# Start all services
docker-compose up -d
```

- **Frontend UI:** `http://localhost:80` (or your NAS IP)
- **Backend API:** `http://localhost:3001`
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
To build and push your own images to a registry:
```bash
# Login
docker login

# Build & Tag
docker build -t shaleenks/portfolio-backend:latest ./backend
docker build -t shaleenks/portfolio-frontend:latest ./frontend

# Push
docker push shaleenks/portfolio-backend:latest
docker push shaleenks/portfolio-frontend:latest
```

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
