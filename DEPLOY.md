# Study RPG - Deployment Guide

Deploy the backend and frontend separately. No credit card required for any service.

| Layer | Service | Purpose |
|-------|---------|---------|
| Backend | OpsCtrl | NestJS API, WebSocket, AI/LLM, RPG logic |
| Database | OpsCtrl (auto-provisioned) | PostgreSQL + pgvector |
| Cache | OpsCtrl (auto-provisioned) | Redis |
| Frontend | Cloudflare Pages | Static React SPA + serverless API proxy |
| Storage | Dark Storage / Synclyz / Backblaze B2 / Blomp | File uploads (optional) |

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
   cd backend
   DATABASE_URL="<your-opsctrl-database-url>" npm run migrate
   ```
8. Deploy.

## Step 2: Frontend (Cloudflare Pages)

1. On the **`main`** branch, create a Cloudflare Pages project at https://pages.cloudflare.com.
2. Connect your GitHub repo and select the **`main`** branch.
3. Build settings:
   - **Framework**: Vite
   - **Build command**: `cd frontend && npm install && npm run build`
   - **Publish directory**: `frontend/dist`
4. Add a Cloudflare Pages Function proxy by creating `frontend/functions/api/[[path]].ts`:
   ```ts
   export async function onRequest(context: {
     request: Request;
     env: { BACKEND_URL: string };
     next: (input?: Request | string) => Promise<Response>;
   }) {
     const backendUrl = context.env.BACKEND_URL || 'https://your-backend.opsctrl.dev';
     const url = new URL(context.request.url);
     
     const response = await fetch(`${backendUrl}${url.pathname}${url.search}`, {
       method: context.request.method,
       headers: {
         ...Object.fromEntries(context.request.headers.entries()),
         'X-Forwarded-Host': url.host,
         'X-Forwarded-Proto': url.protocol.replace(':', ''),
       },
       body: context.request.method !== 'GET' && context.request.method !== 'HEAD' 
         ? await context.request.text() 
         : undefined,
     });

     return new Response(response.body, {
       status: response.status,
       statusText: response.statusText,
       headers: Object.fromEntries(response.headers.entries()),
     });
   }
   ```
5. Set Cloudflare Pages environment variables:
   | Key | Value |
   |-----|-------|
   | `BACKEND_URL` | `https://<your-opsctrl-backend>.opsctrl.dev` |
   | `VITE_API_URL` | `/api` |
   | `VITE_WS_URL` | `wss://<your-opsctrl-backend>.opsctrl.dev` |
6. Deploy.

## Step 3: Frontend API Configuration

Update `frontend/src/config/api.ts` to use `/api` as the base URL:

```ts
export const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
};
```

Update `frontend/.env.example`:
```
VITE_API_URL=/api
VITE_WS_URL=wss://your-backend.opsctrl.dev
```

## Step 4: Verify Deployment

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
