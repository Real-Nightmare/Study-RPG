# Study RPG - Deployment Guide

## Quick Start

### 1. Database Setup (Neon)

1. Go to [neon.tech](https://neon.tech) → Sign up (free, no credit card)
2. Click **"New Project"** → Name: `study-rpg` → Create
3. Click **"New Branch"** → Name: `main` → Create
4. Click **"Query"** → Run this SQL:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
5. Copy your **connection string** (starts with `postgresql://`)
6. Save it as `DATABASE_URL`

### 2. Upload Database Migrations

1. Go to Neon → Your Project → **Query**
2. Open `database/migrations/001_initial.sql` → Copy all → Paste into Neon Query → Run
3. Repeat for each migration file in order:
   - `001_initial.sql`
   - `002_add_pgvector.sql`
   - `003_add_audit_logs.sql`
   - `004_add_llm_providers.sql`
   - `005_rpg_core.sql`
   - `006_rpg_battle.sql`
   - `007_rpg_cards.sql`
   - `008_rpg_battlepass.sql`
   - `009_rpg_shops.sql`
   - `010_rpg_special.sql`

**Alternative**: Use the seed script:
```bash
psql YOUR_DATABASE_URL < database/seed/seed_all.sql
```

### 3. Deploy Backend (MonkeysCloud)

1. Go to [monkeys.cloud](https://monkeys.cloud) → Sign up (free, no credit card)
2. Click **"New Project"** → Name: `study-rpg-backend`
3. Select **Next.js** as stack
4. Connect your GitHub repo OR upload the `backend/` folder
5. Go to **Settings → Environment Variables** and add:
   ```
   DATABASE_URL=<your-neon-connection-string>
   JWT_SECRET=<random-string-like-abc123xyz>
   CORS_ORIGIN=<your-cloudflare-pages-url>
   OPENROUTER_API_KEY=<your-openrouter-key>
   GROQ_API_KEY=<your-groq-key>
   TOGETHER_API_KEY=<your-together-key>
   NAVY_API_KEY=<your-navy-key>
   ADMIN_DEFAULT_PASSWORD=N1GHTMAREISGoD@123
   ```
6. Click **Deploy**
7. Save your backend URL (e.g., `https://study-rpg-backend.monkeyscloud.com`)

### 4. Deploy Frontend (Cloudflare Pages)

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → Pages
2. Click **"Create a project"** → Connect your GitHub repo
3. Configuration:
   - **Project name**: `study-rpg`
   - **Production branch**: `main`
   - **Build command**: `cd frontend && npm install && npm run build`
   - **Build output directory**: `frontend/dist`
   - **Root directory**: Leave empty (or `/`)
4. Go to **Settings → Environment Variables** and add:
   ```
   VITE_API_URL=/api
   VITE_WS_URL=<your-monkeyscloud-backend-url>
   BACKEND_URL=<your-monkeyscloud-backend-url>
   ```
5. Click **"Save and Deploy"**
6. Save your frontend URL (e.g., `https://study-rpg.pages.dev`)

### 5. Update Backend CORS

1. Go back to MonkeysCloud → `study-rpg-backend` → Settings
2. Update `CORS_ORIGIN` to your Cloudflare Pages URL:
   ```
   CORS_ORIGIN=https://study-rpg.pages.dev
   ```
3. Redeploy backend

### 6. Verify Deployment

1. Visit your Cloudflare Pages URL
2. Open browser console → Should see no CORS errors
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
├── frontend/          # Upload to Cloudflare Pages
│   ├── src/
│   ├── public/
│   ├── functions/
│   ├── package.json
│   ├── vite.config.ts
│   └── .env.example
│
├── backend/           # Upload to MonkeysCloud (Next.js)
│   ├── app/
│   │   ├── api/
│   │   └── layout.tsx
│   ├── lib/
│   ├── package.json
│   ├── next.config.js
│   └── .env.example
│
├── database/          # Run migrations on Neon
│   ├── migrations/
│   │   ├── 001_initial.sql
│   │   ├── 002_add_pgvector.sql
│   │   └── ...
│   └── seed/
│       ├── seed_admin.sql
│       └── seed_game_content.sql
│
└── README.md          # This file
```

## Local Development

### Frontend
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### Backend
```bash
cd backend
npm install
npm run dev
# → http://localhost:3000
```

### Database
```bash
# Connect to Neon and run migrations in order
psql $DATABASE_URL < database/migrations/001_initial.sql
psql $DATABASE_URL < database/migrations/002_add_pgvector.sql
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
JWT_SECRET=<random-secret>
CORS_ORIGIN=<cloudflare-pages-url>
OPENROUTER_API_KEY=<key>
GROQ_API_KEY=<key>
TOGETHER_API_KEY=<key>
NAVY_API_KEY=<key>
ADMIN_DEFAULT_PASSWORD=N1GHTMAREISGoD@123
```

## Troubleshooting

### CORS Errors
- Ensure `CORS_ORIGIN` in backend matches your Cloudflare Pages URL exactly
- Redeploy backend after changing env vars

### Database Connection Errors
- Verify `DATABASE_URL` is correct
- Ensure pgvector extension is enabled: `CREATE EXTENSION IF NOT EXISTS vector;`
- Check Neon console for connection limits

### WebSocket Not Connecting
- Verify `VITE_WS_URL` points to your MonkeysCloud backend URL
- Check backend logs for Socket.io connection errors
- Ensure WebSocket CORS is configured

### Cold Starts
- MonkeysCloud free tier sleeps after 30 min
- First request takes 3-5s to wake up
- Normal behavior for free tier

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + Tailwind CSS |
| Backend | Next.js 14+ API Routes + Socket.io |
| Database | PostgreSQL 16 + pgvector (Neon) |
| AI/LLM | OpenRouter + Groq + Together AI + NAVY AI |
| Hosting | Cloudflare Pages + MonkeysCloud + Neon |

## Admin Account

- **Username**: `Nightmare`
- **Password**: `N1GHTMAREISGoD@123`
- **Role**: Admin (full access)

## License

MIT
