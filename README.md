# Portfolio Tracker (MVP)

A deep-analytics portfolio tracking platform for Indian investors. Supports CAMS/Karvy CAS statements, real-time performance tracking, deep X-Ray analytics, and advanced tax optimization.

## 🚀 Key Features

- **Automated Ingestion:** Upload your CAMS/Karvy CAS PDF to instantly populate your portfolio.
- **Deep Analytics:** 
    - **Portfolio X-Ray:** Breakdown by Sector, Market Cap, and Asset Allocation.
    - **Stock Intersection:** Identify hidden overlaps and concentrated stock bets across multiple mutual funds.
    - **Interactive History:** Day-to-day corpus movement graph (Invested vs Current Value).
- **Financial Math:** Precise, annualized **XIRR** and **CAGR** using stable bisection-based algorithms.
- **Tax Intelligence:** 
    - **Budget 2024 Ready:** Correct calculation for new STCG (20%) and LTCG (12.5%) rules.
    - **Tax Harvesting:** Automatically identifies opportunities to utilize the ₹1.25L annual LTCG exemption.
    - **Pre-trade Simulator:** Analyze the tax impact of selling before you execute a trade.
- **Family Accounts:** Consolidate multiple PANs and portfolios into a unified "Family Net Worth" view.
- **Alternative Assets:** Track EPF, PPF, SGBs, and Physical Gold with live price integration and compounding interest.

## 🛠️ Tech Stack

- **Frontend:** React, TypeScript, Vite, Recharts, Lucide Icons, Nginx (Production).
- **Backend:** Node.js, Express, TypeScript, Prisma 7 (PostgreSQL).
- **Caching:** Redis.
- **Infrastructure:** Docker, Multi-stage Builds, Persistent Volumes.
- **Parsing:** Python 3 + `casparser` library.

## 🏁 Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js (v20+) - *Optional for local dev*
- Python 3.10+ - *Optional for local dev*

### ⚡ One-Command Setup (Recommended)
The fastest way to get the entire stack running is via the unified setup script. This will initialize your environment, install dependencies, and (optionally) start the Docker containers.

```bash
chmod +x setup.sh
./setup.sh
```

### 🐳 Docker Deployment
The project uses production-optimized, multi-stage Docker builds. Data is persisted automatically in Docker-managed volumes.

```bash
# Start all services (Backend, Frontend, DB, Redis)
npm start

# Or directly via Docker Compose
docker-compose up -d --build
```
- **Backend API:** `http://localhost:3001`
- **Frontend UI:** `http://localhost:80` (or `http://localhost:5173` in dev mode)
- **Persistence:** Database data survives `docker-compose down` due to the `postgres_data` volume.

---

## 💻 Development Setup

If you prefer to run services manually for development:

### 1. Environment Initialization
```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

### 2. Infrastructure (DB & Redis)
```bash
docker-compose up -d db redis
```

### 3. Backend Setup
```bash
cd backend
npm install
python3 -m venv venv
./venv/bin/pip install casparser
npx prisma migrate dev
npm run dev
```

### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 🧪 Testing & Quality

We prioritize mathematical integrity and system stability:

- **Unit & Property-Based Testing (PBT):** Rigorous math validation using `fast-check`. Run via `npm test --prefix backend`.
- **E2E Testing:** Playwright-based frontend flows. Run via `npx playwright test --prefix frontend`.
- **Quality Mandates:** Zero-tolerance for `NaN` displays in the UI. Every visualization is verified for data integrity.

## 📖 Maintenance

- **Adding Asset Types:** Update `backend/prisma/schema.prisma` and the `AlternativeAssetService`.
- **Updating Tax Rules:** Modify the logic in `TaxService.ts`.
- **Database Migrations:** When updating the schema, the backend container will automatically run `prisma migrate deploy` on startup. For dev, use `npx prisma migrate dev`.


---
Created with ❤️ by Gemini CLI.
