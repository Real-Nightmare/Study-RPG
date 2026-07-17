# Study RPG

A CBSE-aligned study platform with RPG mechanics, Block Tales-inspired battles, and AI-powered learning tools.

## Architecture

```
Frontend (Cloudflare Pages) → Backend (MonkeysCloud NestJS) → Database (Neon PostgreSQL + pgvector)
```

| Layer | Platform | Stack | Purpose |
|-------|----------|-------|---------|
| Frontend | Cloudflare Pages | React 19 + Vite | Static SPA + Pages Functions API proxy |
| Backend | MonkeysCloud | NestJS 10 | REST API, WebSocket, AI/LLM, RPG logic |
| Database | Neon | PostgreSQL + pgvector | Data storage, vector search |

## Folder Structure

```
├── frontend/          # React app → deploy to Cloudflare Pages
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── stores/
│   │   ├── types/
│   │   └── config/
│   ├── public/
│   │   └── _routes.json          # Cloudflare Pages SPA routing
│   ├── functions/
│   │   └── api/[[path]].ts       # Cloudflare Pages Functions proxy
│   ├── package.json
│   ├── vite.config.ts
│   └── .env.example
│
├── backend/           # NestJS app → deploy to MonkeysCloud
│   ├── src/
│   │   ├── modules/              # Feature modules (auth, rpg, chat, etc.)
│   │   ├── common/               # Guards, decorators, filters, gateways
│   │   ├── types/                # TypeScript types
│   │   └── main.ts               # App bootstrap
│   ├── migrations/              # Database migrations
│   ├── scripts/                 # Seed/admin scripts
│   ├── Dockerfile
│   ├── package.json
│   ├── nest-cli.json
│   └── .env.example
│
├── database/          # SQL migrations + seed data
│   ├── migrations/
│   │   ├── 001_initial.sql
│   │   ├── 002_add_pgvector.sql
│   │   ├── 003_add_audit_logs.sql
│   │   ├── 004_add_llm_providers.sql
│   │   ├── 005_rpg_core.sql
│   │   ├── 006_rpg_battle.sql
│   │   ├── 007_rpg_cards.sql
│   │   ├── 008_rpg_battlepass.sql
│   │   ├── 009_rpg_shops.sql
│   │   └── 010_rpg_special.sql
│   └── seed/
│       ├── seed_admin.sql
│       └── seed_game_content.sql
│
├── DEPLOY.md          # Step-by-step deployment guide
└── README.md          # This file
```

## Deployment Steps

### Prerequisites
- GitHub account
- Cloudflare account (free)
- MonkeysCloud account (free, no credit card)
- Neon PostgreSQL account (free)

### Step 1: Database Setup (Neon)

1. Go to [neon.tech](https://neon.tech) and create a free account
2. Create a new project: `study-rpg-db`
3. Create a database: `studyrpg`
4. Copy the connection string (format: `postgresql://user:pass@host/neondb?sslmode=require`)
5. Enable pgvector extension: Run `CREATE EXTENSION IF NOT EXISTS vector;` in Neon SQL editor
6. Run all migrations from `database/migrations/` in order (001 → 010)
7. Run seed scripts from `database/seed/`
8. Save the connection string as `DATABASE_URL`

### Step 2: Backend Deployment (MonkeysCloud)

1. Go to [monkeys.cloud](https://monkeys.cloud) and create account
2. Create new project: `study-rpg-backend`
3. Select stack: **Next.js** (auto-detected)
4. Connect your GitHub repo
5. Set environment variables in MonkeysCloud dashboard:
   ```
   DATABASE_URL=<your-neon-connection-string>
   REDIS_URL=<optional-upstash-redis-url>
   JWT_SECRET=<random-secret-key>
   CORS_ORIGIN=<your-cloudflare-pages-url>
   OPENROUTER_API_KEY=<your-openrouter-key>
   GROQ_API_KEY=<your-groq-key>
   TOGETHER_API_KEY=<your-together-key>
   NAVY_API_KEY=<your-navy-key>
   ADMIN_DEFAULT_PASSWORD=N1GHTMAREISGoD@123
   ```
6. Deploy — MonkeysCloud auto-detects Next.js and builds
7. Save the backend URL (e.g., `https://study-rpg-backend.monkeyscloud.com`)

### Step 3: Frontend Deployment (Cloudflare Pages)

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → Pages
2. Connect your GitHub repo
3. Configure build settings:
   - **Build command**: `npm run build`
   - **Build output**: `dist`
   - **Root directory**: `frontend/`
4. Set environment variables:
   ```
   VITE_API_URL=/api
   VITE_WS_URL=<your-monkeyscloud-backend-url>
   BACKEND_URL=<your-monkeyscloud-backend-url>
   ```
5. Deploy — Cloudflare Pages builds and deploys
6. Save the frontend URL (e.g., `https://study-rpg.pages.dev`)

### Step 4: Post-Deployment

1. **Update CORS**: Go back to MonkeysCloud and update `CORS_ORIGIN` to your Cloudflare Pages URL
2. **Access admin panel**: Login with:
   - Username: `Nightmare`
   - Password: `N1GHTMAREISGoD@123`
3. **Add LLM providers**: Go to Admin → LLM Providers and add your API keys
4. **Test the app**:
   - Create a test account
   - Test login
   - Test RPG features (battle, cards, shop)
   - Test AI tools (chat, problem solver, etc.)

## Local Development

### Frontend
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

### Backend
```bash
cd backend
npm install
npm run dev
# Runs on http://localhost:3000
```

### Database
```bash
# Connect to Neon and run migrations
psql <database/migrations/001_initial.sql>
psql <database/migrations/002_add_pgvector.sql>
# ... etc
```

## Environment Variables

### Frontend (.env)
```
VITE_API_URL=/api
VITE_WS_URL=<backend-url>
```

### Backend (.env.local)
```
DATABASE_URL=<neon-connection-string>
REDIS_URL=<optional>
JWT_SECRET=<random-secret>
CORS_ORIGIN=<cloudflare-pages-url>
OPENROUTER_API_KEY=<key>
GROQ_API_KEY=<key>
TOGETHER_API_KEY=<key>
NAVY_API_KEY=<key>
ADMIN_DEFAULT_PASSWORD=N1GHTMAREISGoD@123
```

## Tech Stack

### Frontend
- React 19 + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Framer Motion
- Socket.io client
- Lucide icons

### Backend
- NestJS 10 (API routes, WebSocket gateways, modules)
- Socket.io (real-time features)
- PostgreSQL + pgvector (Neon)
- Multi-provider LLM (OpenRouter, Groq, Together, NAVY, Custom OpenAI)

### Database
- PostgreSQL 16+
- pgvector extension
- Neon serverless Postgres

## Features

### Main Features
- Study Sets (CRUD)
- Flashcards + Spaced Repetition (SRS)
- Quiz generation + study sessions
- Match game
- Notes (basic CRUD)
- Progress tracking / streaks / XP / levels
- Leaderboard
- Bookmarks
- Badges/achievements

### Tools
- AI Chat (RAG with uploaded docs)
- Deep Research
- Code Sandbox (JavaScript + Python via Pyodide)
- Knowledge Graph
- Learning Paths
- Teach-Back (Feynman technique)
- Exam Clone
- Problem Solver (multi-agent)
- Live Quiz (multiplayer)
- Collaborative Exam

### RPG Layer
- SchoolCoin (SLC) currency
- EXP / XP progression tracks
- Block Tales-inspired turn-based battles
- Card collection and deck building
- Area/World progression
- Battlepass seasons
- Item/Ability/Cosmetic shops
- Revision Centre Programme
- CBT (Competency Based Testing)
- Student-created Programmes

## Admin

Default admin account:
- Username: `Nightmare`
- Name: `Joshua Martin`
- Password: `N1GHTMAREISGoD@123`

Admin capabilities:
- Create accounts
- Change user roles (student/teacher/admin)
- Approve/reject programmes
- Create missions
- Manage CBT votes
- View audit logs
- Manage LLM providers

## License

[LICENSE](LICENSE)
