# Portfolio Tracker (MVP)

A deep-analytics portfolio tracking platform for Indian investors. Supports CAMS/Karvy CAS statements, real-time performance tracking, deep X-Ray analytics, and advanced tax optimization.

## 🚀 Key Features

- **Automated Ingestion:** Upload your CAMS/Karvy CAS PDF to instantly populate your portfolio.
- **Deep Analytics:** 
    - **Portfolio X-Ray:** Breakdown by Sector, Market Cap, and Asset Allocation.
    - **Stock Intersection:** Identify hidden overlaps and concentrated stock bets across multiple mutual funds.
- **Financial Math:** Precise, annualized **XIRR** and **CAGR** using stable bisection-based algorithms.
- **Tax Intelligence:** 
    - **Budget 2024 Ready:** Correct calculation for new STCG (20%) and LTCG (12.5%) rules.
    - **Tax Harvesting:** Automatically identifies opportunities to utilize the ₹1.25L annual LTCG exemption.
    - **Pre-trade Simulator:** Analyze the tax impact of selling before you execute a trade.
- **Family Accounts:** Consolidate multiple PANs and portfolios into a unified "Family Net Worth" view.
- **Alternative Assets:** Track EPF, PPF, SGBs, and Physical Gold with live price integration and compounding interest.

## 🛠️ Tech Stack

- **Frontend:** React, TypeScript, Vite, Recharts, Lucide Icons.
- **Backend:** Node.js, Express, TypeScript, Prisma 7 (PostgreSQL).
- **Caching:** Redis.
- **Parsing:** Python 3 + `casparser` library.

## 🏁 Getting Started

### Prerequisites
- Node.js (v18+)
- Python 3.10+
- Docker & Docker Compose

### 1. Setup Infrastructure
Start the PostgreSQL and Redis containers:
```bash
docker-compose up -d
```

### 2. Backend Setup
The backend uses Prisma 7 with a specific configuration. **Prisma commands MUST be run from the `backend/` directory.**

```bash
cd backend
npm install

# Setup environment variables
cp .env.example .env

# Setup Python virtual environment for PDF parsing
python3 -m venv venv
./venv/bin/pip install casparser rapidfuzz

# Database Setup (Prisma 7)
npx prisma migrate dev --name init
npx prisma generate

# Start dev server
npm run dev
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 4. Running Everything Together
You can also run both servers from the root directory after completing the setup:
```bash
npm run dev
```

## 🧪 Testing & Quality

We prioritize mathematical integrity and system stability through a multi-layered approach:

- **Unit & Property-Based Testing (PBT):** Rigorous math validation using `fast-check`. Run via `npm test --prefix backend`.
- **E2E Testing:** Playwright-based frontend flows. Run via `npx playwright test` in the `frontend/` folder.
- **Quality Audit Skill:** A specialized agentic workflow that performs deep mathematical audits (XIRR anomalies, cost basis leaks) and UI consistency checks.

## 🤖 AI & Agent Support

This project is built for collaboration with AI agents. It includes specialized "Agent Skills" (SOPs and scripts) to automate complex tasks.

- **[skills/](./skills/)**: Self-contained agentic workflows.
    - `quality-audit`: Mathematical and functional integrity checks.
    - `pdd`: Architectural planning and design.
    - `code-assist`: TDD-based implementation guidance.
- **[AGENTS.md](./AGENTS.md)**: A comprehensive guide for AI collaborators on maintenance, math standards, and tax rules.

### Configuring Agent Models
You can control the models used by child agents to balance quality and speed.

- **Check Current Profile:**
  ```bash
  gsd-sdk query config-get model_profile
  ```
- **Set Quality Profile (Recommended):**
  ```bash
  gsd-sdk query config-set model_profile quality
  ```
- **Inherit Session Model:**
  ```bash
  gsd-sdk query config-set model_profile inherit
  ```
- **Advanced Overrides:** 
  Use `/gsd:settings-advanced` to map specific models (e.g., `gemini-3-pro`) to agent tiers (Opus/Sonnet/Haiku).


## 📖 Maintenance

- **Adding Asset Types:** Update `backend/prisma/schema.prisma` and the `AlternativeAssetService`.
- **Updating Tax Rules:** Modify the logic in `TaxService.ts`.
- **Prisma Configuration:** The project uses `backend/prisma.config.ts`. If you add new models, always run `npx prisma generate` inside the `backend/` folder to update the client.

---
Created with ❤️ by Gemini CLI.
