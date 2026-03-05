# ⚡ Sentinel AI
### Wealthsimple Infrastructure Reliability Copilot

> **Rebuilding incident response from scratch as an AI-native system.**
> When financial infrastructure breaks, Sentinel AI diagnoses root cause, calculates regulatory exposure, and drafts FINTRAC/OSC notifications — in 90 seconds instead of 2 hours.

![Status](https://img.shields.io/badge/status-production--demo-brightgreen)
![Stack](https://img.shields.io/badge/stack-FastAPI%20%2B%20React%20%2B%20Claude-6c63ff)
![Regulatory](https://img.shields.io/badge/compliance-FINTRAC%20%7C%20OSC-00c896)
![Built in](https://img.shields.io/badge/built%20in-24%20hours-f59e0b)

---

## The Problem

Every time a fintech's payment infrastructure has an incident, a compliance team manually:

1. Diagnoses which service failed and why
2. Calculates how many transactions and dollars were affected
3. Checks whether Canadian regulators (FINTRAC, OSC) need to be notified
4. Writes an internal post-mortem
5. Drafts a formal regulatory notification

**That process takes 2+ hours per incident.** Getting it wrong means regulatory fines.

Sentinel AI does all of that in **90 seconds.**

---

## Demo

### System States

| Normal State | Incident Active | Maintenance Window |
|---|---|---|
| All 6 services green | Cards turn red, cascade traced | Metrics suppressed, no false alert |

### The Full Flow

```
Trigger Incident → Anomaly Detection → Root Cause Analysis
→ Blast Radius Calculation → Regulatory Check → AI Document Generation
→ Human Approval Gate → (nothing leaves without sign-off)
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      SENTINEL AI PIPELINE                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Real-time Metrics (6 services)                             │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────────┐                                        │
│  │ Anomaly Detector │ ← compares vs baselines               │
│  └────────┬────────┘                                        │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────┐                                        │
│  │ Root Cause Tracer│ ← walks dependency graph backwards    │
│  └────────┬────────┘   produces confidence score + chain    │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────┐                                        │
│  │ Scope Calculator │ ← transactions, CAD exposure, accounts│
│  └────────┬────────┘   deterministic, not AI-estimated      │
│           │                                                  │
│           ▼                                                  │
│  ┌──────────────────────┐                                   │
│  │ Regulatory Checker    │ ← FINTRAC + OSC threshold check  │
│  └────────┬─────────────┘   maintenance window detection    │
│           │                                                  │
│           ▼                                                  │
│  ┌──────────────────────┐                                   │
│  │ Claude API (Sonnet)   │ ← grounded generation            │
│  └────────┬─────────────┘   facts in → language out         │
│           │                                                  │
│           ▼                                                  │
│  ┌──────────────────────┐                                   │
│  │  Human Approval Gate  │ ← HARD STOP. Nothing submits    │
│  └──────────────────────┘   without explicit sign-off       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Principle

**Deterministic layers handle facts. Claude handles language. Humans handle legal decisions.**

| Layer | Type | Why |
|---|---|---|
| Anomaly detection | Deterministic | Auditable, explainable |
| Root cause tracing | Deterministic | No black box in regulated systems |
| Scope calculation | Deterministic | Verified numbers for regulators |
| Regulatory checking | Deterministic | Rules must be exact, not probabilistic |
| Document generation | Generative (Claude) | Language is what AI does best |
| Approval gate | Human | Legal requirement, not UX choice |

---

## Three Scenarios

### Scenario 1 — Payment Gateway Cascade (P1)
Banking API fails → cascades to Settlement Service → Payment Gateway → Notification Service

- **Root cause:** Banking API (90% confidence)
- **Impact:** 1,246 transactions, $2.3M CAD, 415 accounts, 14 minutes
- **Regulatory:** FINTRAC + OSC mandatory reporting triggered
- **Output:** Full post-mortem + formal regulatory notification drafted

### Scenario 2 — Minor Settlement Delay
Single service degradation, short duration

- **Impact:** 36 transactions, $33K CAD, 3 minutes
- **Regulatory:** Below all thresholds — no reporting required
- **Why it matters:** System knows when NOT to act

### Scenario 3 — Scheduled Maintenance False Positive
Metrics spike to 89% error rate — but it's planned maintenance

- **Regulatory:** Suppressed — maintenance window detected
- **Why it matters:** Context over thresholds. Prevents 3am false alarms

---

## The Human Boundary

The most important design decision in the system:

```
POST-MORTEM requires human approval
         ↓
REGULATORY NOTIFICATION locked until post-mortem approved
         ↓
Nothing submitted to FINTRAC/OSC without compliance officer sign-off
```

This isn't optional UX — it's legally required under Canadian financial regulation. The AI enforces its own boundary.

---

## Tech Stack

| Component | Technology |
|---|---|
| Backend | FastAPI + Python |
| AI Layer | Claude Sonnet (Anthropic API) |
| Frontend | React + Vite + Tailwind CSS |
| Mock Data | Realistic Wealthsimple microservice topology |
| Deployment | Local / GCP Cloud Run ready |

---

## Project Structure

```
sentinel-ai/
├── backend/
│   ├── app/
│   │   ├── data/
│   │   │   ├── services.json        # 6 microservice definitions + baselines
│   │   │   └── incidents.json       # 3 incident scenarios
│   │   ├── services/
│   │   │   ├── anomaly_detector.py  # threshold-based detection
│   │   │   ├── root_cause_tracer.py # dependency graph analysis
│   │   │   ├── scope_calculator.py  # business impact math
│   │   │   ├── regulatory_checker.py# FINTRAC + OSC rules
│   │   │   └── ai_generator.py      # Claude API integration
│   │   ├── api/
│   │   │   └── routes.py            # FastAPI endpoints
│   │   └── main.py
│   └── requirements.txt
└── frontend/
    └── src/
        └── App.jsx                  # Full React dashboard
```

---

## Setup & Run

### Prerequisites
- Python 3.10+
- Node.js 18+
- Anthropic API key ([get one here](https://console.anthropic.com))

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set your API key
echo "ANTHROPIC_API_KEY=your_key_here" > .env

# Start the server
uvicorn app.main:app --reload
# → http://localhost:8000
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
# → http://localhost:5173
```

### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/status` | Current system metrics |
| POST | `/api/trigger-incident` | Inject an incident scenario |
| GET | `/api/investigate` | Run full analysis pipeline |
| POST | `/api/generate-documents` | Generate AI documents |
| POST | `/api/reset` | Clear incident state |
| GET | `/health` | Health check |

### Trigger a scenario

```bash
# Payment Gateway Cascade (P1 - regulatory reporting required)
curl -X POST http://localhost:8000/api/trigger-incident \
  -H "Content-Type: application/json" \
  -d '{"scenario_id": "scenario-1"}'

# Minor Settlement Delay (below reporting thresholds)
curl -X POST http://localhost:8000/api/trigger-incident \
  -H "Content-Type: application/json" \
  -d '{"scenario_id": "scenario-2"}'

# Scheduled Maintenance False Positive (suppressed)
curl -X POST http://localhost:8000/api/trigger-incident \
  -H "Content-Type: application/json" \
  -d '{"scenario_id": "scenario-3"}'
```

---

## Cost Analysis

| Volume | Monthly AI Cost |
|---|---|
| 10 incidents/month | ~$0.20 |
| 100 incidents/month | ~$2.00 |
| 1,000 incidents/month | ~$20.00 |

Each incident costs approximately **$0.02 in AI compute** — replacing 2 hours of skilled compliance work.

**ROI at 100 incidents/year:**
- Manual cost: ~$12,000 (compliance analyst time)
- Sentinel AI cost: ~$2.40
- ROI: **5,000x**

---

## Regulatory Coverage

| Regulator | Rule | Threshold | Window |
|---|---|---|---|
| FINTRAC | Operational incident affecting transaction monitoring | 500+ txns OR $500K+ OR 60+ min | 72 hours |
| OSC | Material system failure affecting client accounts | 1,000+ txns OR $1M+ OR 30+ min | 24 hours |

---

## What Would Break at Scale

1. **Regulatory coverage gaps** — static thresholds don't cover provincial variations, IIROC, or evolving guidance. Fix: dynamic rules layer ingesting regulatory updates automatically.

2. **Prompt reliability** — Claude's structured JSON output needs validation and fallback handling under high incident volume.

3. **Historical context** — V2 would add a vector store of past incidents so the investigation view surfaces similar historical events automatically.

---

## Built By

**Kunal Dubey** — Senior AI Cloud Engineer  
Toronto, Ontario, Canada  
[LinkedIn](https://linkedin.com/in/kunal-dubey) · [GitHub](https://github.com/dubes394)

Built in under 24 hours as a submission for Wealthsimple's AI Builder role.

---

## License

MIT — use it, extend it, build on it.
