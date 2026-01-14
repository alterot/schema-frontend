# Schemaläggningsassistent - Project Overview

## What It Is

An AI-powered planning engine for healthcare scheduling that combines:
- **Constraint solving** (OR-Tools) for mathematically correct schedules
- **LLM reasoning** (Claude) for natural language understanding and analysis
- **Tool-calling** for AI agents that can read, propose, simulate, and apply changes
- **Metrics** to measure quality and impact

**Not a chatbot** - an agent that takes actions based on real data.

**Core Flow:** User input → AI analyzes → Proposes solutions → Simulates impact → Applies changes

---

## Architecture

```
┌─────────────────────────────────────┐
│      React Frontend (Vite)          │
│   - User input (natural language)   │
│   - Tool orchestration              │
│   - Results visualization           │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│   Cloudflare Worker (Proxy)         │
│   - Secure API key handling         │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│      Claude API (Anthropic)         │
│   - Natural language understanding  │
│   - Tool selection & reasoning      │
│   - Response generation             │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│   Python Backend (Flask)            │
│   - OR-Tools constraint solver      │
│   - Tool endpoints (4 actions)      │
│   - Metrics calculation             │
│   - Vector DB (future: RAG)         │
└─────────────────────────────────────┘
```

### Key Components

**1. Structured Data**
- Staff (roles, availability, employment %)
- Requirements (shifts, competency needs)
- Rules (rest periods, max days, constraints)

**2. AI Tools**
- `read_schedule` - Fetch existing schedules
- `propose_changes` - Generate solutions
- `simulate_impact` - Calculate consequences
- `apply_changes` - Execute approved changes

**3. Metrics**
- Coverage % (staffing level)
- Overtime hours
- Rule violations
- Cost (labor cost estimate)
- Quality score (0-100 composite)

**4. Constraint Solver**
- OR-Tools CP-SAT for guaranteed correctness
- Hard constraints (must satisfy)
- Soft goals (optimize toward)

---

## Implementation Roadmap

### ✅ Phase 1: Core Backend (COMPLETE)
**Goal:** Robust constraint solver with API

**Tasks:**
- [x] Setup Python project structure
- [x] Implement OR-Tools constraint solver
- [x] Create datamodels (Person, Shift, Schedule)
- [x] Build Flask API with CORS
- [x] Input validation
- [x] Conflict detection
- [x] Local testing suite

**Output:** Working API at `http://localhost:5000/generate`

---

### ✅ Phase 2: Metrics & Tools (COMPLETE)
**Goal:** Measurable outcomes + AI action endpoints

**Tasks:**
- [x] Add metrics calculation (coverage, overtime, cost, quality score)
- [x] Create tool endpoint: `GET /api/schedule/<period>`
- [x] Create tool endpoint: `POST /api/propose`
- [x] Create tool endpoint: `POST /api/simulate`
- [x] Create tool endpoint: `POST /api/apply`
- [x] Test all endpoints with mock data

**Output:** Backend ready for AI tool-calling

---

### 🔄 Phase 3: Frontend Tool Orchestration (CURRENT)
**Goal:** React app that orchestrates AI tool calls

**Tasks:**
- [ ] Copy updated CLAUDE_CONTEXT.md to frontend
- [ ] Create `src/config.js` with API URLs
- [ ] Create `src/api/backend.js` - Backend API wrapper
- [ ] Create `src/api/toolDefinitions.js` - Claude tools config
- [ ] Create `src/api/scheduleAgent.js` - Tool orchestration logic
- [ ] Update UI to call scheduleAgent instead of mock data
- [ ] Add loading states and error handling
- [ ] Test full flow: User input → AI → Tools → Result

**Output:** Working AI agent in browser (local)

**Estimated Time:** 3-4 hours

---

### ⏳ Phase 4: Vector DB & RAG (NEXT)
**Goal:** AI learns from historical schedules

**Tasks:**
- [ ] Setup Chroma vector database
- [ ] Create embedding pipeline for schedules
- [ ] Store historical schedules with metadata
- [ ] Implement similarity search
- [ ] Integrate RAG into propose_changes tool
- [ ] Test context retrieval

**Output:** AI can reference similar past scenarios

**Estimated Time:** 2-3 hours

---

### ⏳ Phase 5: Evaluation Suite
**Goal:** Automated quality measurement

**Tasks:**
- [ ] Create test scenarios in `tests/scenarios/`
  - [ ] `high_sickness.json`
  - [ ] `vacation_peak.json`
  - [ ] `understaffed.json`
  - [ ] `optimal_conditions.json`
- [ ] Build `tests/evaluate.py` runner
- [ ] Run all scenarios and collect metrics
- [ ] Generate quality report

**Output:** Objective benchmark (avg quality score)

**Estimated Time:** 1-2 hours

---

### ⏳ Phase 6: Deployment
**Goal:** Live demo accessible online

**Tasks:**
- [ ] Push backend to GitHub
- [ ] Deploy backend to Render.com
- [ ] Update frontend config with production URL
- [ ] Push frontend to GitHub
- [ ] Deploy frontend to GitHub Pages
- [ ] Test production end-to-end
- [ ] Update README with live demo link

**Output:** Public URL for portfolio

**Estimated Time:** 1 hour

---

## Current Status

**Completed:**
- ✅ Backend constraint solver
- ✅ Flask API with 5 endpoints
- ✅ Metrics calculation
- ✅ Tool endpoints (read, propose, simulate, apply)
- ✅ Comprehensive testing

**In Progress:**
- 🔄 Frontend tool orchestration

**Next Up:**
- Vector DB integration
- Evaluation suite
- Production deployment

---

## Quick Start

### Backend (Local)
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Mac/Linux
pip install -r requirements.txt
python app.py
# → Runs on http://localhost:5000
```

### Frontend (Local)
```bash
cd frontend
npm install
npm run dev
# → Runs on http://localhost:5173
```

### Run Tests
```bash
cd backend/tests
python test_solver.py   # Test constraint solver
python test_api.py      # Test main API
python test_tools.py    # Test tool endpoints
```

---

## Tech Stack

**Backend:** Python 3.11+, Flask, OR-Tools, pandas  
**Frontend:** React 18, Vite, vanilla CSS  
**AI:** Claude API (Anthropic) with tool-calling  
**Vector DB:** Chroma (local) or Pinecone (cloud)  
**Deployment:** Render.com (backend), GitHub Pages (frontend)

---

## Repository Structure

```
schema-assistent/
├── frontend/
│   ├── src/
│   │   ├── api/                  # Tool orchestration (Phase 3)
│   │   ├── components/           # UI components
│   │   ├── mockData.js           # Test data
│   │   └── config.js             # API URLs
│   ├── CLAUDE_CONTEXT.md
│   ├── PROJECT_OVERVIEW.md
│   └── .clinerules
│
└── backend/
    ├── models/                    # Data structures
    ├── solver/                    # OR-Tools logic
    ├── utils/                     # Metrics, validation
    ├── tests/                     # Test suite
    │   ├── scenarios/            # Evaluation cases
    │   ├── test_solver.py
    │   ├── test_api.py
    │   └── test_tools.py
    ├── app.py                     # Flask API
    ├── CLAUDE_CONTEXT.md
    ├── PROJECT_OVERVIEW.md
    └── .clinerules
```

---

## Key Decisions

**Hybrid AI + Solver:**  
LLM for reasoning, OR-Tools for guaranteed correctness

**Tool-calling Pattern:**  
AI agent that takes actions, not just a chatbot

**Metrics-Driven:**  
Every output includes measurable quality indicators

**Modular Architecture:**  
Easy to swap components (Chroma → Pinecone, local → cloud)

---

**Last Updated:** January 2026  
**Current Phase:** 3 - Frontend Tool Orchestration  
**Next Milestone:** Working AI agent with tool-calling