# Portfolio Tracker (MVP)

A deep-analytics portfolio tracking platform for Indian investors. Supports CAMS/Karvy CAS statements, real-time performance tracking, deep X-Ray analytics, and advanced tax optimization.

## 🚀 Quick Start (For Users)

You can run Portfolio Tracker on any machine using Docker. You don't need to download the source code—just follow these three simple steps to start the application using our pre-built images.

### 1. Create a Project Folder
Create a new folder on your computer and navigate into it:
```bash
mkdir portfolio-tracker
cd portfolio-tracker
```

### 2. Create Configuration Files

**Step A:** Create a file named `.env` in this folder to hold your settings. Change the password and IP fields as needed.
```env
# .env
PORTFOLIO_DB_USER=portfolio_admin
PORTFOLIO_DB_PASSWORD=your_secure_password_here
PORTFOLIO_DB_NAME=portfolio_tracker
TZ_GLOBAL=UTC
VOLUME_PREFIX_GLOBAL=.
VITE_API_PORT=3031
# If accessing from another device on your network, replace localhost with your server's IP address (e.g., 192.168.1.100)
IP_GLOBAL=localhost
```

**Step B:** Create a file named `docker-compose.yml` and paste the following configuration:
```yaml
# docker-compose.yml
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

  redis:
    image: redis:7-alpine
    container_name: portfolio_tracker_redis
    restart: always
    environment:
      TZ: ${TZ_GLOBAL}
    volumes:
      - "${VOLUME_PREFIX_GLOBAL}/appdata/portfolio/redis:/data"

  backend:
    image: shaleenks/portfolio-backend:latest
    container_name: portfolio_tracker_backend
    restart: always
    ports:
      - "${VITE_API_PORT}:3001"
    environment:
      DATABASE_URL: "postgresql://${PORTFOLIO_DB_USER}:${PORTFOLIO_DB_PASSWORD}@postgres:5432/${PORTFOLIO_DB_NAME}?schema=public"
      REDIS_HOST: redis
      REDIS_PORT: 6379
      NODE_ENV: production
      PYTHON_PATH: python3
      TZ: ${TZ_GLOBAL}
    depends_on:
      - postgres
      - redis

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
```

### 3. Start the Application
Run this command to download the images and start the tracker:
```bash
docker-compose up -d
```

That's it! You can now access your application:
- **Frontend UI:** `http://localhost:8082` (or your server's IP:8082)
- **Backend API:** `http://localhost:3031` (or your server's IP:3031)

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
1. **Install System Dependencies (Linux only):**
   ```bash
   sudo apt-get install -y python3-pip python3-venv python3-dev build-essential libffi-dev libssl-dev
   ```
2. **Setup Node & Python:**
   ```bash
   cd backend
   npm install
   # Create venv and install parsing libraries
   python3 -m venv venv
   ./venv/bin/pip install casparser pycryptodome
   # Sync database
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
