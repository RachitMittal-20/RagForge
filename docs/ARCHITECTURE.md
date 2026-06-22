# RagForge — Architecture

## Overview

RagForge is a retrieval-augmented generation (RAG) system built for observability. Every query is automatically evaluated, logged, and surfaced through a React monitoring dashboard. The codebase is structured so each layer — ingestion, retrieval, generation, evaluation, persistence — is independently testable and replaceable.

---

## Directory Structure

```
RagForge/
├── backend/
│   └── app/
│       ├── core/           # RAG pipeline stages
│       │   ├── ingestion.py
│       │   ├── retriever.py
│       │   ├── generator.py
│       │   └── rag_pipeline.py
│       ├── evaluation/     # Metric computation
│       │   ├── ragas_eval.py
│       │   └── custom_metrics.py
│       ├── monitoring/     # SQLite persistence
│       │   ├── database.py
│       │   ├── logger.py
│       │   └── tracker.py
│       ├── routes/         # FastAPI routers
│       │   ├── ingest.py
│       │   ├── query.py
│       │   └── metrics.py
│       ├── models/
│       │   └── schemas.py  # Pydantic request/response models
│       ├── config.py       # Pydantic Settings (env var loading)
│       └── main.py         # App factory, CORS, router registration
└── frontend/
    └── src/
        ├── components/     # Layout, ScoreCard, Toast
        ├── pages/          # Dashboard, Playground, Documents, Analytics
        └── services/
            └── api.js      # Axios client for all backend calls
```

---

## Data Flow: Upload to Evaluation Score

### 1. Document Ingestion (`POST /api/ingest`)

```
UploadFile (FastAPI)
  → write to tempfile
  → _extract_text()          # PyPDF2 / python-docx / UTF-8 read
  → RecursiveCharacterTextSplitter(chunk_size=500, overlap=50)
  → HuggingFaceEmbeddings.embed_documents(chunks)
  → ChromaDB.upsert(ids, embeddings, documents, metadatas)
  → return { filename, total_chunks, status }
```

Chunks are keyed as `{filename}__chunk_{i}` so re-ingesting the same file is idempotent — old chunks are replaced via upsert, not duplicated.

### 2. Query (`POST /api/query`)

```
QueryRequest { query, top_k }
  │
  ├─ [Retrieve]
  │    embed_query(query)
  │    → ChromaDB.query(query_embedding, n_results=top_k)
  │    → convert L2 distance → similarity score: 1 / (1 + dist)
  │    → list[{ content, filename, similarity_score }]
  │
  ├─ [Generate]
  │    build prompt: SystemMessage + HumanMessage(context + question)
  │    → ChatGroq(llama-3.1-8b-instant).invoke(messages)
  │    → { answer, input_tokens, output_tokens, generation_latency_ms }
  │
  ├─ [Evaluate — RAGAs]
  │    evaluate_response(query, answer, contexts)
  │    → RAGAs dataset with single row
  │    → faithfulness, answer_relevancy, context_precision
  │    → sentinel -1.0 on failure (eval never breaks the response)
  │
  ├─ [Evaluate — Custom]
  │    calculate_custom_metrics(query, answer, contexts, gen_result)
  │    → hallucination_risk  (word-overlap heuristic)
  │    → context_utilization (how many chunks contributed)
  │    → cost_estimate_usd   (Groq token pricing)
  │
  └─ [Log]
       log_query(session, result)  ← non-blocking; failure is warned, not raised
       → INSERT INTO query_logs (...)
       → return QueryResponse
```

### 3. Dashboard Refresh (`GET /api/metrics/summary` + `/history`)

```
GET /api/metrics/summary
  → get_metrics_summary(session)
  → aggregate AVGs (filtering faithfulness > 0 to exclude sentinels)
  → build score_trend: 7 calendar-day buckets, last day first
  → return { total_queries, avg_faithfulness, score_trend, ... }

GET /api/metrics/history?limit=N
  → ORDER BY created_at DESC LIMIT N
  → deserialize sources JSON blob
  → return list[QueryLog as dict]
```

---

## Component Deep-Dives

### Ingestion (`app/core/ingestion.py`)

- **Singletons at module load**: `HuggingFaceEmbeddings`, `chromadb.PersistentClient`, and the `documents` collection are created once. This avoids loading the 80 MB embedding model on every request.
- **Splitter**: `RecursiveCharacterTextSplitter` with `chunk_size=500, chunk_overlap=50`. The overlap ensures sentences spanning a boundary still appear in at least one chunk.
- **Upsert**: Using ChromaDB's `upsert` instead of `add` means the same document can be re-uploaded without creating duplicate chunks.

### Retriever (`app/core/retriever.py`)

- Shares the module-level `_collection` and `_embeddings` singletons from `ingestion.py` to avoid double-loading.
- ChromaDB returns **L2 (Euclidean) distances**, not cosine similarities. The conversion `1 / (1 + dist)` maps `[0, ∞)` to `(0, 1]` monotonically — closer vectors score higher.
- Guards against empty collections (`_collection.count() == 0`) to avoid a ChromaDB error when no documents have been ingested yet.

### Generator (`app/core/generator.py`)

- Uses `langchain-groq`'s `ChatGroq` with the `llama-3.1-8b-instant` model — the fastest publicly available LLM at time of writing (~200 tok/s on Groq's LPU hardware).
- The system prompt explicitly instructs the model to answer **only from context** and to acknowledge gaps rather than fabricate. This is the first defense against hallucination; the `hallucination_risk` metric is the measurable second.
- Token usage is pulled from `response.usage_metadata` and forwarded to custom metrics for cost estimation.

### Evaluation (`app/evaluation/`)

**RAGAs** (`ragas_eval.py`):
- Wraps the three RAGAs metrics in a try/except that returns `{faithfulness: -1.0, ...}` on failure. RAGAs can fail if the LLM judge call times out or returns an unparseable response; this sentinel design ensures the user always gets their answer even when eval fails.
- `-1.0` is used as a sentinel (not `None`) so it survives JSON serialization and is easy to filter in SQL (`WHERE faithfulness > 0`).

**Custom** (`custom_metrics.py`):
- `hallucination_risk`: word-overlap heuristic — fraction of answer n-grams not found in any retrieved chunk.
- `context_utilization`: how many of the retrieved chunks had at least one sentence reflected in the answer.
- `cost_estimate_usd`: `(input_tokens * input_rate + output_tokens * output_rate)` using Groq's published per-million-token pricing.

### Monitoring (`app/monitoring/`)

- **`database.py`**: Defines the `QueryLog` SQLAlchemy model and creates the table on first import via `Base.metadata.create_all`.
- **`logger.py`**: `log_query()` serializes sources to a JSON string (SQLite has no array type) and calls `session.commit()`. Called inside a try/finally in the query route so a DB error never reaches the client.
- **`tracker.py`**: Aggregation queries for the dashboard. The 7-day trend loop builds one row per calendar day so days with no queries show as `null` rather than being skipped, which keeps the chart x-axis continuous.

---

## Design Decisions

### Why ChromaDB?

ChromaDB is embedded (no separate server process), persists to disk, and has a first-class Python API. For a single-node portfolio project it avoids the operational overhead of Pinecone (requires an account and network call) or Weaviate (Docker dependency). The `PersistentClient` means the vector store survives process restarts.

### Why Groq?

Groq's LPU hardware delivers ~200 tokens/second on `llama-3.1-8b-instant` — roughly 10× faster than equivalent models on GPU inference APIs. This matters for RAG because latency is the sum of retrieval + generation + evaluation; minimizing generation latency keeps the total under 5 seconds. Groq also has a generous free tier, making the project zero-cost to run.

### Why RAGAs?

RAGAs is the de-facto standard for reference-free RAG evaluation. Its three core metrics cover the main failure modes:
- **Faithfulness** catches hallucination (answer contradicts context).
- **Answer Relevancy** catches vagueness (answer doesn't address the question).
- **Context Precision** catches retrieval noise (chunks retrieved that weren't useful).

The library uses an LLM judge internally (OpenAI by default; configurable), which makes it expensive to run at scale but accurate for a portfolio use case.

### Why SQLite?

Zero infrastructure. The monitoring database is a single file (`ragforge.db`) that lives next to the application. For a project where the bottleneck is LLM latency (seconds), the sub-millisecond SQLite write overhead is irrelevant. Migrating to PostgreSQL later requires only changing `DATABASE_URL`.

---

## Known Limitations

| Limitation | Impact | Mitigation Path |
|------------|--------|-----------------|
| RAGAs uses an LLM judge (costs tokens) | Eval adds ~2–5 s and ~$0.001 per query | Use a local judge model (e.g. Ollama) or batch eval offline |
| ChromaDB is single-process | Can't scale horizontally | Replace with Qdrant or Weaviate with a server mode |
| Embedding model loaded at startup | ~3 s cold start | Pre-warm in a container init hook |
| SQLite has no concurrent writes | Fine for solo use; breaks under load | Swap `DATABASE_URL` to PostgreSQL |
| `hallucination_risk` is a word-overlap heuristic | Misses paraphrase-style hallucinations | Replace with NLI-based entailment scoring |
| No authentication | API is open | Add FastAPI `Depends` guards + API key header |
| No chunking strategy tuning | 500-char chunks may split mid-sentence | Add sentence-aware splitter or semantic chunking |

## Future Improvements

- **Streaming responses**: FastAPI `StreamingResponse` + React `EventSource` for progressive answer rendering
- **Re-ranking**: Add a cross-encoder re-ranker between retrieval and generation to improve context precision
- **Hybrid search**: Combine dense (embedding) and sparse (BM25) retrieval for better recall on keyword-heavy queries
- **Conversation memory**: Maintain per-session chat history so follow-up questions work correctly
- **Document versioning**: Track document versions and expire old chunks when a file is re-uploaded with changes
- **Evaluation caching**: Skip RAGAs eval for duplicate or near-duplicate queries to reduce cost
