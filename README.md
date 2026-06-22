# 🔥 RagForge

> Production-grade RAG pipeline with built-in evaluation, monitoring, and observability.

## Features

- 📄 Document ingestion (PDF, DOCX, TXT) with automatic chunking and vector embeddings
- 🔍 Semantic retrieval using ChromaDB and sentence-transformers
- 🤖 LLM generation via Groq (llama-3.1-8b-instant) — ultra-fast inference
- 📊 Automated evaluation with RAGAs metrics: Faithfulness, Answer Relevancy, Context Precision
- 🧠 Custom metrics: Hallucination Risk, Context Utilization, Cost Estimation
- 📈 Real-time monitoring dashboard with query history, latency tracking, and score trends
- 💰 Per-query cost tracking and cumulative spend analytics

## Architecture

```
Document Upload → Chunking → Embeddings → ChromaDB

                                ↓

User Query → Retriever → Context → LLM (Groq) → Answer

                                ↓

              RAGAs Eval + Custom Metrics

                                ↓

              SQLite Logger → React Dashboard
```

## Tech Stack

### Backend

| Component  | Technology                                   |
|------------|----------------------------------------------|
| API Server | FastAPI + Uvicorn                            |
| RAG Framework | LangChain                                 |
| Vector Store | ChromaDB                                   |
| Embeddings | sentence-transformers/all-MiniLM-L6-v2       |
| LLM        | Groq API (llama-3.1-8b-instant)              |
| Evaluation | RAGAs + Custom Metrics                       |
| Database   | SQLite + SQLAlchemy                          |

### Frontend

| Component  | Technology       |
|------------|------------------|
| Framework  | React + Vite     |
| Styling    | Tailwind CSS     |
| Charts     | Recharts         |
| Icons      | Lucide React     |

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- Groq API key (free at [console.groq.com](https://console.groq.com))

### Backend Setup

```bash
cd backend
pip3 install -r requirements.txt
cp .env.example .env
# Add your GROQ_API_KEY to .env
python3 -m uvicorn app.main:app --reload
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173) for the dashboard and [http://localhost:8000/docs](http://localhost:8000/docs) for the interactive API docs.

## Evaluation Metrics

| Metric | Description |
|--------|-------------|
| Faithfulness | Does the answer stick to retrieved context? (0–1) |
| Answer Relevancy | Does the answer address the question? (0–1) |
| Context Precision | Are retrieved chunks actually useful? (0–1) |
| Hallucination Risk | Fraction of answer claims not grounded in context (0–1, lower is better) |
| Context Utilization | Fraction of retrieved chunks that contributed to the answer (0–1) |

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ingest` | Upload and ingest a document |
| GET | `/api/documents` | List all ingested documents |
| POST | `/api/query` | Query the RAG pipeline |
| GET | `/api/metrics/summary` | Get aggregated metrics |
| GET | `/api/metrics/history` | Get full query history |
| GET | `/health` | Health check |

## Author

**Rachit Mittal** — [GitHub](https://github.com/RachitMittal-20) | [LinkedIn](https://linkedin.com/in/rachit-mittal-20)

---

Built as a portfolio project demonstrating production-grade RAG infrastructure engineering.
