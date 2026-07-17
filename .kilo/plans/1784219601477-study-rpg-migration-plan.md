# Study RPG — Migration Plan

## Goal
Rebrand Studyield as **Study RPG**, strip non-essential features, and deploy the frontend on Cloudflare Pages with the backend on MonkeysCloud (free, no CC).

---

## Architecture

| Layer | Technology | Host |
|-------|-----------|------|
| Frontend | React 19 + Vite (static build) + Pages Functions proxy | Cloudflare Pages |
| Backend | Next.js (API routes + WebSocket + app logic) | MonkeysCloud |
| Database | PostgreSQL + pgvector | Neon |
| Cache | Redis (optional, for sessions/rate limiting) | Upstash Redis free tier or MonkeysCloud Redis |
| Auth | JWT (username + password) | Next.js backend |
| AI/LLM | Multi-provider (OpenRouter, Groq, Together AI, NAVY AI, Custom OpenAI-compatible) | Next.js backend |

**Data flow:**
```
Frontend → Cloudflare Pages Functions → Next.js API routes → Neon PostgreSQL
                    ↓
              WebSocket (direct to Next.js)
```

**Why this architecture:**
- One backend project = one stack (Next.js), satisfies platform constraint
- Neon provides PostgreSQL + pgvector (vector search) in one database
- Next.js handles everything: API, database, AI, WebSocket, RPG logic
- Frontend proxies through Pages Functions to avoid CORS

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
- Add dark mode support: system-preference detection + manual toggle, persisted in localStorage

### 1.5. Auth System Redesign
- Remove email-based registration entirely — no self-registration
- Account creation modes:
  - **Admin creates account**: Admin directly creates user with `name`, `username`, `password`, `role`
  - **Admin approves registration**: (Optional) Student requests account, admin approves — but primary flow is admin-created
- Remove email verification flow entirely
- Remove password reset via email
- Seed database with pre-built admin account:
  - username: `Nightmare`
  - name: `Joshua Martin`
  - password: `N1GHTMAREISGoD@123` (set via env var or seed script)
  - role: `admin`
- Add role system: `student`, `teacher`, `admin`
- Teacher capabilities: **same as admin** — full admin abilities (promote/demote, create accounts, approve programmes, manage missions, view all data)
- Admin capabilities:
  - Create accounts (username, name, password, role)
  - Modify existing accounts and data (role changes, content edits)
  - Approve/reject student Programmes
  - Create Missions with custom SLC rewards
  - Manage CBT weekly subject votes
  - View all system data including Revision Centre funds
- **Audit logging**: All admin/teacher modifications are logged with:
  - Who made the change (admin/teacher username)
  - What was changed (target entity, field, old value, new value)
  - When it was changed (timestamp)
  - Logs are visible to all admins (transparency — teachers can verify admin actions, admins can verify teacher actions)
- Update login UI (no register page — accounts are created by admin only)
- Remove all email-related auth infrastructure (SMTP, email templates, etc.)

### 2. Frontend Cloudflare Pages Config
- Create `public/_routes.json` for SPA fallback:
  ```json
  {
    "version": 1,
    "include": ["/*"],
    "exclude": ["/assets/*"]
  }
  ```
- Update `vite.config.ts` build output if needed (ensure `dist/` is correct)
- Cloudflare Pages build settings:
  - Build command: `npm run build`
  - Build output: `dist`
  - Root directory: `frontend/`
  - No custom domain needed — use default `*.pages.dev` or Cloudflare-provided domain
- Add `.env` variable documentation:
  - `VITE_API_URL`: `/api` (proxied through Pages Functions)
  - `VITE_WS_URL`: Next.js app server WebSocket URL (e.g., `https://app-server.monkeyscloud.com`)

### 3. Pages Functions Proxy (API routing)
- Create `functions/api/[[path]].ts` in frontend/
- Proxies all `/api/*` requests to Next.js app server
- Environment variable: `BACKEND_URL` = Next.js app server URL on MonkeysCloud
- Handles CORS preflight (`OPTIONS`) with `Access-Control-Allow-Origin: *`
- Forwards all HTTP methods (GET, POST, PUT, DELETE, PATCH)
- WebSocket connections bypass Pages Functions — frontend connects directly to Next.js WebSocket URL

### 4. Next.js Backend (MonkeysCloud)
- Stack: Next.js (Node.js, API routes + WebSocket)
- Role: Complete backend — API, database, AI/LLM, WebSocket, RPG logic, calculations
- Contains:
  - Next.js API routes for ALL operations (replaces NestJS entirely)
  - Socket.io server for real-time features (Live Quiz, Collaborative Exam, Chat, Research, Problem Solver, Exam Clone)
  - Direct PostgreSQL access via pg client or ORM (Prisma/Drizzle)
  - PgVectorService for vector search (replaces Qdrant)
  - LLM provider management and fallback chain
  - RPG battle calculations, card effects, area progression logic
  - Mission assessment, Revision Centre quiz generation, CBT generation, Event Mission generation, Programme evaluation
  - Audit logging
  - Admin/teacher management endpoints
- WebSocket CORS: allow Cloudflare Pages origin
- Environment variables:
  - `DATABASE_URL`: Neon PostgreSQL connection string
  - `REDIS_URL`: Upstash Redis or MonkeysCloud Redis (optional)
  - `JWT_SECRET`: shared with frontend
  - `CORS_ORIGIN`: Cloudflare Pages domain
  - `OPENROUTER_API_KEY`: primary LLM key
  - `GROQ_API_KEY`: fallback
  - `TOGETHER_API_KEY`: fallback
  - `NAVY_API_KEY`: fallback

### 5. Database Setup (Neon)
- Provider: Neon PostgreSQL (free tier, pgvector included, no expiry)
- Run migrations:
  - `CREATE EXTENSION IF NOT EXISTS vector;` (pgvector)
  - All existing Studyield schema migrations
  - New migrations: `audit_logs`, `llm_providers`, `slc_wallets`, `xp_records`, `levels`, `user_levels`, `areas`, `worlds`, `monsters`, `user_progress`, `cards`, `user_cards`, `card_marketplace`, `battlepass_seasons`, `battlepass_tiers`, `user_battlepass`, `event_missions`, `abilities`, `items`, `cosmetics`, `revision_centre_funds`, `programmes`, `cbt_sessions`, `cbt_votes`
- Seed initial game content (monsters, cards, areas, battlepass season 1)
- Seed admin account (Nightmare / Joshua Martin / N1GHTMAREISGoD@123)
- Fallback: MonkeysCloud PostgreSQL if Neon has issues
- No RAG pipeline needed — LLM does retrieval + generation in one call

**2. Deep Research** → RAG-powered research report generator
- User provides topic + source documents/notes
- Backend extracts text from documents, stores in PostgreSQL
- LLM retrieves relevant passages via semantic search, then generates structured report: Introduction, Key Findings, Analysis, Evidence, Conclusion, References
- Citations reference specific document passages
- Frontend: document upload + report output with collapsible source sections

**3. Code Sandbox** → Full Python + JavaScript execution
- **JavaScript**: Runs in browser Web Worker (fast, no server cost)
- **Python**: Uses Pyodide (Python in WebAssembly) running entirely in browser — gives full Python execution with NumPy, Pandas, SciPy, Matplotlib at zero server cost
- No server-side execution needed
- Frontend: Monaco editor + split-pane output console + file tabs
- Backend: not involved for execution (pure frontend feature)

**4. Knowledge Graph** → LLM-extracted entity visualization
- User provides text / notes / topic
- Backend sends text to LLM: "Extract all key entities and their relationships. Return strict JSON: {nodes: [{id, label, type, importance}], edges: [{source, target, relationship, strength}]}"
- LLM returns structured JSON with entity importance scores
- Frontend: D3.js force-directed graph with node sizing by importance, edge thickness by relationship strength, collapsible clusters, search/filter

**5. Learning Paths** → AI-generated personalized study routes
- User provides: subject, goal (exam/basic/mastery), current level, available time
- LLM generates ordered learning path with nodes: topic → subtopic → resource → quiz → checkpoint
- Path stored in PostgreSQL, user progresses through nodes sequentially
- Unlock gates: must pass checkpoint quiz to advance
- Frontend: visual path/progression UI with node status (locked/active/completed)

**6. Teach-Back** → Feynman technique with voice + text evaluation
- **Voice input**: Uses Web Speech API (browser-native speech-to-text, free)
- **Text input**: Student types explanation
- Backend sends explanation + concept to LLM: "Evaluate this explanation using Feynman technique criteria: accuracy, clarity, completeness, simplicity. Score each 1-10. Identify gaps. Suggest improvements."
- LLM returns detailed evaluation with scores and feedback
- Frontend: voice record button + textarea + score dashboard + gap analysis

**7. Exam Clone** → PDF/text-to-question generator with vector-like retrieval
- User uploads PDF/textbook/past paper or pastes text
- Backend extracts text via pdf-parse, stores in PostgreSQL
- LLM analyzes text structure, identifies key topics, generates questions in CBSE format: MCQ (1 mark), Short Answer (2-3 marks), Long Answer (5 marks)
- Includes answer key with marking scheme
- Frontend: file upload + generated quiz preview + download as PDF

**8. Multi-Agent Problem Solver** → Sequential specialist agents with streaming
- **Agent 1 (Analyst)**: Breaks down problem, identifies type, lists knowns/unknowns
- **Agent 2 (Solver)**: Applies step-by-step solution with reasoning
- **Agent 3 (Verifier)**: Checks each step for errors, validates final answer
- **Agent 4 (Hint Generator)**: Provides progressive hints if user is stuck
- Backend calls LLM sequentially, streams each agent's output via SSE
- Camera scan: user uploads photo of problem → backend uses vision-capable LLM (OpenRouter multimodal) to extract text → feeds to Agent 1
- Frontend: problem input (text/camera) + agent output panels with streaming + hint system

**9. Live Quiz** → Real-time multiplayer quiz rooms
- Teacher creates room, sets quiz parameters (time per question, scoring)
- Students join via room code
- Questions delivered in real-time via Socket.io
- Auto-scoring, live leaderboard, timer per question
- Teacher dashboard: see all submissions, pause/resume, view stats
- Frontend: student quiz UI + teacher admin UI

**10. Collaborative Exam** → Real-time multiplayer exam sessions
- Teacher creates timed exam with question bank
- Students join via room code
- Real-time exam session via Socket.io with countdown timer
- Proctoring dashboard: teacher sees live submissions, flags suspicious activity
- Auto-submit when timer ends
- Post-exam: detailed analytics per student, question difficulty analysis
- Frontend: exam UI with timer + teacher proctoring dashboard

#### AI Feature Integration Points (all use multi-provider fallback)
- Mission assessment (teacher-created → AI grades)
- Revision Centre quiz generation (AI generates quiz from topic)
- CBT generation (AI generates 30-mark CBSE-style exam)
- Event Mission generation (AI generates understanding-based questions from user notes)
- Programme evaluation (AI evaluates programme quality, pedagogical soundness, feasibility)

### 4. Database Setup
- Primary: MonkeysCloud PostgreSQL 16 (both projects connect to same DB)
- Fallback: Neon PostgreSQL (free, pgvector included, no expiry)
- Run migrations on chosen database:
  - `CREATE EXTENSION IF NOT EXISTS vector;` (pgvector)
  - All existing Studyield schema migrations
  - New migrations: `audit_logs`, `llm_providers`, `slc_wallets`, `xp_records`, `levels`, `user_levels`, `areas`, `worlds`, `monsters`, `user_progress`, `cards`, `user_cards`, `card_marketplace`, `battlepass_seasons`, `battlepass_tiers`, `user_battlepass`, `event_missions`, `abilities`, `items`, `cosmetics`, `revision_centre_funds`, `programmes`, `cbt_sessions`, `cbt_votes`
- Seed initial game content (monsters, cards, areas, battlepass season 1)
- Seed admin account (Nightmare / Joshua Martin / N1GHTMAREISGoD@123)

### 5. Next.js Backend Deployment (MonkeysCloud)
- Stack: Next.js (Node.js)
- Auto-detected by MonkeysCloud on push
- Single backend project — handles everything: API, database, AI, WebSocket, RPG logic
- Environment variables:
  - `DATABASE_URL` — Neon PostgreSQL connection string
  - `REDIS_URL` — Upstash Redis or MonkeysCloud Redis (optional)
  - `JWT_SECRET` — shared with frontend
  - `CORS_ORIGIN` — Cloudflare Pages domain
  - `OPENROUTER_API_KEY` — primary LLM key
  - `GROQ_API_KEY` — fallback
  - `TOGETHER_API_KEY` — fallback
  - `NAVY_API_KEY` — fallback
- Contains:
  - Next.js API routes for ALL operations (replaces NestJS entirely)
  - Socket.io server for WebSocket features
  - Direct PostgreSQL access with pgvector
  - LLM fallback chain
  - RPG battle calculations, card effects, area progression logic
  - Audit logging
  - Admin/teacher management endpoints

### 7. Frontend API Config
- API base URL: `/api` (proxied through Cloudflare Pages Functions to Next.js)
- WebSocket URL: `VITE_WS_URL` = Next.js app server URL (direct connection, not proxied)
- All HTTP requests go through Pages Functions → Next.js → Neon PostgreSQL
- WebSocket connections go directly to Next.js server

### 8. Testing & Validation
- Build frontend: `npm run build` in `frontend/`
- Deploy frontend to Cloudflare Pages (connect Git repo)
- Deploy Next.js backend to MonkeysCloud
- Set up Neon PostgreSQL, run migrations
- Test proxy flow: Frontend → Pages Functions → Next.js → Neon
- Test auth flow (login only — accounts created by admin, admin features, audit logs)
- Test each Main Feature (Flashcards, Quiz, Match, Notes, etc.)
- Test each Tool (full versions with multi-provider fallback)
- Test Live Quiz multiplayer via WebSocket
- Test CORS between all layers
- Test audit logging: verify admin/teacher actions are recorded and visible
- Verify no broken routes, missing assets, or console errors
- Test LLM provider failover chain
- Test pgvector search functionality

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

### Spending SLC
- Card marketplace (Common–Super Rare cards)
- Ability shop (buy/replace card abilities)
- Item shop (battle consumables)
- Programme creation submission fee
- Cosmetic shop (avatar skins, titles, profile themes, card backs)

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

### RPG Progression Loop
1. Study → earn XP (levels) + EXP (battlepass) + SLC (currency)
2. Level up → unlock new Areas/portals
3. Earn SLC → buy cards, abilities, items, cosmetics
4. Equip cards/abilities → enter battles (Block Tales-style combat)
5. Win battles → progress through Areas, earn more rewards
6. Complete Event Missions → battlepass EXP → Legendary/Mythic cards

### Initial Game Content

#### Monsters (5 types, CBSE HOTS-themed)
| Monster | Theme | HP | SP | Attack Pattern | Weakness | Drops |
|---------|-------|----|----|---------------|----------|-------|
| **Confusion Beast** | Distractor questions | 80 | 20 | Random target, applies Confuse (+2 SP cost next turn) | Defend cards clear confusion | SLC, Common cards |
| **Time Wraith** | Procrastination/pressure | 70 | 35 | Fast attacks, reduces player SP regen by 1 | Heal cards restore SP regen | SLC, Common cards |
| **Memory Phantom** | Rote memorization | 100 | 15 | Drains 5 HP/turn ("forgetting") | Attack cards deal +50% damage | SLC, Super Rare cards |
| **Doubt Golem** | Self-doubt/imposter | 120 | 25 | High defense, reflects 30% damage | Break ability cards bypass defense | SLC, Super Rare cards |
| **Error Spirit** | Careless mistakes | 60 | 30 | Low HP but 25% crit chance | Guard timing halves crit damage | SLC, Common cards |

#### Initial Cards (12 obtainable, 2 battlepass-exclusive)
| Card | Rarity | SP Cost | Ability 1 | Ability 2 | Ability 3 | Ability 4 | Effect |
|------|--------|---------|-----------|-----------|-----------|-----------|--------|
| **Basic Strike** | Common | 2 | Attack | — | — | — | 15 damage |
| **Basic Guard** | Common | 1 | Defend | Clear confusion | — | — | Block 10 damage, clear confusion |
| **Quick Heal** | Common | 2 | Heal | — | — | — | Restore 15 HP |
| **Focus** | Common | 1 | Buff | +10% next attack | — | — | Next card deals +15% damage |
| **Power Strike** | Super Rare | 3 | Attack | Break defense | — | — | 25 damage, bypasses 30% defense |
| **Iron Guard** | Super Rare | 2 | Defend | Reflect 20% | Restore 1 SP | — | Block 15, reflect 5, regen 1 SP |
| **Knowledge Boost** | Super Rare | 3 | Heal | +10 max HP (battle) | — | — | Restore 20 HP, temp +10 max HP |
| **Clarity** | Super Rare | 2 | Buff | Remove debuffs | +15% all stats | — | Clear all debuffs, +15% damage/defense |
| **Mind Clearer** | Legendary | 3 | Attack | Heal | Clear confusion | Restore 2 SP | 20 damage, heal 10, clear confusion, regen 2 SP |
| **Scholar's Edge** | Legendary | 4 | Attack | Break | Crit +30% | — | 35 damage, bypass defense, high crit chance |
| **Exam Aegis** | Mythic | 2 | Defend | Full heal | Immunity 1 turn | — | Block all damage, full heal, next turn immune |
| **Ultimate Comprehension** | Mythic | 5 | Attack | Heal | Buff | Break | 50 damage, heal 25, +20% stats, bypass defense |

*Legendary/Mythic cards are battlepass/event-only. First battlepass final reward = Mind Clearer.*

#### Initial Areas (3 Areas, inside Overworld)
| Area | Theme | Subsections | Mini-bosses | Final boss | Required level | Rewards |
|------|-------|-------------|-------------|------------|----------------|---------|
| **Area 1: Foundations** | Basic concepts | 3 subsections (Recall, Understand, Apply) | Confusion Beast x2 | Time Wraith (boss) | 1 | SLC, Common cards, unlocks Area 2 |
| **Area 2: Applications** | Problem solving | 3 subsections (Analyze, Evaluate, Create) | Memory Phantom x2 | Doubt Golem (boss) | 5 | SLC, Super Rare cards, unlocks Area 3 |
| **Area 3: Mastery** | Advanced synthesis | 3 subsections (Synthesize, Debate, Innovate) | Error Spirit x2 | Error Spirit (final boss, empowered) | 10 | SLC, unlocks Otherworld, title "Mastermind" |

#### Worlds Structure
| World | Contains | Unlock condition |
|-------|----------|------------------|
| **Overworld** | Areas 1–3 | Starting world |
| **Otherworld** | Glitched versions of Areas 1–3 (harder stats, modified patterns) | Beat Area 3 final boss |
| **The End** | Single mastery exam/area | Beat Otherworld |
| **The Limbo** | Endgame content | Beat The End + level 35 (future update) |

#### Battlepass Season 1 (example)
- Duration: 1 month
- EXP required for final reward: 5000 EXP
- Final reward: **Mind Clearer** (Legendary card)
- Tier rewards: SLC boosts, Common/Super Rare cards, cosmetics, ability tokens
- Event Missions: AI-generated from user notes, understanding-based questions

### Admin/Teacher Controls
- Teachers have **full admin abilities** (same permissions as admin):
  - Create accounts (username, name, password, role)
  - Modify existing accounts and data (role changes, content edits)
  - Create Missions with custom SLC rewards
  - Approve/reject student Programmes
  - Manage CBT weekly subject votes
  - View all system data including Revision Centre funds
- **Audit logging** (transparency requirement):
  - All admin/teacher modifications are logged: actor, action, target, old value, new value, timestamp
  - Logs are visible to all admins and teachers
  - Purpose: admin can verify teacher actions, teachers can verify admin actions — prevents cheating
- **No self-registration**: Accounts are created only by admin/teacher — no public register page

## Open Questions

1. **None pending** — all major design decisions resolved. Game content (monsters, cards, areas) designed in "Initial Game Content" section. Minor tweaks to content can be made during implementation.

---

## Risks

- **MonkeysCloud is new**: Platform may have bugs or change terms. Mitigation: Next.js is well-supported (32 stacks including Next.js). Can redeploy to Render/Vercel if needed.
- **Single backend point of failure**: All logic in one Next.js app. Mitigation: modular code structure, can split later if needed.
- **Cold starts**: MonkeysCloud free tier sleeps after 30 min idle. First request after sleep takes 3-5s. Acceptable for class demo.
- **LLM provider exhaustion**: Multi-provider fallback chain mitigates rate limits/outages, but free tiers have hard caps. Mitigation: use generous free tiers + prompt caching.
- **Code Sandbox JS-only**: Restricting to browser Web Workers means no Python/NumPy. Students lose Python execution but gain zero server cost.
- **Neon Postgres free tier limits**: Neon free tier has connection/usage limits. Mitigation: connection pooling via PgBouncer if needed.
- **Audit log volume**: High admin/teacher activity generates many log rows. Mitigation: set log retention policy (e.g., 90 days), archive old logs.
- **Teachers = admins**: Full admin rights for teachers is risky. Mitigation: audit logs provide transparency — all teacher actions are visible to other admins.
