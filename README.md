# 🔥 RagForge

[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-blue?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-brightgreen?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18+-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-vector_store-8B5CF6?style=flat-square)](https://trychroma.com)
[![Groq](https://img.shields.io/badge/Groq-llama--3.1--8b-F97316?style=flat-square)](https://console.groq.com)
[![License](https://img.shields.io/badge/License-MIT-6B7280?style=flat-square)](LICENSE)

**Production-grade RAG pipeline with conversational AI, automated evaluation, and real-time observability.**

Built to demonstrate production RAG infrastructure engineering — not just a chatbot wrapper.

---

## What is RagForge?

RagForge lets you upload private documents (PDF, DOCX, TXT) and have a natural multi-turn conversation about them. Every answer is grounded exclusively in your document and automatically evaluated for faithfulness and relevancy — the system tells you how much to trust each response. A live analytics dashboard tracks latency, token usage, cost, and quality trends over time, giving you full visibility into how the pipeline is performing.

---

## Why This Is Different

| Feature | Basic RAG Demo | RagForge |
|---|---|---|
| Multi-turn conversation | ❌ | ✅ Query reformulation |
| Self-evaluation | ❌ | ✅ 6 metrics per query |
| Hallucination detection | ❌ | ✅ Custom risk scoring |
| Live monitoring | ❌ | ✅ SQLite + dashboard |
| Cost tracking | ❌ | ✅ Per-query USD estimate |
| Source attribution | ❌ | ✅ Chunk-level citations |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    RAGFORGE SYSTEM                       │
│                                                         │
│  PDF/DOCX/TXT → Chunker → Embedder → ChromaDB          │
│                                            ↓            │
│  User Query → Query Reformulator → Retriever            │
│                      ↑                    ↓             │
│             Conversation History    Context Chunks      │
│                                          ↓              │
│                              Groq LLM (Llama 3.1 8B)   │
│                                          ↓              │
│                    ┌─────────────────────┘              │
│                    ↓                                    │
│           Faithfulness Score                            │
│           Answer Relevancy Score      → SQLite Logger   │
│           Context Precision Score         ↓             │
│           Hallucination Risk Score    React Dashboard   │
│           Context Utilization                           │
│           Cost Estimate                                 │
└─────────────────────────────────────────────────────────┘
```

---

## Key Features

### 📄 Smart Document Ingestion
- Supports **PDF, DOCX, TXT** — text extracted natively with PyPDF2 and python-docx
- `RecursiveCharacterTextSplitter`: 500-char chunks with 50-char overlap preserves sentence boundaries
- Embeddings via **sentence-transformers/all-MiniLM-L6-v2** — runs locally, no API cost
- **Upsert logic**: re-uploading the same file replaces old chunks, no duplicates

### 🔍 Semantic Retrieval
- Vector similarity search via **ChromaDB** (persistent on disk, no server process needed)
- Top-5 chunk retrieval with L2-distance → similarity conversion: `1 / (1 + distance)`
- Guards against empty-collection errors before querying

### 💬 Conversational RAG with Query Reformulation
- Maintains **full conversation history** across turns in the chat UI
- Before every retrieval, a dedicated Groq call rewrites vague follow-ups into standalone queries:
  > *"Who funded it?"* → *"Who funded the climate impact study on carbon offsetting?"*
- Reformulated query displayed in the UI: `🔍 Searched for: ...`
- Falls back silently to the original query if reformulation fails — never blocks an answer

### 📊 Automated Evaluation — 6 Metrics Per Query

| Metric | Description | Good Score |
|--------|-------------|------------|
| Faithfulness | % of answer sentences grounded in retrieved context | > 0.75 |
| Answer Relevancy | Keyword overlap between question and answer | > 0.65 |
| Context Precision | % of retrieved chunks that contributed to the answer | > 0.60 |
| Hallucination Risk | % of answer sentences NOT grounded in context | < 0.25 |
| Context Utilization | % of retrieved chunks the LLM actually used | > 0.60 |
| Cost Estimate | USD cost based on Groq token pricing | — |

### 📈 Real-Time Monitoring Dashboard
- Every query logged to **SQLite** with all 6 scores, retrieval latency, generation latency, token counts, and cost
- **Dashboard**: 7-day score trend chart, recent queries table with color-coded badges
- **Analytics page**: score distribution histogram, latency area chart, stacked token bars, cumulative cost line

---

## Tech Stack

### Backend

| Component | Technology | Why |
|-----------|-----------|-----|
| API Server | FastAPI + Uvicorn | Auto-docs, Pydantic validation, fast |
| RAG Framework | LangChain | Industry standard, modular |
| Vector Store | ChromaDB | Embedded, persistent, no infra |
| Embeddings | sentence-transformers/all-MiniLM-L6-v2 | Local, free, fast |
| LLM | Groq (llama-3.1-8b-instant) | ~200 tok/s, generous free tier |
| Evaluation | Custom Python metrics | No broken dependencies, microsecond eval |
| Database | SQLite + SQLAlchemy | Zero infrastructure, ORM |

### Frontend

| Component | Technology | Why |
|-----------|-----------|-----|
| Framework | React + Vite | Fast HMR, component model |
| Styling | Tailwind CSS v4 | Utility-first, dark theme |
| Charts | Recharts | React-native, responsive |
| Icons | Lucide React | Consistent, lightweight |

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Free Groq API key from [console.groq.com](https://console.groq.com)

### 1. Clone

```bash
git clone https://github.com/RachitMittal-20/RagForge.git
cd RagForge
```

### 2. Backend

```bash
cd backend
pip3 install -r requirements.txt
cp .env.example .env
# Edit .env and add your GROQ_API_KEY
python3 -m uvicorn app.main:app --reload
# API running at http://localhost:8000
# Interactive docs at http://localhost:8000/docs
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# Dashboard at http://localhost:5173
```

### 4. Use it

1. Go to **Documents** → Upload a PDF, DOCX, or TXT file
2. Go to **Playground** → Ask a question about your document
3. Ask follow-up questions naturally — RagForge remembers the conversation
4. Go to **Dashboard** → See your query logged with all 6 evaluation scores
5. Go to **Analytics** → Explore trends, latency distribution, and cumulative cost

---

## API Reference

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| `POST` | `/api/ingest` | Upload and ingest a document | `multipart/form-data` |
| `GET` | `/api/documents` | List all ingested documents | — |
| `POST` | `/api/query` | Query the RAG pipeline | `{query, top_k, conversation_history}` |
| `GET` | `/api/metrics/summary` | Aggregated metrics + 7-day trend | — |
| `GET` | `/api/metrics/history` | Full query log | `?limit=50&offset=0` |
| `GET` | `/health` | Health check | — |

---

## Project Structure

```
RagForge/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app factory, CORS, route registration
│   │   ├── config.py                # Pydantic Settings — reads .env
│   │   ├── models/
│   │   │   └── schemas.py           # Request/response Pydantic models
│   │   ├── core/
│   │   │   ├── ingestion.py         # Text extraction, chunking, ChromaDB upsert
│   │   │   ├── retriever.py         # Vector similarity search
│   │   │   ├── generator.py         # Groq LLM call with conversation history
│   │   │   ├── rag_pipeline.py      # Orchestrator: reformulate→retrieve→generate→eval
│   │   │   └── query_reformulator.py# Rewrites follow-up questions into standalone queries
│   │   ├── evaluation/
│   │   │   ├── ragas_eval.py        # Faithfulness, relevancy, context precision
│   │   │   └── custom_metrics.py    # Hallucination risk, context utilization, cost
│   │   ├── monitoring/
│   │   │   ├── database.py          # SQLAlchemy model + engine setup
│   │   │   ├── logger.py            # Writes query results to SQLite
│   │   │   └── tracker.py           # SQL aggregates for dashboard/analytics
│   │   └── routes/
│   │       ├── ingest.py            # POST /api/ingest, GET /api/documents
│   │       ├── query.py             # POST /api/query
│   │       └── metrics.py           # GET /api/metrics/summary, /history
│   ├── .env.example
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.jsx                  # Route tree
│       ├── main.jsx                 # React entry point with BrowserRouter
│       ├── index.css                # Design system: CSS variables, animations, fonts
│       ├── services/
│       │   └── api.js               # Axios client for all backend calls
│       ├── components/
│       │   ├── Layout.jsx           # Sidebar, top bar, page transition
│       │   ├── ScoreCard.jsx        # Metric card with count-up animation
│       │   ├── GlowButton.jsx       # Primary/ghost button with glow effect
│       │   ├── AnimatedBadge.jsx    # Score badge with scale-pop animation
│       │   └── Toast.jsx            # Auto-dismissing toast notifications
│       └── pages/
│           ├── Dashboard.jsx        # Score cards, trend chart, recent queries
│           ├── Playground.jsx       # Conversational chat UI + eval scores
│           ├── Documents.jsx        # Upload zone + corpus table
│           └── Analytics.jsx        # Four charts + paginated query history
├── docs/
│   ├── ARCHITECTURE.md
│   └── DEVELOPER_GUIDE.md           # Deep-dive: every file, 20 interview Q&As
└── README.md
```

---

## Design Decisions

- **Replaced RAGAs with pure-Python evaluation** after discovering a broken `langchain_community.chat_models.vertexai` transitive import in RAGAs 0.2.x. The custom keyword-overlap implementation runs in microseconds, has zero dependencies, and produces directionally equivalent scores for typical RAG outputs.

- **Chose ChromaDB over Pinecone** for zero-infrastructure local development — no account, no network call, persists to disk as a plain directory. Pinecone is the right choice at scale; ChromaDB is the right choice for a portable portfolio project.

- **Query reformulation is a separate, isolated Groq call** with a strict system prompt and `max_tokens=150`. Every failure path — API error, timeout, empty output — returns the original query silently. Reformulation must never block an answer.

- **Evaluation uses `-1.0` as a sentinel** for metrics that could not be computed. SQL aggregates use `WHERE faithfulness > 0` to exclude sentinels, so dashboard averages are never polluted by failed evals.

---

## Known Limitations & Roadmap

| Limitation | Current State | Future Fix |
|------------|--------------|------------|
| Chunking strategy | Fixed 500-char splits | Semantic/paragraph-aware chunking |
| Evaluation depth | Keyword overlap heuristics | NLI-based entailment scoring |
| Response streaming | Full answer rendered at once | FastAPI `StreamingResponse` + SSE |
| Authentication | None — open API | JWT middleware |
| Database concurrency | SQLite (single writer) | PostgreSQL |
| Vector store scale | Single ChromaDB node | Qdrant distributed deployment |

---

## Author

**Rachit Mittal**  
B.Tech CSE · SRMIST NCR Campus · 2027

[GitHub](https://github.com/RachitMittal-20) · [LinkedIn](https://linkedin.com/in/rachit-mittal-354767298)

---

> Built as a portfolio project demonstrating production-grade RAG infrastructure engineering.
