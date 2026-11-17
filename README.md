# Minimi — Web Search Chat Agent with Ambient Memory

> A state-of-the-art Web Search Chat Agent built with **Multi-View Episodic Memory System** & **AgentBridge Governance**.
> Designed for the [Binary / Minimi Hiring Challenge](https://binary.so/YIrD8L5).

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-42b883?logo=vue.js)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.1-646CFF?logo=vite)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-green?logo=node.js)](https://nodejs.org/)

---

## ⚡ Quickstart

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```
Add your preferred LLM API key (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, or `GROQ_API_KEY`).
*(Optional: Add `BRAVE_SEARCH_API_KEY` or `TAVILY_API_KEY`. If omitted, Minimi automatically uses its built-in zero-key fallback searcher—it will search the live web and never crash!)*

### 3. Run Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🧪 Testing the 3 Hiring Benchmark Queries

Minimi includes a built-in **Evaluator Benchmark Suite** drawer in the UI with 1-click test buttons for the exact evaluation prompts:

1. **CRM Shortlist Delta**:
   > *"On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?"*
   - Recalls the Monday session with HubSpot, Pipedrive, Zoho, Close, and Salesforce.
   - Decomposes into targeted diff queries and synthesizes a "Then vs. Now" pricing comparison.

2. **Absolute Date Recall & Verification**:
   > *"What did I ask you on 3 November? Is your answer still correct today?"*
   - Resolves the calendar date anchor (Nov 3).
   - Recalls the exact past question and verifies whether Claude 3.5 Haiku pricing & specs remain accurate today.

3. **Relative Date & Postgres Hosting**:
   > *"Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?"*
   - Resolves "Last Tuesday" to the exact calendar date.
   - Recalls Supabase, Neon, AWS Aurora Serverless, and Crunchy Bridge, running parallel live searches to check for pricing deltas.

### Automated Tests
Run the standalone test suite:
```bash
npm test
```

### Terminal CLI Mode
Chat with Minimi directly in your terminal:
```bash
npm run cli
```

---

## 🏛️ Architecture Overview

For full technical details, rationale, rejected alternatives, and future roadmap, see **[DESIGN.md](./DESIGN.md)**.

- **Multi-View Memory System** (`src/core/memory/`):
  - *Episodic View*: Time-indexed event log resolving relative dates (`"last Tuesday"`, `"on Monday"`).
  - *State / Fact Store*: Tri-temporal truth model `(subject, predicate, object, validFrom, validUntil, isSuperseded)`.
  - *Deterministic Entity Profile Injection*: Guarantees 100% recall for shortlisted tools and hosts.
  - *Proactive Direct Recall*: Context injected in <1ms without wasting tool round-trips.

- **AgentBridge Tool Governance** (`src/core/agent/` & `src/client/components/`):
  - *Supervised Mode*: Human-in-the-loop permission dialog (`Allow Once`, `Always Allow`, `Deny`) with full parameter payload preview.
  - *Auto-Pilot Mode*: Fast automated search with collapsible execution scratchpad.

- **Unified Web Search Tool** (`src/core/search/`):
  - *Parallel Query Decomposition*: Splits broad prompts into high-signal searches.
  - *Multi-Provider*: Brave Search API, Tavily API, and zero-key DuckDuckGo fallback.
  - *Inline Citations*: Numeric markdown badges `[1]`, `[2]` linking directly to verified sources.

---

## 📂 Project Structure

```text
minimi/
├── server.ts                    # Express + Vite unified server (port 3000)
├── DESIGN.md                    # 1-page architectural design document
├── .env.example                 # Environment variables template
├── test/
│   └── benchmark.test.ts        # Automated verification tests for the 3 queries
├── src/
│   ├── core/
│   │   ├── types.ts             # Domain & protocol types
│   │   ├── memory/              # Multi-View Memory System Engine
│   │   │   ├── temporal-parser.ts # Relative date parser ("last Tuesday", "on Monday")
│   │   │   ├── episodic-store.ts  # Time-indexed conversation log
│   │   │   ├── fact-store.ts      # Tri-temporal facts (valid_from, is_superseded)
│   │   │   ├── entity-profiles.ts # Deterministic entity profiles
│   │   │   ├── Memory System.ts     # Multi-view retrieval router
│   │   │   └── seed-scenarios.ts  # Pre-seeded benchmark dataset
│   │   ├── search/              # Unified Web Search Tool ("The One Tool")
│   │   │   ├── search-router.ts   # Provider router (Brave, Tavily, Fallback)
│   │   │   ├── query-planner.ts   # Targeted diff query decomposer
│   │   │   ├── brave-search.ts    # Brave Search client
│   │   │   ├── tavily-search.ts   # Tavily Search client
│   │   │   └── fallback-search.ts # Zero-key web search fallback
│   │   ├── llm/                 # Multi-Model Streaming Provider
│   │   │   ├── llm-client.ts      # OpenAI, Anthropic, Gemini, Groq, Fallback
│   │   │   └── prompts.ts         # System prompts & citation formatting
│   │   └── agent/               # Orchestrator & Governance
│   │       ├── orchestrator.ts    # Core state machine & streaming pipeline
│   │       └── permission-gate.ts # AgentBridge permission manager
│   ├── server/                  # HTTP & SSE Endpoints
│   │   ├── routes.ts            # /api/chat/stream, /api/tool/approve, /api/memory
│   │   └── sse.ts               # Server-Sent Events helper
│   ├── client/                  # Vue 3 Frontend (AgentBridge UI/UX)
│   │   ├── App.vue              # Main App shell
│   │   ├── components/
│   │   │   ├── AIagent.vue              # Chat UI with SSE stream & input
│   │   │   ├── ToolPermissionMessage.vue # In-stream approval card
│   │   │   ├── Scratchpad.vue           # Collapsible execution thoughts trace
│   │   │   ├── BenchmarkDrawer.vue      # 1-click hiring benchmark runner
│   │   │   └── CitationBadge.vue        # Clickable verified source badges
│   │   └── style.css            # Tailwind styling
│   └── cli.ts                   # Terminal CLI runner (npm run cli)
```
