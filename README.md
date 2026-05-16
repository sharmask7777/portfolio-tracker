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
- **Backend:** Node.js, Express, TypeScript, Prisma (PostgreSQL).
- **Caching:** Redis.
- **Parsing:** Python 3 + `casparser` library.

## 🏁 Getting Started

### Prerequisites
- Node.js (v18+)
- Python 3.10+
- Docker & Docker Compose

### 1. Setup Infrastructure
```bash
docker-compose up -d
```

### 2. Backend Setup
```bash
cd backend
npm install

# Setup environment variables
# Copy .env.example to .env and update with your local credentials
cp .env.example .env

# Setup Python virtual environment
python3 -m venv venv
./venv/bin/pip install casparser rapidfuzz

# Run migrations
npx prisma db push

# Start dev server
npm run dev
```

> **⚠️ Security Note:** Never commit your `.env` file to version control. It is already included in `.gitignore`. Use `.env.example` as a template for new environments.

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## 🧪 Testing & Robustness

We use a combination of **Unit Testing** and **Property-Based Testing (PBT)** to ensure mathematical and logical integrity.

- **Run all tests:** `npm test --prefix backend`
- **Run robustness stress-tests:** `npm test --prefix backend src/services/robustness.pbt.spec.ts`

## 📖 Maintenance

- **Adding Asset Types:** Update `prisma/schema.prisma` and the `AlternativeAssetService`.
- **Updating Tax Rules:** Modify the logic in `TaxService.ts`.
- **API Performance:** Use the established indexes in `schema.prisma` for analytical query optimization.

---
Created with ❤️ by Gemini CLI.
