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
| Auth | JWT (username + password) | MonkeysCloud | — |
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
- JWT authentication (password-only, no email/Google/Apple)
- Sitemap, cookies, privacy, terms, data deletion pages

### Remove
- Google OAuth
- Apple Sign-In
- Email-based registration / verification
- Password reset via email
- Email notifications (FCM push already removed)
- Stripe payments / subscriptions
- Blog module
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
- Remove Google OAuth and Apple Sign-In buttons/flows
- Remove FCM push notification setup
- Remove email notification UI
- Update `index.html` title, favicon, meta description
- Remove unused icon imports (Lucide icons for payment/blog features)

### 1.5. Auth System Redesign
- Replace email-based registration with username-only registration: `name`, `username`, `password`
- Remove email verification flow entirely
- Remove password reset via email (keep simple or remove)
- Seed database with pre-built admin account:
  - username: `Nightmare`
  - name: `Joshua Martin`
  - password: generate a default or set via env var
  - role: `admin`
- Add role system: `student`, `teacher`, `admin`
- Admin capabilities:
  - Promote/demote users to admin
  - Create accounts on behalf of other users
  - Approve pending registrations (if approval workflow is desired)
  - Assign teacher permissions to accounts
- Teacher capabilities (define scope — see open questions below)
- Update login/register UI to match new fields
- Remove all email-related auth infrastructure (SMTP, email templates, etc.)

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
  - `OPENROUTER_API_KEY` — LLM API key
  - `CORS_ORIGIN` — Cloudflare Pages domain
  - `ADMIN_DEFAULT_PASSWORD` — password for pre-seeded Nightmare account
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
- Test auth flow (register/login with username+password, admin features)
- Test each Main Feature (Flashcards, Quiz, Match, Notes, etc.)
- Test each Tool (simplified versions)
- Test Live Quiz multiplayer
- Test CORS between frontend and backend
- Verify no broken routes, missing assets, or console errors

---

## RPG Layer Design (Block Tales-inspired, CBSE-aligned)

### Currency: SchoolCoin (SLC)
- Deflationary currency — earned only through studying, not given freely beyond the 500 SLC joining bonus
- Starting balance: 500 SLC on account creation
- No other free SLC sources

### Earning SLC

| Source | How it works | Reward assessment | Reward destination |
|--------|-------------|-------------------|-------------------|
| **Joining bonus** | One-time on account creation | Fixed 500 SLC | Wallet |
| **Missions** | Teacher-given tasks (homework, test papers, assignments) | AI-assessed (low rewards) | Wallet |
| **Revision Centre Programme** | Student applies, studies a topic, marks it revised, takes quiz | AI-assessed (medium rewards). Passing threshold: 30%+. Depth over length — time spent does not matter, only understanding | **Revision Centre Funds** (public ledger) until student withdraws |
| **Revision Centre penalty** | Score below 30% on revision quiz | Slash existing fund by 15% (no penalty if fund is empty) | — |
| **Revision Centre streak** | Consecutive passing revision quizzes | Tracks streak (does not affect rewards) | — |
| **CBT Programme** | Weekly optional board-exam-style test (30 marks, CBSE-aligned) | AI-assessed. Subject chosen by weekly community vote (or skip to rest) | Wallet |
| **Programmes** | Student-created study programmes solving real study problems | **No reward** for creators. Requires approval by AI + admin/teacher before going live | — |

### Spending SLC (TBD — see open questions)
- Deflationary sinks needed to make SLC meaningful
- Cosmetic/identity items: avatar skins, titles, profile themes
- Functional buffs: XP multipliers, streak shields, hint tokens
- Access passes: unlock premium programmes, exclusive study zones
- Programme creation: cost SLC to submit a programme for approval

### Block Tales-Inspired Battle System
- Turn-based card combat against study-themed monsters (simplified Block Tales mechanics)
- **Purpose**: Serves CBSE HOTS (Higher Order Thinking Skills) through strategic gameplay — analysis, planning, adaptive thinking
- Cards represent study actions: Attack = answer correctly, Defend = use hint/review, Heal = reinforce knowledge
- Monster abilities = abstract study challenges (not direct Q&A)
- Win by reducing monster HP to 0 before player HP reaches 0
- Simplified SP economy: cards cost SP, SP regenerates each turn
- Simplified guard: basic block reduces incoming damage
- **Card decks = study sets**; equipping cards = selecting study tools for battle
- **XP earned from**: fighting monsters, completing study sessions, Event Missions, CBT, Revision Centre — all sources grant XP toward levels
- Challenging but achievable — requires strategy, not just memorization

### Areas & Portals (Progression Map)
- **Worlds** contain multiple **Areas** — each Area has subsections, mini-bosses, and a final boss
- **Overworld**: Beginner/intermediate topics, multiple Areas, final Area boss unlocks next World
- **Otherworld**: Glitched/hard mode version of Overworld (Pig 64 Roblox-inspired), advanced topics
- **The End**: Final boss, mastery exam, beats the main game
- **The Limbo**: Endgame portal, requires beating The End + reaching level 35 (future update)

### Card System
- **Rarity tiers**: Common, Super Rare, **Legendary, Mythic** (only Legendary/Mythic are non-earnable — must come from battlepass/events)
- **Abilities per card**: Common/Super Rare = 3 abilities; Legendary/Mythic = 4 abilities
- **Card Marketplace**: Earnable cards (Common–Super Rare) can be bought/traded with SLC
- **Ability Shop**: Buy abilities with SLC; abilities replace existing card abilities (limited slots)

### Battlepass
- Season-based, one month per season, new season each month with new rewards
- EXP earned through Event Missions and study activities (separate from level XP)
- Battlepass tracks EXP progression; final reward = Legendary card (requires high EXP)
- Rewards include: cards, items, abilities, cosmetics, XP boosts
- AI generates seasonal mission pools based on user notes/text

### Event Missions
- AI-chosen missions based on user notes and submitted text
- Understanding-based questions (not rote memorization)
- Good EXP rewards (for battlepass) + XP (for levels)
- Timed/limited availability aligned with battlepass seasons

### Item Shop
- Buy items with SLC
- Items counter specific monster abilities (e.g., "Focus Orb" reduces monster confusion chance)
- Consumable or equippable depending on item type

### Deflationary SLC Sinks (Spending)
- Card marketplace (Common–Super Rare cards)
- Ability shop (buy/replace card abilities)
- Item shop (battle consumables)
- Programme creation submission fee
- Cosmetic shop (avatar skins, titles, profile themes, card backs)

### RPG Progression Loop
1. Study → earn XP (levels) + EXP (battlepass) + SLC (currency)
2. Level up → unlock new Areas/portals
3. Earn SLC → buy cards, abilities, items, cosmetics
4. Equip cards/abilities → enter battles (Block Tales-style combat)
5. Win battles → progress through Areas, earn more rewards
6. Complete Event Missions → battlepass EXP → Legendary/Mythic cards

### Admin/Teacher Controls
- Create Missions with custom SLC rewards
- Approve/reject student Programmes
- View Revision Centre fund ledger (public but admin can moderate)
- Manage CBT weekly subject votes
- Assign/revoke teacher permissions

## Open Questions

1. **OpenRouter API key**: Need a key for AI features — have one already?
2. **Custom domain**: Will you use a custom domain for Cloudflare Pages, or the default `*.pages.dev`?
3. **Data migration**: Any existing Studyield data to preserve, or starting fresh?
4. **Database fallback strategy**: Should we pre-configure connection strings for Render/Neon as hot-failover, or only switch manually if MonkeysCloud fails?
5. **Teacher capabilities**: Can teachers create study sets for their class, view student progress, grade submissions? What else?
6. **Account approval workflow**: Should new accounts require admin approval before access, or are they active immediately?
7. **Monster design**: What do monsters look like and how do they behave? (Need at least 3-5 monster types for initial release)

---

## Risks

- **MonkeysCloud is new**: Platform may have bugs or change terms. Mitigation: pre-configured fallback to Render or Neon. Database and cache have separate fallbacks too.
- **Cold starts**: MonkeysCloud free tier sleeps after 30 min idle. First request after sleep takes 3-5s. Acceptable for class demo.
- **AI simplification**: Removing RAG/vector search reduces AI quality. Acceptable tradeoff for free hosting.
- **Code Sandbox JS-only**: Restricting to browser Web Workers means no Python/NumPy. Students lose Python execution but gain zero server cost.
- **Render Postgres 90-day expiry**: If we fall back to Render, the free Postgres DB expires every 90 days and must be renewed. Mitigation: use Neon as primary fallback (no expiry), or set calendar reminders to renew.
