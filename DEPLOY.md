# Study RPG - Deployment Guide

This project deploys to [Render](https://render.com) using the infrastructure-as-code
file `render.yaml` at the repository root. It provisions everything needed:
a PostgreSQL database (with the `pgvector` extension), a Redis instance, the NestJS
backend web service, and the Vite static frontend.

> Older notes in this repo referenced Neon / Cloudflare Pages / MonkeysCloud. Those
> are no longer used — `render.yaml` is the single source of truth for deployment.

## Quick Start (Render Blueprint)

1. In Render, click **New** → **Blueprint** and connect this GitHub repository.
2. Render reads `render.yaml` and creates four services:
   - `study-rpg-db` — PostgreSQL (database name `studyrpg`), free plan
   - `study-rpg-redis` — Redis, free plan (maxmemory policy `allkeys-lru`)
   - `study-rpg-backend` — NestJS web service (`rootDir: backend`)
   - `study-rpg-frontend` — static site served from `frontend/dist`
3. Before the first deploy, open each service's **Environment** tab and set the
   `sync: false` secrets (Render does NOT store these for you):
   - `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `TOGETHER_API_KEY`, `NAVY_API_KEY`
   - `ADMIN_DEFAULT_PASSWORD` — **set a strong, unique password**. Never reuse the
     example value that previously appeared in this file.
4. Deploy. The backend `startCommand` is `npm run start:prod`, and `npm run migrate`
   runs automatically on first boot (see below).

## Object Storage (Blomp)

This project uses [Blomp](https://www.blomp.com) for file storage by default.
Blomp is S3-compatible and offers up to 400GB free storage.

### Setup Steps

1. Create a free account at [blomp.com](https://www.blomp.com)
2. Go to **Integrations** → **AWS S3 Bucket** to get your S3-compatible credentials:
   - **Account ID**: Your Blomp account email or account ID
   - **Access Key ID**: Generate from Blomp dashboard
   - **Secret Access Key**: Generate from Blomp dashboard
   - **Bucket Name**: Your Blomp bucket/container name
   - **Public URL**: Your Blomp public URL (e.g., `https://your-account.blomp.com`)
3. In Render, go to `study-rpg-backend` → **Environment**
4. Add these environment variables:
   ```
   BLOMP_ACCOUNT_ID=<your-blomp-account-id>
   BLOMP_ACCESS_KEY_ID=<your-blomp-access-key>
   BLOMP_SECRET_ACCESS_KEY=<your-blomp-secret-key>
   BLOMP_BUCKET_NAME=<your-blomp-bucket-name>
   BLOMP_PUBLIC_URL=<your-blomp-public-url>
   BLOMP_AUTH_URL=https://authenticate.blomp.com
   ```
5. Redeploy the backend

### Fallback Behavior

If Blomp credentials are not configured, the app automatically falls back to
**local disk storage** (`uploads/`). Files are served at `/uploads/:key`.
This is useful for development or if you don't need external storage.

### Alternative Storage

You can also use any S3-compatible storage:
- Cloudflare R2: use `R2_*` env vars
- AWS S3: use `S3_*` env vars
- MinIO, DigitalOcean Spaces, etc.: use `S3_*` env vars with your endpoint

## Database Migrations

Migrations live in `database/migrations/` and are applied in filename order by
`scripts/migrate.js` (the `npm run migrate` script). The script:

- Creates a `migrations` bookkeeping table and skips any file already recorded.
- Reads migrations from `../database/migrations` (relative to the backend dir),
  falling back to `migrations` for backward compatibility.
- Wraps each file in a transaction; a failed migration is rolled back.
- Seeds the default admin account on first run (idempotent — skips if it exists).

Order: `001_initial` → `002_add_pgvector` → `003_add_audit_logs` →
`004_add_llm_providers` → `005_rpg_core` → `006_rpg_battle` → `007_rpg_cards` →
`008_rpg_battlepass` → `009_rpg_shops` → `010_rpg_special` → `011_teach_back` →
`012_legacy_feature_tables` → `013_rpg_triggers`.

To run migrations manually (local or CI):

```bash
cd backend
DATABASE_URL=<postgres-connection-string> npm run migrate
```

## Seed Data

- `database/seed/seed_game_content.sql` — worlds, areas, monsters, cards, shops,
  cosmetics, battlepass season/tiers, and event missions. All inserts use
  `ON CONFLICT DO NOTHING`, so the script is safe to run multiple times.
  Apply with: `psql "$DATABASE_URL" -f database/seed/seed_game_content.sql`
- `database/seed/seed_admin.sql` — reference only. The real admin account is created
  with a bcrypt-hashed password by `scripts/seed-admin.js`, which runs
  automatically during `npm run migrate`. (The SQL file is also idempotent.)
- Admin credentials:
  - **Username**: `Nightmare`
  - **Password**: the value you set for `ADMIN_DEFAULT_PASSWORD`

## Environment Variables

### Backend (`study-rpg-backend`)

| Key | Source | Notes |
|-----|--------|-------|
| `NODE_ENV` | `production` | |
| `API_PREFIX` | `""` | |
| `DATABASE_URL` | `fromDatabase: study-rpg-db` | injected by Render; do not hardcode |
| `REDIS_URL` | `fromService: study-rpg-redis` | injected by Render; do not hardcode |
| `JWT_SECRET` | auto-generated | |
| `CORS_ORIGIN` | frontend URL | e.g. `https://study-rpg-frontend.onrender.com` |
| `OPENROUTER_API_KEY` | `sync: false` | set in dashboard |
| `GROQ_API_KEY` | `sync: false` | set in dashboard |
| `TOGETHER_API_KEY` | `sync: false` | set in dashboard |
| `NAVY_API_KEY` | `sync: false` | set in dashboard |
| `BLOMP_ACCOUNT_ID` | `sync: false` | Blomp storage account ID |
| `BLOMP_ACCESS_KEY_ID` | `sync: false` | Blomp S3 access key |
| `BLOMP_SECRET_ACCESS_KEY` | `sync: false` | Blomp S3 secret key |
| `BLOMP_BUCKET_NAME` | `sync: false` | Blomp bucket/container name |
| `BLOMP_PUBLIC_URL` | `sync: false` | Blomp public URL for file access |
| `ADMIN_DEFAULT_PASSWORD` | `sync: false` | set a strong unique value |

> `DATABASE_URL` and `REDIS_URL` are provided by Render's service linking — never
> commit real credentials. There are no hardcoded credentials in `render.yaml`.

### Frontend (`study-rpg-frontend`)

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://study-rpg-backend.onrender.com` |
| `VITE_WS_URL` | `https://study-rpg-backend.onrender.com` |
| `BACKEND_URL` | `https://study-rpg-backend.onrender.com` |

## Verify Deployment

1. Visit your frontend URL (e.g. `https://study-rpg-frontend.onrender.com`).
2. Check the backend health endpoint: `https://study-rpg-backend.onrender.com/health`
   — the `healthCheckPath` in `render.yaml` is `/health`.
3. Log in as the admin user (`Nightmare` / your `ADMIN_DEFAULT_PASSWORD`).
4. Exercise RPG features (Battle Arena, Cards, Areas, Shop, Revision Centre).
5. In the browser console, confirm there are no CORS errors.

## Local Development

### Frontend
```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

### Backend
```bash
cd backend
npm install
npm run start:dev   # http://localhost:3000
```

### Database
```bash
# Apply all migrations (requires a running PostgreSQL with pgvector)
DATABASE_URL=<postgres-connection-string> npm run migrate

# Seed game content
psql "$DATABASE_URL" -f database/seed/seed_game_content.sql
```

A full local stack (Postgres, Redis) is also available via Docker Compose:
`docker compose --env-file .env.docker up`.

## Troubleshooting

### CORS Errors
- Ensure `CORS_ORIGIN` in the backend matches your frontend URL exactly, then redeploy.

### Database Connection Errors
- Verify `DATABASE_URL` is injected from `study-rpg-db`.
- Ensure the `pgvector` extension is available (the `002_add_pgvector` migration
  runs `CREATE EXTENSION IF NOT EXISTS vector;`).
- Check the migrations bookkeeping table — a previously failed run may have left a
  file partially applied; re-running `npm run migrate` resumes from the last success.

### WebSocket Not Connecting
- Verify `VITE_WS_URL` points at the backend URL.
- Confirm WebSocket CORS is configured in the backend.

### Cold Starts
- Render free tier services spin down after inactivity; the first request wakes them
  up and may take a few seconds.

### Storage Issues
- If Blomp is configured, verify `BLOMP_*` env vars are set correctly.
- If Blomp is not configured, files are stored locally in `uploads/`.
- Check backend logs for storage initialization messages.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + Tailwind CSS |
| Backend | NestJS 10 + Socket.io |
| Database | PostgreSQL 16 + pgvector (Render) |
| Cache | Redis (Render) |
| Storage | Blomp (S3-compatible, free tier) or local disk fallback |
| AI/LLM | OpenRouter + Groq + Together AI + NAVY AI |
| Hosting | Render (Blueprint / `render.yaml`) |

## Admin Account

- **Username**: `Nightmare`
- **Name**: `Joshua Martin`
- **Password**: value of `ADMIN_DEFAULT_PASSWORD` (set as a Render secret)
- **Role**: Admin (full access)

## License

MIT
