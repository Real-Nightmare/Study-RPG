# Study RPG - Deployment Guide

Deploy the frontend and backend separately. No credit card required for any service.

| Layer | Service | Branch | Purpose |
|-------|---------|--------|---------|
| Frontend | Cloudflare Pages | `main` | Static React SPA + serverless Functions proxy |
| Backend | OpsCtrl | `opsctrl-backend-only` | NestJS API, WebSocket, AI/LLM, RPG logic |
| Database | OpsCtrl (auto-provisioned) | `opsctrl-backend-only` | PostgreSQL + pgvector |
| Cache | OpsCtrl (auto-provisioned) | `opsctrl-backend-only` | Redis |
| Storage | Dark Storage / Synclyz / Backblaze B2 / Blomp | `opsctrl-backend-only` | File uploads (optional) |

## Architecture

```
Browser
  ↓
Cloudflare Pages (frontend + serverless Functions proxy)
  ↓ /api/* requests
OpsCtrl Backend (NestJS)
  ↓
Database + Redis (OpsCtrl)
```

The frontend never talks to the backend directly. All API requests go through
Cloudflare Pages Functions (`/api/*`), which forwards them to OpsCtrl.

## Step 1: Backend (OpsCtrl)

1. Sign up at https://opsctrl.dev — **no credit card required**.
2. Create a new project and connect the **`opsctrl-backend-only`** branch.
3. OpsCtrl auto-detects NestJS + TypeORM + BullMQ + Redis.
4. It auto-provisions PostgreSQL (with pgvector) and Redis.
5. Set these environment variables in the OpsCtrl dashboard:

   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `API_PREFIX` | `""` |
   | `CORS_ORIGIN` | `https://<your-frontend>.pages.dev` |
   | `JWT_SECRET` | Generate a strong random string |
   | `OPENROUTER_API_KEY` | Your OpenRouter key |
   | `GROQ_API_KEY` | Your Groq key |
   | `TOGETHER_API_KEY` | Your Together AI key |
   | `NAVY_API_KEY` | Your NAVY AI key |
   | `OLLAMA_API_KEY` | Your Ollama Cloud key (optional) |
   | `ADMIN_DEFAULT_PASSWORD` | Set a strong unique password |

6. Enable `pgvector` in the database:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
7. Run migrations:
   ```bash
   DATABASE_URL="<your-opsctrl-database-url>" npm run migrate
   ```
8. Deploy.

## Step 2: Frontend (Cloudflare Pages)

1. On the **`main`** branch, push your code to GitHub.
2. Sign up at https://pages.cloudflare.com — **no credit card required**.
3. Create a new Pages project and connect the **`main`** branch.
4. Build settings:
   - **Framework**: Vite
   - **Build command**: `cd frontend && npm install && npm run build`
   - **Publish directory**: `frontend/dist`
5. Create `functions/api/[[path]].ts` to proxy API requests to OpsCtrl.
6. Set Cloudflare Pages environment variables:
   | Key | Value |
   |-----|-------|
   | `BACKEND_URL` | `https://<your-opsctrl-backend>.opsctrl.dev` |
   | `VITE_API_URL` | `/api` |
   | `VITE_WS_URL` | `wss://<your-opsctrl-backend>.opsctrl.dev` |
7. Deploy.

## Step 3: Verify Deployment

1. Visit your Cloudflare Pages frontend URL.
2. Check the backend health endpoint:
   `https://<your-opsctrl-backend>.opsctrl.dev/health`
3. Log in as admin (`Nightmare` / your `ADMIN_DEFAULT_PASSWORD`).
4. Confirm no CORS errors in the browser console.

## Troubleshooting

### CORS Errors
- Ensure `CORS_ORIGIN` in OpsCtrl matches your Cloudflare Pages frontend URL exactly.

### 502/504 Errors
- Verify `BACKEND_URL` in Cloudflare Pages matches your OpsCtrl backend URL.
- Check that the backend is running and healthy.

### WebSocket Not Connecting
- Verify `VITE_WS_URL` points directly at your OpsCtrl backend (not through the proxy).
- Confirm WebSocket CORS is configured in the backend.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + Tailwind CSS + Cloudflare Pages Functions |
| Backend | NestJS 10 + Socket.io (OpsCtrl) |
| Database | PostgreSQL 16 + pgvector (OpsCtrl) |
| Cache | Redis (OpsCtrl) |
| Storage | Dark Storage / Synclyz / Backblaze B2 / Blomp / local disk |
| AI/LLM | OpenRouter + Ollama Cloud + Groq + Together AI + NAVY AI |

## Admin Account

- **Username**: `Nightmare`
- **Password**: value of `ADMIN_DEFAULT_PASSWORD` (set in OpsCtrl)

## License

MIT
