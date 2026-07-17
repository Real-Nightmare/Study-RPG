# Study RPG — Migration Plan

## Goal
Rebrand Studyield as **Study RPG**, strip non-essential features, and deploy the frontend on Cloudflare Pages with the backend on MonkeysCloud (free, no CC).

---

## Architecture

| Layer | Technology | Primary Host | Fallback Host |
|-------|-----------|-------------|--------------|
| Frontend | React 19 + Vite (static build) | Cloudflare Pages | — |
| Backend API | NestJS 10 (existing codebase) | MonkeysCloud | Render |
| Database | PostgreSQL | MonkeysCloud (included) | Render free Postgres / Neon |
| Cache | Redis | MonkeysCloud (included) | Upstash Redis (free tier) |
| Real-time | Socket.io | MonkeysCloud | Render (paid only — see note) |
| Auth | JWT + Google OAuth | MonkeysCloud | — |
| AI/LLM | OpenRouter API | Called from NestJS backend | — |

---

## Feature Decisions

### Keep (Main Features)
- Study Sets (CRUD)
- Flashcards + Spaced Repetition (SRS)
- Quiz generation + study sessions
- Match game
- Notes (basic CRUD)
- Progress tracking / streaks / XP / levels
- Leaderboard
- Bookmarks
- Badges/achievements

### Keep (Tools)
- AI Chat (RAG with uploaded docs)
- Deep Research
- Code Sandbox
- Knowledge Graph
- Learning Paths
- Teach-Back
- Exam Clone
- Multi-Agent Problem Solver
- Live Quiz (multiplayer WebSocket)
- Collaborative Exam

### Keep (Infrastructure)
- JWT + Google OAuth authentication
- Email notifications (simplified — remove FCM push)
- Sitemap, cookies, privacy, terms, data deletion pages

### Remove
- Stripe payments / subscriptions
- Blog module
- Apple Sign-In
- All non-English i18n (keep English only)
- ClickHouse analytics (replace with simpler logging or remove)
- Qdrant vector DB — simplify AI features to use OpenRouter directly without RAG/embeddings

---

## Implementation Steps

### 1. Frontend Rebranding & Cleanup
- Rename app from "Studyield" to "Study RPG" across all UI strings, titles, meta tags
- Remove non-English translation files (keep `en` only)
- Remove Stripe/payment components, routes, and pages
- Remove blog routes, components, and CMS integration
- Remove Apple Sign-In button/flow
- Remove FCM push notification setup
- Update `index.html` title, favicon, meta description
- Remove unused icon imports (Lucide icons for payment/blog features)

### 2. Frontend Cloudflare Pages Config
- Create `public/_routes.json` for SPA fallback:
  ```json
  {
    "version": 1,
    "include": ["/*"],
    "exclude": ["/api/*", "/assets/*"]
  }
  ```
- Update `vite.config.ts` build output if needed (ensure `dist/` is correct)
- Add Cloudflare Pages build settings documentation:
  - Build command: `npm run build`
  - Build output: `dist`
  - Root directory: `frontend/`
- Add `.env` variable documentation for Vite `VITE_API_URL` pointing to MonkeysCloud backend URL

### 3. Backend AI Feature Simplification (remove Qdrant)
- Remove Qdrant module and all vector embedding logic
- Simplify AI Chat: direct OpenRouter call, no document retrieval
- Simplify Deep Research: LLM generates report from user-provided text
- Simplify Exam Clone: text input → LLM generates practice questions
- Simplify Problem Solver: single LLM call with structured output
- Simplify Knowledge Graph: LLM extracts entities → D3.js renders on frontend
- Simplify Learning Paths: template-based sequencing (remove AI planning)
- Simplify Teach-Back: text-only evaluation via LLM
- Code Sandbox: restrict to JavaScript execution via Web Workers in browser
- Keep Live Quiz and Collaborative Exam with Socket.io (MonkeysCloud supports WebSockets)

### 4. Database Adjustments
- Keep existing PostgreSQL schema (MonkeysCloud provides Postgres)
- Remove Qdrant-related tables/migrations
- Remove ClickHouse-related setup
- Simplify analytics tables if needed
- Update TypeORM/Prisma connection config for MonkeysCloud env vars
- **Fallback DB**: If MonkeysCloud DB fails, switch connection to Render free Postgres (90-day expiry, renew) or Neon (generous free tier). Schema stays the same — only `DATABASE_URL` changes.
- **Fallback Cache**: If MonkeysCloud Redis fails, switch to Upstash Redis free tier — only `REDIS_URL` changes.

### 5. Backend Deployment to MonkeysCloud
- Create `Dockerfile` for NestJS backend (MonkeysCloud supports Docker)
- Or use MonkeysCloud's Node.js native buildpack (auto-detect)
- Configure environment variables:
  - `DATABASE_URL` — MonkeysCloud PostgreSQL connection string
  - `REDIS_URL` — MonkeysCloud Redis connection string
  - `JWT_SECRET` — generate new secret
  - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — OAuth credentials
  - `OPENROUTER_API_KEY` — LLM API key
  - `CORS_ORIGIN` — Cloudflare Pages domain
- Update CORS to allow Cloudflare Pages origin
- Enable WebSocket support in NestJS gateway config
- **Fallback**: If MonkeysCloud has issues, deploy to Render (free tier, sleeps after 15 min). Same Dockerfile, just change platform. Database stays on MonkeysCloud or switches to Render free Postgres.

### 6. Frontend API Config
- Update API base URL to MonkeysCloud backend URL
- Ensure all `fetch`/React Query calls use the new base URL
- Test WebSocket connection to MonkeysCloud backend

### 7. Testing & Validation
- Build frontend: `npm run build` in `frontend/`
- Deploy frontend to Cloudflare Pages (connect Git repo)
- Deploy backend to MonkeysCloud
- Run database migrations on MonkeysCloud Postgres
- Test auth flow (register/login/Google OAuth)
- Test each Main Feature (Flashcards, Quiz, Match, Notes, etc.)
- Test each Tool (simplified versions)
- Test Live Quiz multiplayer
- Test CORS between frontend and backend
- Verify no broken routes, missing assets, or console errors

---

## Open Questions

1. **Google OAuth**: Need to create Google Cloud project and configure OAuth consent screen — do you have existing credentials?
2. **OpenRouter API key**: Need a key for AI features — have one already?
3. **Custom domain**: Will you use a custom domain for Cloudflare Pages, or the default `*.pages.dev`?
4. **Data migration**: Any existing Studyield data to preserve, or starting fresh?
5. **Database fallback strategy**: Should we pre-configure connection strings for Render/Neon as hot-failover, or only switch manually if MonkeysCloud fails?

---

## Risks

- **MonkeysCloud is new**: Platform may have bugs or change terms. Mitigation: pre-configured fallback to Render or Neon. Database and cache have separate fallbacks too.
- **Cold starts**: MonkeysCloud free tier sleeps after 30 min idle. First request after sleep takes 3-5s. Acceptable for class demo.
- **AI simplification**: Removing RAG/vector search reduces AI quality. Acceptable tradeoff for free hosting.
- **Code Sandbox JS-only**: Restricting to browser Web Workers means no Python/NumPy. Students lose Python execution but gain zero server cost.
- **Render Postgres 90-day expiry**: If we fall back to Render, the free Postgres DB expires every 90 days and must be renewed. Mitigation: use Neon as primary fallback (no expiry), or set calendar reminders to renew.
