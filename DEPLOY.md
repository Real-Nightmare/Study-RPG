# Study RPG - Deployment Guide

## Architecture

```
Frontend (Cloudflare Pages) → Backend (Render NestJS) → Database (Render PostgreSQL)
```

## Step 1: Deploy Backend (Render)

### Option A: Using Render Blueprint (automatic)
1. Go to [render.com](https://render.com) → **New +** → **Blueprint**
2. Connect your GitHub repo: `Real-Nightmare/Study-RPG`
3. Select `render.yaml` from the root
4. Render auto-creates: backend service + PostgreSQL + Redis
5. Add environment variables in Render dashboard:
   - `OPENROUTER_API_KEY` — your OpenRouter key
   - `GROQ_API_KEY` — your Groq key
   - `TOGETHER_API_KEY` — your Together AI key
   - `NAVY_API_KEY` — your NAVY AI key
   - Update `CORS_ORIGIN` to your Cloudflare Pages URL after frontend deploys
6. Click **Create** → wait for build → save backend URL

### Option B: Manual creation
1. Go to [render.com](https://render.com) → **New +** → **Web Service**
2. Connect GitHub repo: `Real-Nightmare/Study-RPG`
3. Settings:
   - **Name**: `study-rpg-backend`
   - **Root Directory**: `backend`
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start:prod`
   - **Plan**: Free
4. Add environment variables:
   - `DATABASE_URL` — from Render PostgreSQL
   - `JWT_SECRET` — random string
   - `CORS_ORIGIN` — your Cloudflare Pages URL
   - `OPENROUTER_API_KEY` — your key
   - `GROQ_API_KEY` — your key
   - `TOGETHER_API_KEY` — your key
   - `NAVY_API_KEY` — your key
   - `ADMIN_DEFAULT_PASSWORD` — `N1GHTMAREISGoD@123`
5. Create **PostgreSQL** database (free tier):
   - Name: `study-rpg-db`
   - Database: `studyrpg`
   - Copy connection string → paste into backend `DATABASE_URL`
6. Create **Redis** instance (free tier, optional):
   - Name: `study-rpg-redis`
   - Copy connection string → paste into backend `REDIS_URL`
7. Deploy

## Step 2: Deploy Frontend (Cloudflare Pages)

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → Pages
2. Click **Create a project** → Connect GitHub repo: `Real-Nightmare/Study-RPG`
3. Configuration:
   - **Project name**: `study-rpg`
   - **Production branch**: `main`
   - **Build command**: `cd frontend && npm install && npm run build`
   - **Build output directory**: `frontend/dist`
   - **Root directory**: `/`
4. Environment variables:
   - `VITE_API_URL` = `/api`
   - `VITE_WS_URL` = `https://study-rpg-backend.onrender.com` (your Render backend URL)
   - `BACKEND_URL` = `https://study-rpg-backend.onrender.com`
5. Click **Save and Deploy**
6. Save your frontend URL (e.g., `https://study-rpg.pages.dev`)

## Step 3: Update Backend CORS

1. Go back to Render → `study-rpg-backend` → Environment
2. Update `CORS_ORIGIN` to your Cloudflare Pages URL:
   ```
   CORS_ORIGIN=https://study-rpg.pages.dev
   ```
3. Save → Render auto-redeploys

## Step 4: Initialize Database

1. In Render, go to your PostgreSQL instance → **Connect**
2. Open **Query** tab
3. Run migrations in order:
   ```sql
   -- Copy and paste each file from database/migrations/ in order:
   -- 001_initial.sql
   -- 002_add_pgvector.sql
   -- 003_add_audit_logs.sql
   -- 004_add_llm_providers.sql
   -- 005_rpg_core.sql
   -- 006_rpg_battle.sql
   -- 007_rpg_cards.sql
   -- 008_rpg_battlepass.sql
   -- 009_rpg_shops.sql
   -- 010_rpg_special.sql
   -- 011_teach_back.sql
   ```
4. Run seed scripts:
   ```sql
   -- Run database/seed/seed_admin.sql
   -- Run database/seed/seed_game_content.sql
   ```
5. Or use the backend script:
   ```bash
   # From your local machine, after setting DATABASE_URL:
   node backend/scripts/migrate.js
   node backend/scripts/seed-admin.js
   ```

## Step 5: Verify Deployment

1. Visit your Cloudflare Pages URL
2. Open browser console — should see no CORS errors
3. Try logging in with:
   - **Username**: `Nightmare`
   - **Password**: `N1GHTMAREISGoD@123`
4. Test RPG features:
   - Battle Arena
   - Cards
   - Areas
   - Shop
   - Revision Centre

## Folder Structure

```
study-rpg/
├── frontend/          # → Deploy to Cloudflare Pages
│   ├── src/
│   ├── public/
│   ├── functions/
│   │   └── api/[[path]].ts   # Pages Functions proxy
│   ├── package.json
│   └── vite.config.ts
│
├── backend/           # → Deploy to Render (rootDir: backend)
│   ├── src/
│   │   ├── modules/
│   │   ├── common/
│   │   └── main.ts
│   ├── migrations/
│   ├── scripts/
│   ├── package.json
│   └── Dockerfile
│
├── database/          # Run on Render PostgreSQL
│   ├── migrations/
│   │   ├── 001_initial.sql
│   │   ├── 002_add_pgvector.sql
│   │   └── ...
│   └── seed/
│       ├── seed_admin.sql
│       └── seed_game_content.sql
│
├── render.yaml        # Render Blueprint
└── cloudflare-pages.json  # Cloudflare Pages config
```

## Environment Variables

### Frontend (Cloudflare Pages)
```
VITE_API_URL=/api
VITE_WS_URL=https://your-backend.onrender.com
BACKEND_URL=https://your-backend.onrender.com
```

### Backend (Render)
```
NODE_ENV=production
DATABASE_URL=<render-postgres-connection-string>
REDIS_URL=<render-redis-connection-string>
JWT_SECRET=<random-secret>
CORS_ORIGIN=https://your-site.pages.dev
OPENROUTER_API_KEY=<key>
GROQ_API_KEY=<key>
TOGETHER_API_KEY=<key>
NAVY_API_KEY=<key>
ADMIN_DEFAULT_PASSWORD=N1GHTMAREISGoD@123
```

## Tech Stack

| Layer | Technology | Host |
|-------|-----------|------|
| Frontend | React 19 + Vite + Tailwind | Cloudflare Pages |
| Backend | NestJS 10 + Socket.io | Render |
| Database | PostgreSQL + pgvector | Render |
| Cache | Redis | Render |
| AI/LLM | OpenRouter + Groq + Together + NAVY | External APIs |

## Admin Account

- **Username**: `Nightmare`
- **Password**: `N1GHTMAREISGoD@123`
- **Role**: Admin (full access)

## Troubleshooting

### CORS Errors
- Ensure `CORS_ORIGIN` in backend matches Cloudflare Pages URL exactly
- Update in Render dashboard and redeploy

### Database Connection
- Verify `DATABASE_URL` is set in Render
- Run migrations on Render PostgreSQL
- Check Render logs for connection errors

### WebSocket Not Connecting
- Verify `VITE_WS_URL` points to Render backend URL
- Check backend logs for Socket.io errors
- Ensure WebSocket CORS is configured

### Cold Starts
- Render free tier sleeps after 15 min
- First request takes ~10s to wake up
- Normal behavior for free tier

## License

MIT
