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
| AI/LLM | Multi-provider (OpenRouter, Groq, Together AI, NAVY AI, Custom OpenAI-compatible) | Called from NestJS backend | — |

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
    "exclude": ["/api/*", "/assets/*"]
  }
  ```
- Update `vite.config.ts` build output if needed (ensure `dist/` is correct)
- Cloudflare Pages build settings:
  - Build command: `npm run build`
  - Build output: `dist`
  - Root directory: `frontend/`
  - No custom domain needed — use default `*.pages.dev` or Cloudflare-provided domain
- Add `.env` variable documentation for Vite `VITE_API_URL` pointing to MonkeysCloud backend URL

### 3. Backend AI Feature Simplification & Tool Redesign (remove Qdrant, add multi-provider LLM)
- Remove Qdrant module and all vector embedding logic
- Add multi-provider LLM support with automatic fallback:
  - Providers: OpenRouter (primary), Groq, Together AI, NAVY AI, Custom OpenAI-compatible
  - Admin can add/remove/reorder providers at runtime via admin interface
  - Providers stored in DB: name, provider type (openrouter/groq/together/navy/custom_openai), API key, base URL, model name, priority order
  - Custom OpenAI-compatible provider allows admin to enter any OpenAI-compatible endpoint (e.g., local LLM, Ollama, LM Studio, vLLM, Together AI, Fireworks)
  - Backend tries providers in sequence if one fails (rate limit, outage, quota exhausted)
  - All AI features use this fallback chain

#### Simplified Tool Designs (no RAG, no vector DB, no multi-agent)

**1. AI Chat** → Simple study chatbot
- User types a study question or topic
- Backend sends it + conversation history to LLM via fallback chain
- LLM responds as a study tutor (no document context, no RAG)
- No file uploads, no knowledge base
- Frontend: chat UI with message history

**2. Deep Research** → Text-to-report generator
- User pastes source text / notes / topic description
- Backend sends text + prompt to LLM: "Generate a structured research report with sections: Introduction, Key Points, Analysis, Conclusion, Sources"
- LLM returns formatted report
- Frontend: textarea input + formatted report output

**3. Code Sandbox** → JavaScript-only browser execution
- User writes JavaScript code in a code editor
- Code runs in a Web Worker in the browser (no server execution)
- No Python/NumPy/Pandas
- Frontend: Monaco/CodeMirror editor + output console
- Backend: not involved (pure frontend feature)

**4. Knowledge Graph** → LLM-extracted entity visualization
- User provides text / notes / topic
- Backend sends text to LLM with prompt: "Extract key entities and relationships. Return JSON format: {nodes: [{id, label, type}], edges: [{source, target, label}]}"
- LLM returns structured JSON
- Frontend: D3.js force-directed graph renders the JSON
- No vector embeddings, no similarity search

**5. Learning Paths** → Template-based sequencing
- No AI generation
- Admin/teacher creates predefined learning paths (ordered list of topics/resources)
- Student selects a path and progresses through it linearly
- Each node = study set / quiz / note
- Frontend: linear progression UI with unlock gates

**6. Teach-Back** → Text-only Feynman evaluation
- Student types an explanation of a concept in their own words
- Backend sends explanation + concept prompt to LLM: "Evaluate this explanation for accuracy, clarity, and completeness. Score 1-10 and give feedback."
- LLM returns score + feedback
- Frontend: textarea input + score display + feedback text

**7. Exam Clone** → Text-to-question generator
- User pastes text from a textbook / notes / past paper
- Backend sends text + prompt to LLM: "Generate 10 practice questions in the style of a CBSE exam. Mix MCQ, short answer, and long answer. Include answers."
- LLM returns formatted questions
- Frontend: textarea input + formatted quiz display

**8. Multi-Agent Problem Solver** → Single LLM structured solver
- User submits a problem (math, physics, etc.)
- Backend sends problem + prompt to LLM: "Solve step by step. Format: Analysis → Step 1 → Step 2 → Step 3 → Final Answer → Verification."
- LLM returns structured solution
- Frontend: problem input + step-by-step solution display

**9. Live Quiz** → Multiplayer quiz via WebSocket
- Teacher creates quiz room with questions
- Students join room via room code
- Real-time questions via Socket.io (already in NestJS)
- Scoring, timer, leaderboard in real-time
- Frontend: quiz UI with live updates

**10. Collaborative Exam** → Multiplayer exam via WebSocket
- Teacher creates exam room with timed questions
- Students join via room code
- Real-time exam session via Socket.io
- Proctoring: teacher sees live submissions
- Scoring and results after exam ends
- Frontend: exam UI with timer and live submission tracking

#### AI Feature Integration Points (all use fallback chain)
- Mission assessment (teacher-created → AI grades)
- Revision Centre quiz generation (AI generates quiz from topic)
- CBT generation (AI generates 30-mark CBSE-style exam)
- Event Mission generation (AI generates understanding-based questions from user notes)
- Programme evaluation (AI evaluates programme quality before admin/teacher approval)

### 4. Database Adjustments
- Keep existing PostgreSQL schema (MonkeysCloud provides Postgres)
- Remove Qdrant-related tables/migrations
- Remove ClickHouse-related setup
- Simplify analytics tables if needed
- Update TypeORM/Prisma connection config for MonkeysCloud env vars
- Add `audit_logs` table:
  - `id`, `actor_username`, `action` (e.g., "user.role_changed", "mission.created", "programme.approved")
  - `target_type` (user, mission, programme, etc.), `target_id`
  - `old_value`, `new_value` (JSON)
  - `timestamp`
  - Indexed by actor + timestamp for fast queries
- **Fallback DB**: Simplified hot failover — app tries primary `DATABASE_URL` first, if connection fails it automatically falls back to `DATABASE_URL_FALLBACK`. No complex sync, just failover. Schema stays the same.
- **Fallback Cache**: Simplified hot failover — same pattern for Redis `REDIS_URL` and `REDIS_URL_FALLBACK`.

### 5. Backend Deployment to MonkeysCloud
- Create `Dockerfile` for NestJS backend (MonkeysCloud supports Docker)
- Or use MonkeysCloud's Node.js native buildpack (auto-detect)
- Configure environment variables:
  - `DATABASE_URL` — MonkeysCloud PostgreSQL connection string
  - `REDIS_URL` — MonkeysCloud Redis connection string
  - `JWT_SECRET` — generate new secret
  - `CORS_ORIGIN` — Cloudflare Pages domain
  - `ADMIN_DEFAULT_PASSWORD` — password for pre-seeded Nightmare account
- **LLM providers are DB-managed**: Admin adds providers via admin interface (no env vars needed for individual providers). Primary provider can be set as default via env var `LLM_PRIMARY_PROVIDER` for bootstrapping.
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
- Test auth flow (login only — accounts created by admin, admin features, audit logs)
- Test each Main Feature (Flashcards, Quiz, Match, Notes, etc.)
- Test each Tool (simplified versions with multi-provider fallback)
- Test Live Quiz multiplayer
- Test CORS between frontend and backend
- Test audit logging: verify admin/teacher actions are recorded and visible
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

- **MonkeysCloud is new**: Platform may have bugs or change terms. Mitigation: pre-configured fallback to Render or Neon. Database and cache have separate fallbacks too.
- **Cold starts**: MonkeysCloud free tier sleeps after 30 min idle. First request after sleep takes 3-5s. Acceptable for class demo.
- **AI simplification**: Removing RAG/vector search reduces AI quality. Acceptable tradeoff for free hosting.
- **LLM provider exhaustion**: Multi-provider fallback chain mitigates rate limits/outages, but free tiers have hard caps. Mitigation: use generous free tiers + prompt caching.
- **Code Sandbox JS-only**: Restricting to browser Web Workers means no Python/NumPy. Students lose Python execution but gain zero server cost.
- **Render Postgres 90-day expiry**: If we fall back to Render, the free Postgres DB expires every 90 days and must be renewed. Mitigation: use Neon as primary fallback (no expiry), or set calendar reminders to renew.
- **Audit log volume**: High admin/teacher activity generates many log rows. Mitigation: set log retention policy (e.g., 90 days), archive old logs.
- **Teachers = admins**: Full admin rights for teachers is risky. Mitigation: audit logs provide transparency — all teacher actions are visible to other admins.
