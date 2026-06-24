# RagForge — Developer Guide

> Read this in 30 minutes. Walk into any interview about this project with full confidence.

---

## 1. PROJECT OVERVIEW

### What is RagForge in simple terms?

Imagine you have a 200-page technical report and you want to ask it questions. You can't paste all 200 pages into ChatGPT — it won't fit. And even if it did, ChatGPT doesn't know your specific document; it just knows what it was trained on.

RagForge solves this. You upload your document, and RagForge:
1. Breaks it into small searchable pieces
2. Stores those pieces in a vector database
3. When you ask a question, finds the most relevant pieces
4. Feeds only those relevant pieces to an LLM (Groq's Llama model)
5. The LLM answers using only what's in your document — not hallucinated facts
6. Measures how good the answer actually was using three evaluation metrics
7. Logs everything to a SQLite database and shows you live analytics

You can also ask follow-up questions naturally ("What did the second chapter say about that?") and RagForge understands the context of your previous messages.

### What problem does it solve?

The fundamental problem is **LLMs don't know your private data**. They know the internet up to their training cutoff. They don't know your company's internal documents, your research papers, your codebase.

RAG (Retrieval Augmented Generation) is the standard industry solution. RagForge is a complete, production-grade implementation of RAG with everything a real system needs: evaluation, monitoring, conversation history, and an analytics dashboard.

### Why is it different from a basic chatbot?

A basic ChatGPT wrapper just sends your message and gets a reply. It has no idea if the answer is accurate. It can hallucinate completely.

RagForge adds four critical layers on top:
- **Grounding** — answers are backed by retrieved document chunks
- **Evaluation** — every answer gets scored for faithfulness, relevancy, and precision
- **Monitoring** — every query is logged with latency, token usage, and cost
- **Conversation memory** — follow-up questions are rewritten to be self-contained before retrieval

### The "wow factor"

Three things make this impressive to show:

1. **Self-evaluating RAG** — the system grades its own answers automatically after every query. Most RAG demos don't do this.

2. **Query reformulation** — if you ask "What did they conclude about that?" after a long conversation, RagForge rewrites it to "What did the authors conclude about the climate impact of carbon offsetting?" before searching. This is what makes it actually useful for conversations.

3. **Live analytics dashboard** — you can watch faithfulness scores, latency distributions, and cumulative cost update in real time as you use it. It looks and feels like a funded product.

---

## 2. HOW IT WORKS — THE FULL FLOW

### When a user uploads a document

```
User selects a PDF/DOCX/TXT file in the browser
  ↓
React calls POST /api/ingest with multipart form data
  ↓
backend/app/routes/ingest.py receives the file, saves it to a tempfile
  ↓
backend/app/core/ingestion.py:
  1. Extracts raw text (PyPDF2 for PDFs, python-docx for DOCX, plain read for TXT)
  2. Splits into 500-character chunks with 50-character overlap (RecursiveCharacterTextSplitter)
  3. Generates an embedding vector for each chunk (sentence-transformers/all-MiniLM-L6-v2)
  4. Upserts chunks into ChromaDB with IDs like "report.pdf__chunk_0", "report.pdf__chunk_1"
  ↓
Returns { filename, total_chunks, status: "success" }
  ↓
Browser shows a toast notification and refreshes the documents table
```

The key thing about step 4: **upsert** means if you upload the same file again, it replaces the old chunks instead of duplicating them.

### When a user asks a question (first message)

```
User types "What are the main conclusions?" and hits Enter
  ↓
React (Playground.jsx) adds the user message to the chat immediately (optimistic UI)
  ↓
api.js calls POST /api/query with { query, top_k: 5, conversation_history: [] }
  ↓
backend/app/routes/query.py receives the request
  ↓
backend/app/core/rag_pipeline.py: run_query() orchestrates everything:

  Step 1 — Reformulate (no-op here since history is empty):
    query_reformulator.py returns the query unchanged

  Step 2 — Retrieve:
    retriever.py embeds the query into a vector
    Queries ChromaDB for the 5 most similar chunks
    Converts L2 distances to similarity scores: 1 / (1 + distance)
    Returns list of { content, filename, similarity_score }

  Step 3 — Generate:
    generator.py builds a message list:
      SystemMessage: "Answer ONLY from the context..."
      HumanMessage: "Context: [chunks]\n\nQuestion: [query]"
    Calls ChatGroq (llama-3.1-8b-instant)
    Records latency with time.perf_counter()
    Returns { answer, input_tokens, output_tokens, generation_latency_ms }

  Step 4 — Evaluate:
    ragas_eval.py computes faithfulness, answer_relevancy, context_precision
    custom_metrics.py computes hallucination_risk, context_utilization, cost_estimate_usd

  Step 5 — Log:
    monitoring/logger.py writes a row to SQLite query_logs table
    (this is non-blocking: a DB failure never fails the query response)

  ↓
Returns QueryResponse with answer, sources, metrics, eval_scores, reformulated_query
  ↓
React adds the assistant message bubble to the chat
Right panel updates with the new evaluation scores and metrics
```

### When a user asks a follow-up question

```
User types "Who funded that research?" (referring to something from Turn 1)
  ↓
React builds conversation_history from all previous messages:
  [{ role: "user", content: "What are the main conclusions?" },
   { role: "assistant", content: "The study concludes that..." }]
  ↓
POST /api/query with { query: "Who funded that research?", conversation_history: [...] }
  ↓
run_query() — now the important part:

  Step 1 — Reformulate:
    query_reformulator.py calls Groq with the conversation history
    System prompt: "Rewrite the follow-up as a standalone question"
    Input: "Who funded that research?"
    Output: "Who funded the climate offsetting research described in the study?"
    This reformulated query is what hits ChromaDB

  Step 2 — Retrieve:
    ChromaDB gets the REFORMULATED query, not the vague original
    Returns relevant chunks about funding sources

  Step 3 — Generate:
    generator.py replays conversation history as real LangChain messages:
      SystemMessage: "Answer ONLY from context and history..."
      HumanMessage: "What are the main conclusions?"  ← Turn 1
      AIMessage: "The study concludes that..."         ← Turn 1 reply
      HumanMessage: "Context: [...]\n\nQuestion: Who funded that research?"
    LLM sees the full thread and can answer naturally

  Steps 4 & 5 same as above
  ↓
Response includes reformulated_query so the frontend can show:
  "🔍 Searched for: Who funded the climate offsetting research described in the study?"
```

---

## 3. EVERY FILE EXPLAINED

### Backend

**`backend/app/main.py`**
The entry point. Creates the FastAPI app, adds CORS middleware (so the React dev server on port 5173 can talk to the Python server on port 8000), registers the three route groups, and runs `init_db()` on startup to create the SQLite table if it doesn't exist. The `if __name__ == "__main__"` block at the bottom lets you run it with `python -m app.main` using `loop="asyncio"` — which disables uvloop and avoids event-loop conflicts with any internal async code.

**`backend/app/config.py`**
Reads environment variables from `.env` using Pydantic's `BaseSettings`. Three variables: `GROQ_API_KEY` (required, no default), `CHROMA_PERSIST_DIR` (defaults to `./chroma_db`), and `DATABASE_URL` (defaults to `sqlite:///./ragforge.db`). The `settings` object is imported by every module that needs config — it's the single source of truth.

**`backend/app/models/schemas.py`**
Defines all the Pydantic models used for API request/response validation. Key models:
- `ConversationMessage` — `{role: str, content: str}` — one chat turn
- `QueryRequest` — the POST body for `/api/query`, includes `conversation_history: list[ConversationMessage] = []`
- `QueryResponse` — the full response including `reformulated_query: str`
- `EvalScores` — all six metric scores plus an optional `error` field

**`backend/app/core/ingestion.py`**
Handles document processing. Three module-level singletons are created once at startup (not per-request): the HuggingFace embedding model (`all-MiniLM-L6-v2`), the ChromaDB client, and the `documents` collection. `process_document()` extracts text, splits it, embeds it, and upserts to ChromaDB. `get_all_documents()` queries ChromaDB metadata and collapses per-chunk records into one entry per filename using a `seen` dict.

**`backend/app/core/retriever.py`**
Takes a query string, embeds it with the same model used during ingestion (imported directly from `ingestion.py` to avoid loading the model twice), queries ChromaDB for the top-k most similar chunks, and converts L2 distances to similarity scores with `1 / (1 + distance)`. Guards against querying an empty collection (ChromaDB raises an error if you query 0 documents).

**`backend/app/core/generator.py`**
Wraps the Groq LLM call. The `_llm` singleton is a `ChatGroq` instance. `generate_answer()` builds a message list: system prompt, then the conversation history replayed as alternating `HumanMessage`/`AIMessage` entries, then the current question with retrieved context injected. Uses `time.perf_counter()` (not `time.time()`) for sub-millisecond accurate latency measurement. Returns the answer text plus token counts.

**`backend/app/core/rag_pipeline.py`**
The orchestrator. `run_query()` calls the four stages in sequence: reformulate → retrieve → generate → evaluate. It's the only place that knows about all four stages. This separation of concerns means you could swap out the retriever or evaluator without touching anything else.

**`backend/app/core/query_reformulator.py`**
A dedicated Groq call just for query rewriting. Uses `max_tokens=150` because reformulated questions are short. The system prompt explicitly says "Return ONLY the reformulated question, nothing else. Do not explain, do not add quotes." The output is stripped of quotes before returning. If anything fails (API error, timeout), it silently returns the original query — reformulation failure must never block an answer.

**`backend/app/evaluation/ragas_eval.py`**
Pure-Python evaluation with no external dependencies. Implements three metrics using keyword overlap (see Section 8 for the exact formulas). Originally used the RAGAs library but it had a broken dependency on a removed LangChain module, so it was replaced with this custom implementation. The `evaluate_response()` function is wrapped in try/except and always returns a valid dict — it cannot crash the server.

**`backend/app/evaluation/custom_metrics.py`**
Three additional metrics that complement the main evaluation. `_keywords()` strips stopwords and short tokens to get meaningful content words. `hallucination_risk` checks how many answer sentences are grounded in at least 3 overlapping keywords from any context chunk. `context_utilization` measures what fraction of retrieved chunks actually contributed keywords to the answer. `cost_estimate_usd` uses Groq's published per-million-token pricing.

**`backend/app/monitoring/database.py`**
Defines the SQLAlchemy `QueryLog` model (maps to the `query_logs` table) and sets up the engine/session factory. The `check_same_thread=False` argument is required for SQLite with FastAPI because requests can come from different threads. `init_db()` calls `create_all()` which is a no-op if the table already exists.

**`backend/app/monitoring/logger.py`**
`log_query()` takes the full result dict from `run_query()`, unpacks all the fields, serializes `sources` to a JSON string (SQLite has no array type), creates a `QueryLog` instance, and commits it. Called inside a try/finally in the route handler so a DB error never propagates to the client.

**`backend/app/monitoring/tracker.py`**
Two functions. `get_metrics_summary()` runs SQL aggregates (AVG, SUM, COUNT) and builds the 7-day score trend by querying one row per calendar day using a date-range loop — this ensures days with no queries appear as `null` rather than being skipped. `get_query_history()` returns the N most recent rows in descending order with sources deserialized from JSON. The AVG queries filter `col > 0` to exclude `-1.0` sentinels from failed evaluations.

**`backend/app/routes/ingest.py`**
Two endpoints: `POST /api/ingest` saves the uploaded file to a tempfile, calls `process_document()`, deletes the tempfile in a finally block, and returns the ingestion result. `GET /api/documents` calls `get_all_documents()` from ingestion and returns the list.

**`backend/app/routes/query.py`**
Single endpoint: `POST /api/query`. Converts the Pydantic `ConversationMessage` objects to plain dicts with `.model_dump()` before passing to `run_query()` (which expects plain dicts). Logs the result non-blockingly after sending the response.

**`backend/app/routes/metrics.py`**
Two endpoints: `GET /api/metrics/summary` and `GET /api/metrics/history`. Both open a SQLAlchemy session, call the appropriate tracker function, close the session in a finally block, and return the result.

---

### Frontend

**`frontend/src/main.jsx`**
The React entry point. Wraps `<App />` in `<BrowserRouter>` (so all pages can use React Router) and `<StrictMode>` (catches side effects in development). Renders into `#root` in `index.html`.

**`frontend/src/App.jsx`**
Defines the route tree. `<Layout>` wraps all four routes. Uses React Router's nested routes so `<Layout>` renders once with an `<Outlet>` where the active page renders. This means the sidebar and top bar are mounted once — they don't re-render on navigation.

**`frontend/src/services/api.js`**
A thin Axios wrapper. Creates one instance with `baseURL: http://localhost:8000`. Exports five functions: `uploadDocument` (multipart form POST to `/api/ingest`), `queryRAG` (accepts `conversationHistory` array for the chat feature), `getMetricsSummary`, `getQueryHistory`, and `getDocuments`. All other files import from here — there's one place to change the base URL.

**`frontend/src/components/Layout.jsx`**
The persistent shell. Uses `useLocation()` to detect the current route and map it to a page title for the top bar. The `key={pathname}` on the `<Outlet>` wrapper div re-mounts the animation every time the route changes, creating the `fadeSlideIn` page transition effect. The pulsing violet dot next to "RagForge" uses the CSS `ping` animation with two overlapping spans — one pings outward while the other stays solid.

**`frontend/src/components/ScoreCard.jsx`**
The four metric cards on the Dashboard. The count-up animation uses `requestAnimationFrame` to step from 0 to the target value over 800ms with a cubic ease-out curve. It parses the value string to extract the numeric part, prefix, and suffix separately ("$", "0.0042", "") so it can animate just the number while keeping the currency symbol static. Each card has a stagger delay prop (0ms, 80ms, 160ms, 240ms) for the entrance animation.

**`frontend/src/components/GlowButton.jsx`**
Two variants. Primary is a violet gradient button that adds a `box-shadow` glow on mouse enter/leave (via inline style manipulation — not CSS classes — because the glow color needs to be dynamic). Ghost is transparent with a subtle border that brightens on hover. Both have `active:scale-[0.97]` for a click-feel effect.

**`frontend/src/components/AnimatedBadge.jsx`**
The colored score pill used in tables. Plays the `scalePop` CSS animation (scale 0 → 1.1 → 1) on first mount using a `useEffect` with `setTimeout`. The color thresholds are: ≥0.7 green, ≥0.4 yellow, <0.4 red, null/negative = gray. Uses JetBrains Mono for the number.

**`frontend/src/components/Toast.jsx`**
Exports both a `useToast()` hook and a `<Toast>` renderer. The hook maintains a `toasts` array and provides `toast(message, type)` and `dismiss(id)`. Toasts auto-dismiss after 3 seconds using `setTimeout`. The renderer renders all current toasts in a fixed bottom-right stack.

**`frontend/src/pages/Dashboard.jsx`**
Fetches `getMetricsSummary()` and `getQueryHistory(10)` in parallel with `Promise.all()` on mount. Uses `useCallback` for the fetch function so the Refresh button can call it without creating a new function reference each render. The score trend chart is an `AreaChart` (not `LineChart`) because Area charts support gradient fills under the lines using `<defs>/<linearGradient>` SVG elements inside the chart. If the trend data has no non-null values, it shows a placeholder message instead of an empty chart.

**`frontend/src/pages/Playground.jsx`**
The main feature page. Manages a `messages[]` array where each entry has `{role, content, sources, eval_scores, metrics, reformulated_query}`. On submit, the user message is added immediately (optimistic), the API is called with the full conversation history (text only, no metadata), and the assistant response is added when it arrives. If the API call fails, the optimistic user message is removed. The textarea auto-expands up to 140px using `scrollHeight`. The right panel always shows metrics from the last assistant message (`[...messages].reverse().find(m => m.role === 'assistant')`).

**`frontend/src/pages/Documents.jsx`**
Upload zone with drag-and-drop. The zone's border color and background change based on `dragOver` state (violet dashed border, violet glow) and `selectedFile` state (green, checkmark icon). Uses `useToast()` instead of an inline status div so success/error messages appear as floating toasts. After a successful upload, calls `fetchDocs()` immediately to refresh the documents table.

**`frontend/src/pages/Analytics.jsx`**
Fetches 100 query history entries. Builds four derived datasets: score distribution (bucketed by faithfulness range), latency per query (retrieval + generation), token usage per query (stacked input/output), cumulative cost (running sum). All four are rendered as Recharts charts in glass-morphism cards with gradient left borders. The history table is paginated client-side at 10 rows per page.

---

## 4. KEY CONCEPTS EXPLAINED SIMPLY

### What is RAG?

RAG stands for Retrieval Augmented Generation. The idea: instead of asking an LLM a question cold and hoping it knows the answer, you first search your own database for relevant information, then give that information to the LLM along with the question. "Here's relevant context from our document — now answer the question using only this."

The LLM's job becomes much easier and more accurate because it doesn't have to rely on memorized training data. It just has to summarize and reason over text you've handed it.

### What is a vector embedding?

An embedding converts text into a list of numbers (a vector) that captures meaning. The key property: similar text gets similar numbers. "The cat sat on the mat" and "A feline rested on the rug" will have very close vectors even though they share no words.

In RagForge, `sentence-transformers/all-MiniLM-L6-v2` converts each document chunk and each query into a 384-dimensional vector. Finding relevant chunks becomes a math problem: find the vectors closest to the query vector.

### What is ChromaDB and why use it?

ChromaDB is a vector database — a database built specifically for storing and searching embeddings. Regular databases (like SQLite) are bad at "find me the 5 rows most similar to this vector." ChromaDB is built to do exactly that efficiently.

We chose ChromaDB over alternatives like Pinecone because it's embedded (runs inside your process, no separate server), persists to disk, and has a clean Python API. It's perfect for a single-node project.

### What is chunking and why does it matter?

You can't embed an entire 50-page document as one vector — you'd lose all specificity. Chunking splits the document into smaller pieces (we use 500 characters with 50-character overlap). Each chunk can then be independently embedded and retrieved.

The overlap is important: a sentence that spans a chunk boundary still appears in at least one chunk. Without overlap, you'd lose content that falls exactly on a boundary.

### What is semantic search vs keyword search?

Keyword search (like `grep` or `CTRL+F`) finds exact word matches. If you search for "funding sources" and the document says "financial backers," keyword search misses it.

Semantic search works on meaning. The embeddings for "funding sources" and "financial backers" are close in vector space, so semantic search finds it. This is why RagForge can answer questions even when the document uses different words than your question.

### What is query reformulation and why is it hard?

Query reformulation is rewriting a vague follow-up question ("What did they say about that?") into a complete standalone question ("What did the study's authors say about the long-term effects of carbon offsetting?").

It's hard because it requires understanding the entire conversation history to figure out what "that" refers to. RagForge solves it by calling Groq with a specialized prompt before retrieval. The reformulated query is what actually hits ChromaDB — the original casual question would return irrelevant chunks.

### What is conversational RAG?

Standard RAG answers one question at a time. Conversational RAG maintains a conversation where follow-up questions make sense in context.

The two ingredients: (1) query reformulation so retrieval works on vague follow-ups, and (2) passing conversation history to the LLM so it can reference prior answers naturally.

### What is faithfulness score?

Faithfulness measures whether the answer stays true to the retrieved context. A faithfulness of 1.0 means every sentence in the answer is supported by something in the retrieved chunks. A low score means the LLM may have added information from its training data instead of the document — that's hallucination.

In RagForge: we split the answer into sentences and check what fraction of each sentence's keywords appear in the context. If ≥40% of keywords are grounded, the sentence is counted as faithful.

### What is answer relevancy?

Answer relevancy measures whether the answer actually addresses the question. You could have a highly faithful answer that just says "The document covers many topics" — technically grounded, but useless.

In RagForge: we compute Jaccard similarity between query keywords and answer keywords, averaged with the fraction of query keywords that appear in the answer.

### What is context precision?

Context precision measures how useful the retrieved chunks were. If you retrieved 5 chunks but only 1 was actually relevant to the answer, precision is low — you wasted token budget on noise.

In RagForge: fraction of retrieved chunks that share ≥2 keywords with the answer.

### What is hallucination in AI?

Hallucination is when an LLM confidently states something that isn't true. It generates plausible-sounding text that isn't grounded in reality or in any provided context. Classic example: asking ChatGPT for a citation and getting a completely made-up paper.

In a RAG system, hallucination means the LLM answered from its training data instead of from the retrieved document chunks.

### What is hallucination risk score?

A custom metric in RagForge that estimates how much of the answer is grounded in retrieved context. It checks each answer sentence: if at least 3 of the sentence's content words appear somewhere in the retrieved chunks, the sentence is considered grounded. Hallucination risk = 1 − (fraction of grounded sentences).

Score of 0.0 = all sentences grounded = low risk. Score of 1.0 = no sentences grounded = high risk.

### What is an LLM?

Large Language Model — a neural network trained on vast amounts of text that can generate, summarize, and reason about language. GPT-4 (OpenAI), Claude (Anthropic), and Llama (Meta) are all LLMs. RagForge uses Llama 3.1 8B (a smaller, fast model) via Groq's API.

### What is Groq and why use it over OpenAI?

Groq is a company with custom LPU (Language Processing Unit) hardware designed specifically for LLM inference. Their hardware runs `llama-3.1-8b-instant` at roughly 200 tokens/second — around 10× faster than typical GPU-based APIs.

For a RAG system, latency matters a lot: the user sees total time = retrieval + generation + evaluation. Minimizing generation latency keeps the experience snappy. Groq also has a generous free tier, making this project zero-cost to develop and demo.

### What is FastAPI?

A modern Python web framework for building APIs. It auto-generates OpenAPI documentation (available at `localhost:8000/docs`), validates request/response bodies using Pydantic models, and supports async handlers. We use it here with synchronous handlers because the bottleneck is Groq API calls, not Python concurrency.

### What is ChromaDB persistent storage?

By default ChromaDB stores data in memory and loses it when the process stops. `PersistentClient(path="./chroma_db")` tells ChromaDB to write its data to disk in a directory called `chroma_db`. The next time the server starts, all your previously ingested documents are still there.

### What is SQLAlchemy and SQLite?

SQLAlchemy is a Python ORM (Object Relational Mapper) — it lets you define database tables as Python classes and write queries in Python instead of raw SQL. SQLite is a file-based database — the entire database is one `.db` file, no server needed. Together: we define `QueryLog` as a Python class, and SQLAlchemy writes the SQL to create the table and insert rows.

### What is sentence-transformers?

A Python library that provides pre-trained models for converting sentences into embedding vectors. The model we use (`all-MiniLM-L6-v2`) is 80MB, produces 384-dimensional vectors, and is optimized for semantic similarity tasks. It runs locally — no API call needed for embedding, which keeps retrieval fast.

---

## 5. INTERVIEW QUESTIONS AND ANSWERS

### Q1: Walk me through how RagForge works

"RagForge is a conversational RAG system. When you upload a document, it splits the text into 500-character chunks and generates embedding vectors for each chunk using sentence-transformers. Those embeddings are stored in ChromaDB on disk.

When you ask a question, the system first checks if there's conversation history — if so, it calls Groq to rewrite the follow-up into a standalone question. Then it embeds the (possibly reformulated) question and finds the 5 most semantically similar chunks in ChromaDB. Those chunks are injected into a prompt along with the conversation history, and Groq's Llama model generates an answer.

After each answer, three evaluation metrics are computed using keyword overlap to score faithfulness, relevancy, and context precision. Everything — query, answer, scores, latency, token count, cost — is logged to SQLite. The React dashboard shows live analytics including a 7-day score trend, latency distribution, and per-query history."

### Q2: Why did you choose ChromaDB over Pinecone?

"A few reasons. First, Pinecone requires an account, has rate limits, and introduces a network call to a third-party service — ChromaDB runs inside the same process. Second, for a portfolio project, operational simplicity matters — there's no separate service to manage, and the entire vector store is just a directory on disk that persists across restarts. Third, ChromaDB's Python API is clean and well-documented.

The tradeoff is scale — ChromaDB doesn't scale horizontally. If this became a product with millions of documents and concurrent users, I'd migrate to Qdrant or Weaviate which support distributed deployments. But for this use case, ChromaDB is the right tool."

### Q3: How does your evaluation system work?

"Every query goes through two evaluation modules. The first is `ragas_eval.py`, which computes three metrics using keyword overlap:

Faithfulness splits the answer into sentences and checks what fraction of each sentence's non-stopword keywords appear somewhere in the retrieved context. If ≥40% overlap, the sentence is grounded.

Answer relevancy computes Jaccard similarity between query keywords and answer keywords, averaged with the fraction of query keywords covered by the answer.

Context precision counts what fraction of retrieved chunks share ≥2 keywords with the answer.

The second module is `custom_metrics.py`, which computes hallucination risk (1 minus the fraction of grounded answer sentences), context utilization (fraction of chunks that contributed to the answer), and cost in USD based on Groq's token pricing.

All six scores are logged to SQLite and displayed in real time on the dashboard. The scores are all in the 0-1 range, with -1.0 used as a sentinel for 'could not compute' so SQL aggregates can filter them out with `WHERE col > 0`."

### Q4: What is query reformulation and why did you implement it?

"Without query reformulation, conversational RAG breaks immediately. Say a user asks 'What are the main findings?' and then asks 'Who funded that research?' — if you send 'Who funded that research?' directly to ChromaDB, you'll retrieve chunks about funding in general, not the specific research from the conversation.

Query reformulation fixes this by rewriting the follow-up into a standalone question before retrieval. I call Groq with a specialized system prompt: 'Rewrite the follow-up question as a complete, standalone question containing all necessary context.' The output — something like 'Who funded the climate impact study on carbon offsetting?' — is what actually hits ChromaDB.

The original casual question is still used in the generation prompt (so the LLM responds naturally), but retrieval always works on the reformulated version. If reformulation fails for any reason, we silently fall back to the original query — it never blocks an answer."

### Q5: How do you handle hallucination?

"Two ways. Prevention and detection.

Prevention: the system prompt to the LLM explicitly says 'Answer based ONLY on the provided context. If the context doesn't contain enough information, say so clearly. Do not hallucinate.' This doesn't eliminate hallucination but significantly reduces it.

Detection: the hallucination risk score in `custom_metrics.py` measures how grounded the answer is. It checks each answer sentence for keyword overlap with the retrieved chunks. A score above 0.5 is flagged yellow in the dashboard, above 0.7 is flagged red. Users can see at a glance which answers to trust.

The next step would be to add NLI (Natural Language Inference) based entailment scoring — checking if each answer sentence is entailed by the context using a BERT-style model. That's more accurate than keyword overlap but requires an additional ML model."

### Q6: What would you do to scale this to production?

"Several changes. 

Database: replace SQLite with PostgreSQL — SQLite has no concurrent write support. 

Vector store: replace ChromaDB with Qdrant or Weaviate for horizontal scaling and filtered search.

Embedding: move embedding generation to a dedicated service (like a GPU-accelerated container) and cache embeddings for duplicate content.

Queue: make evaluation async — instead of blocking each request on metric computation, push to a Celery/Redis task queue and stream results back via WebSocket.

Auth: add JWT-based authentication. Currently the API is completely open.

Deployment: containerize with Docker, deploy behind Nginx, use managed Postgres and Qdrant on a cloud provider.

Chunking: implement semantic chunking instead of fixed-size character splitting — this improves retrieval quality significantly for structured documents."

### Q7: What was the hardest bug you faced?

"The uvloop compatibility issue with RAGAs. When using `uvicorn[standard]`, uvicorn installs uvloop as the asyncio event loop policy. RAGAs tries to create and patch the event loop internally, which crashes with 'Can't patch loop of type uvloop.Loop'.

I went through three iterations. First I tried `nest_asyncio` to allow nested event loops — it can't patch uvloop so it was a no-op. Then I tried running RAGAs in a `ThreadPoolExecutor` with its own event loop — better, but RAGAs still had a broken import (`langchain_community.chat_models.vertexai`) from a removed LangChain module.

The final fix was to remove RAGAs entirely and replace it with a pure-Python keyword-overlap implementation. Zero external dependencies for evaluation, no asyncio at all, runs in microseconds instead of seconds, and the scores are directionally equivalent for typical RAG outputs. The lesson: sometimes the right fix is to remove the dependency."

### Q8: How is this different from just using ChatGPT?

"ChatGPT knows what it was trained on — internet data up to its cutoff. It doesn't know your private documents.

More importantly: ChatGPT doesn't tell you when it's making things up. It will confidently cite papers that don't exist, quote statistics it invented, and sound authoritative about things it knows nothing about.

RagForge grounds every answer in specific document chunks that you can inspect. It tells you exactly which parts of your document it used (the sources panel), and it scores how faithful and relevant the answer was. You can see the hallucination risk score and decide whether to trust the answer.

It's also conversational — you can have a multi-turn dialog about your documents, and each follow-up question benefits from context in prior turns."

### Q9: What are the limitations of your current approach?

"Honestly, several:

Chunking is naive — fixed 500-character splits can cut a sentence in half or separate a question from its answer. Semantic chunking (splitting on paragraph and topic boundaries) would improve retrieval quality.

Evaluation is heuristic — keyword overlap is a proxy for semantic quality. A rephrased answer that uses synonyms throughout would score poorly on faithfulness even if it's perfectly grounded.

No re-ranking — after retrieval, chunks are ordered by vector similarity. A cross-encoder re-ranker would re-score retrieved chunks for relevance to the specific question and often produces significantly better context.

SQLite can't handle concurrent writes — fine for solo use, a problem under load.

Conversation history grows unbounded — after 50 turns, the context window could overflow. Production systems implement a sliding window or summarization strategy.

No streaming — the answer appears all at once when generation finishes. Streaming via Server-Sent Events would make the UX feel much faster."

### Q10: How would you improve the evaluation metrics?

"The current keyword-overlap metrics are fast and dependency-free, but they're semantic proxies at best.

Better faithfulness: use an NLI model (like `facebook/bart-large-mnli`) to check if each answer sentence is entailed by the context. This catches paraphrase-style hallucinations that keyword overlap misses.

Better answer relevancy: use cosine similarity between the query embedding and answer embedding instead of keyword Jaccard. Semantically equivalent text scores higher.

Better context precision: use the same cross-encoder re-ranker I'd add to retrieval — it would score each retrieved chunk for relevance to the question and give a more accurate precision signal.

Ground truth: for a production system you'd maintain a golden dataset of question-answer pairs and compute BLEU/ROUGE/BERTScore against known correct answers."

### Q11: Why did you use Groq instead of OpenAI?

"Speed and cost. Groq's LPUs run `llama-3.1-8b-instant` at ~200 tokens/second — about 10× faster than OpenAI's similarly-sized models. For a RAG system that already takes time for retrieval and evaluation, fast generation keeps the total response time under 3 seconds on most queries.

Cost: Groq's free tier is generous enough to develop and demo this project at zero cost. OpenAI charges from day one.

Tradeoff: Llama 3.1 8B is a smaller model than GPT-4 and produces lower quality on complex reasoning tasks. For RAG on well-structured documents, the quality is more than sufficient — the answer is mostly summarization over retrieved text, not novel reasoning."

### Q12: Explain your monitoring system

"Every query that goes through the system gets logged to a SQLite table called `query_logs`. The logger (`monitoring/logger.py`) records: the original query text, the full answer, the source chunks as a JSON string, all six evaluation scores, retrieval and generation latency in milliseconds, input and output token counts, and a UTC timestamp.

The tracker (`monitoring/tracker.py`) runs SQL aggregates over this table on demand. `get_metrics_summary()` computes averages (filtering out -1.0 sentinels with `WHERE faithfulness > 0`), total cost, queries today, and a 7-day score trend. `get_query_history()` returns the N most recent rows.

The React dashboard polls this on mount and on manual refresh. The Analytics page visualizes it with four Recharts charts: score distribution histogram, latency area chart, token usage stacked bars, and cumulative cost line."

### Q13: What is the difference between retrieval latency and generation latency?

"Retrieval latency is the time to query ChromaDB — embed the query, run the nearest-neighbor search, and return the top-k chunks. This is typically 50-300ms depending on the collection size. It's measured in `rag_pipeline.py` with `time.perf_counter()` around the `retrieve_context()` call.

Generation latency is the time to get a response from the Groq API — sending the prompt and receiving the full answer. This is typically 500ms-3s depending on answer length and prompt size. Measured in `generator.py` with `time.perf_counter()` around `_llm.invoke()`.

Total latency is the sum of both (plus any eval time, though eval is fast with the keyword-based implementation). Breaking them apart lets you diagnose whether a slow response is a retrieval problem (ChromaDB, embedding model) or a generation problem (LLM API, prompt too long)."

### Q14: How does conversation history affect retrieval?

"It affects retrieval indirectly through query reformulation.

The conversation history is NOT used directly in ChromaDB queries — ChromaDB only takes the reformulated query string. But the reformulation step uses the conversation history to make that query self-contained and specific.

For example: after a conversation about photosynthesis, if the user asks 'How efficient is it?' — the reformulated query becomes 'How efficient is photosynthesis at converting sunlight to energy?' — which retrieves much more relevant chunks than 'How efficient is it?' would.

The history IS used directly in the LLM generation step — it's replayed as actual LangChain `HumanMessage`/`AIMessage` objects, so the LLM reads the full conversation thread and can reference earlier answers naturally."

### Q15: What tech stack did you use and why?

"Backend: FastAPI (fast, auto-docs, Pydantic validation), LangChain (standard RAG library ecosystem), ChromaDB (embedded vector DB, no infra), sentence-transformers (local embeddings, no API cost), Groq (fast inference, free tier), SQLAlchemy+SQLite (simple persistent logging).

Frontend: React + Vite (fast dev experience, component model), Tailwind CSS v4 (utility-first styling, dark theme), Recharts (React-native charts, no D3 complexity), Lucide React (consistent icon set), Axios (cleaner than fetch for API calls).

The overarching theme: minimize infrastructure. Everything runs locally. No Docker, no managed services, no accounts required (except Groq for the API key). Someone can clone this repo and be running in under 10 minutes."

### Q16: How do you ensure the LLM only uses the retrieved context?

"Two mechanisms. First, the system prompt explicitly instructs the model: 'Answer the question based ONLY on the provided context and conversation history. If the context doesn't contain enough information to answer, say so clearly. Do not hallucinate or make up information.'

Second, the faithfulness metric detects deviations — if the LLM answers from its training data instead of the context, keyword overlap between the answer and retrieved chunks will be low, producing a low faithfulness score.

It's not foolproof — a sufficiently large LLM can paraphrase retrieved content or inject facts from training data in ways that pass keyword checks. The right production-level fix would be NLI-based entailment checking."

### Q17: Explain your chunking strategy

"We use LangChain's `RecursiveCharacterTextSplitter` with `chunk_size=500` and `chunk_overlap=50`.

Recursive means it tries to split on paragraphs first, then newlines, then sentences, then words — preserving semantic boundaries as much as possible while staying under the character limit.

The 50-character overlap means the end of each chunk appears at the beginning of the next. This handles cases where important information spans a boundary — a question in one chunk and its answer in the next will both appear in at least one chunk.

500 characters is roughly 100-150 words — enough context for the LLM to work with, small enough to be semantically focused. The tradeoff: larger chunks are more likely to contain the answer, but dilute the semantic focus of the embedding; smaller chunks are more precise but may miss necessary context."

### Q18: What happens if ChromaDB is empty when a user asks a question?

"The retriever in `retriever.py` checks `_collection.count()` before querying. If zero, it returns an empty list immediately. ChromaDB raises an error if you run a query against an empty collection — this guard prevents that.

With no retrieved chunks, the generator sends only the system prompt and the question to the LLM. The LLM (following the system prompt instructions) should respond 'The context doesn't contain enough information to answer' rather than hallucinating an answer.

The evaluation scores will reflect this — context precision will be 0.0 (no chunks), faithfulness may be low, and the empty sources list will be visible in the chat bubble."

### Q19: How would you add authentication to this API?

"Add a FastAPI dependency that checks a JWT token on every protected route. The pattern:

```python
from fastapi import Depends, Security
from fastapi.security import HTTPBearer

security = HTTPBearer()

async def verify_token(token = Security(security)):
    # decode and validate JWT here
    ...

@router.post("/query", dependencies=[Depends(verify_token)])
async def query_documents(request: QueryRequest):
    ...
```

For a simpler API-key based approach, check an `X-API-Key` header against an environment variable.

The frontend would add the token to the Axios instance in `api.js`:
```js
api.defaults.headers.common['Authorization'] = `Bearer ${token}`
```"

### Q20: If this were a real product, what would you do first?

"The single highest-leverage improvement is **streaming responses**. Right now the user waits silently for 2-4 seconds and then sees the full answer appear. With streaming (FastAPI's `StreamingResponse` + Groq's streaming API + React's `EventSource`), the first tokens appear in ~300ms and the answer types out word by word.

Second: **better chunking**. Semantic/paragraph-aware chunking that respects document structure improves retrieval quality significantly, especially for documents with headings and sections.

Third: **authentication and multi-tenancy** — each user should have their own document collection and query history.

Fourth: **async evaluation** — evaluation adds latency to every query. Moving it to a background task queue (Celery + Redis) and streaming the scores separately would let the answer appear faster.

Fifth: **re-ranking** — a cross-encoder re-ranker between retrieval and generation dramatically improves answer quality for complex documents."

---

## 6. TECH STACK DECISIONS — WHY EACH CHOICE

| Technology | What it is | Why chosen | Tradeoff |
|---|---|---|---|
| **FastAPI** | Python async web framework | Auto-generates OpenAPI docs, Pydantic validation built in, fastest Python framework | Not as mature as Flask/Django, async model can confuse beginners |
| **LangChain** | RAG/LLM library ecosystem | Standard industry tool, integrations with every LLM and vector DB, good abstractions | Rapidly changing API, can be over-engineered for simple tasks |
| **ChromaDB** | Embedded vector database | No server to run, persists to disk, clean Python API | Single-node only, not suitable for large-scale concurrent use |
| **sentence-transformers** | Local embedding model library | Runs locally (no API cost/latency), all-MiniLM-L6-v2 is fast and accurate for semantic similarity | 80MB model on disk, ~100-300ms to embed during ingestion |
| **Groq** | LLM inference API (LPU hardware) | ~200 tok/s throughput, generous free tier, Llama models are open-weight | Smaller model than GPT-4, may struggle on complex reasoning |
| **SQLAlchemy + SQLite** | ORM + file-based database | Zero infrastructure, single .db file, no separate service | No concurrent writes, not suitable for production load |
| **React + Vite** | Frontend framework + build tool | Fast HMR, component model, massive ecosystem | Requires Node.js, more setup than vanilla JS |
| **Tailwind CSS v4** | Utility-first CSS framework | Consistent design system, dark theme trivial, no CSS files to manage | Learning curve, HTML can get verbose |
| **Recharts** | React chart library | React-native (no D3 wrapper), responsive containers built in | Limited customization vs D3, larger bundle |
| **Axios** | HTTP client | Interceptors, automatic JSON parsing, cleaner error handling than fetch | Extra dependency (fetch works fine for simple cases) |
| **PyPDF2 + python-docx** | Document parsers | Simple, widely used, zero setup | PyPDF2 struggles with scanned PDFs, python-docx doesn't handle all DOCX features |

---

## 7. KNOWN LIMITATIONS AND HOW TO FIX THEM

**Fixed-size chunking**
*Problem:* 500-character splits can cut mid-sentence or separate related paragraphs.
*Fix:* Use semantic/paragraph-aware chunking — split on `\n\n`, then recursively on sentences if a paragraph is too long.

**Keyword-overlap evaluation**
*Problem:* Misses paraphrase-style hallucinations where the LLM rephrases context using different words, or penalizes correct answers that use synonyms.
*Fix:* NLI-based entailment scoring using a local BERT model, or cosine similarity between answer and context embeddings.

**Conversation history grows unbounded**
*Problem:* After many turns, the prompt grows until it exceeds the LLM's context window.
*Fix:* Implement a sliding window (keep last N turns) or summarize older turns into a compressed context string.

**SQLite concurrent writes**
*Problem:* SQLite serializes writes — under concurrent load, DB calls queue up.
*Fix:* Replace with PostgreSQL. Just change `DATABASE_URL` — SQLAlchemy handles the rest.

**No re-ranking**
*Problem:* Chunks are ranked by embedding similarity alone, which doesn't account for exact-match relevance or document structure.
*Fix:* Add a cross-encoder re-ranker (e.g., `cross-encoder/ms-marco-MiniLM-L-6-v2`) between retrieval and generation.

**No streaming**
*Problem:* Users wait 2-4 seconds with no feedback before the full answer appears.
*Fix:* FastAPI `StreamingResponse` + Groq's streaming API + React `EventSource` — first tokens in ~300ms.

**No authentication**
*Problem:* The API is completely open.
*Fix:* JWT or API-key authentication via FastAPI `Depends`.

**All documents in one ChromaDB collection**
*Problem:* All users share the same document corpus, no isolation.
*Fix:* One collection per user/workspace — use `client.get_or_create_collection(user_id)`.

---

## 8. METRICS EXPLAINED

### Faithfulness (0–1, higher is better)

**What it measures:** Does the answer only say things that are supported by the retrieved document chunks? High faithfulness = the LLM stayed within bounds. Low faithfulness = the LLM added information from its training data.

**How it's calculated in RagForge:** `ragas_eval.py` splits the answer into sentences on `.!?`. For each sentence, it extracts non-stopword keywords. If ≥40% of those keywords appear somewhere in the retrieved context chunks, the sentence is grounded. Faithfulness = fraction of grounded sentences.

**Good score:** >0.75 — most of the answer is document-grounded.
**Bad score:** <0.40 — the LLM is significantly drawing on outside knowledge, risking hallucination.

### Answer Relevancy (0–1, higher is better)

**What it measures:** Does the answer actually address the question asked? A faithful but irrelevant answer would say true things from the document that have nothing to do with the question.

**How it's calculated:** Average of Jaccard similarity (query ∩ answer keywords / query ∪ answer keywords) and keyword coverage (query keywords that appear in the answer / total query keywords).

**Good score:** >0.65 — the answer directly addresses the query.
**Bad score:** <0.35 — the answer is off-topic or too generic.

### Context Precision (0–1, higher is better)

**What it measures:** Of the chunks retrieved from ChromaDB, what fraction were actually useful? High precision = we retrieved focused, relevant chunks. Low precision = retrieval was noisy, pulling in irrelevant content that wasted token budget.

**How it's calculated:** Fraction of retrieved chunks where ≥2 of the chunk's keywords overlap with the answer keywords.

**Good score:** >0.60 — most retrieved chunks contributed to the answer.
**Bad score:** <0.30 — retrieval is noisy; consider adjusting chunk size or the number of retrieved chunks.

### Hallucination Risk (0–1, lower is better)

**What it measures:** How much of the answer appears to be fabricated rather than grounded in context. The inverse of faithfulness from a different angle.

**How it's calculated:** `custom_metrics.py` checks each answer sentence for at least 3 overlapping keywords with any context chunk. Hallucination risk = 1 − (fraction of sentences passing this check).

**Good score:** <0.25 — low risk, most of the answer is grounded.
**Bad score:** >0.60 — high risk, the LLM is likely drawing on training data.

### Context Utilization (0–1, higher is better)

**What it measures:** Of the context you retrieved, how much did the LLM actually use? If you retrieved 5 chunks but only 1 appears to have influenced the answer, utilization is 0.2 — you wasted 80% of the context window.

**How it's calculated:** Fraction of retrieved chunks that share ≥2 keywords with the answer.

**Good score:** >0.60 — the LLM is leveraging most of what was retrieved.
**Bad score:** <0.20 — either the retrieval is poor (wrong chunks) or the LLM is ignoring the context.

### Total Cost (USD)

**What it measures:** Estimated API spend for this query based on token usage.

**How it's calculated:** `(input_tokens × $0.05/1M) + (output_tokens × $0.08/1M)` using Groq's published pricing. A typical query costs $0.00001-$0.0001 — essentially free.

### Retrieval Latency (ms)

Time from sending the query to ChromaDB to receiving back the top-k chunks. Typically 50-300ms. High retrieval latency suggests the ChromaDB collection is very large or the embedding model is slow.

### Generation Latency (ms)

Time from sending the prompt to Groq to receiving the complete response. Typically 500-3000ms depending on answer length and Groq server load. This is usually the dominant component of total latency.

---

## 9. THE CONVERSATIONAL RAG FEATURE

### Why single-turn RAG fails for follow-up questions

Imagine this conversation:

> **User:** What are the main findings of the climate study?
> **RagForge:** The study found that carbon offsetting reduces net emissions by 23% when implemented with strict verification protocols...
> **User:** Who funded it?

If you send "Who funded it?" to ChromaDB, what do you get? Chunks about funding in general. Maybe chunks about who funded other things mentioned in the document. The search has no idea "it" refers to the climate study.

Standard RAG systems break here. They return irrelevant chunks, the LLM produces a confused answer, and the user is frustrated.

### How query reformulation solves it

Before retrieval, RagForge makes a fast Groq API call with this system prompt:

> "You are a query reformulation assistant. Given a conversation history and a follow-up question, rewrite the follow-up question as a complete, standalone question that contains all necessary context from the conversation. Return ONLY the reformulated question, nothing else."

The input is the full conversation history plus "Who funded it?"

The output: **"Who funded the climate impact study on carbon offsetting mentioned in the research paper?"**

Now ChromaDB gets a self-contained, specific query and returns relevant chunks about the study's funding. The answer is accurate and on-topic.

### A full example conversation

**Setup:** User has uploaded a research paper on renewable energy policy.

**Turn 1:**
- User asks: *"What is the paper's main argument?"*
- `conversation_history = []` so reformulation returns the query unchanged
- ChromaDB retrieves chunks about the thesis and conclusions
- LLM answers: *"The paper argues that feed-in tariffs are more effective than carbon credits for incentivizing solar adoption in developing markets..."*

**Turn 2:**
- User asks: *"What evidence do they cite for that?"*
- `conversation_history = [{ role: "user", content: "What is the paper's main argument?" }, { role: "assistant", content: "The paper argues that feed-in tariffs..." }]`
- Reformulator rewrites to: *"What evidence does the paper cite to support the claim that feed-in tariffs are more effective than carbon credits for solar adoption in developing markets?"*
- ChromaDB retrieves chunks from the evidence section
- LLM answers with the specific studies and data cited

**Turn 3:**
- User asks: *"Which countries does it focus on?"*
- Reformulator rewrites to: *"Which developing market countries does the renewable energy paper focus on when comparing feed-in tariffs and carbon credit effectiveness?"*
- ChromaDB retrieves geographic-specific chunks
- Frontend shows: `🔍 Searched for: Which developing market countries does the renewable energy paper focus on...`

### Why this is technically impressive

Most RAG tutorials show Turn 1 only. Adding genuine conversational capability requires:

1. **A second LLM call** just for query rewriting (adds ~300-500ms but is worth it for accuracy)
2. **Careful failure handling** — reformulation must fall back silently if it fails
3. **Correct LLM message structure** — replaying history as proper `HumanMessage`/`AIMessage` alternation, not just concatenating text
4. **Frontend state management** — maintaining the full message array with metadata (sources, scores, reformulated query) per message, not just text
5. **Smart history payload** — sending text-only history to the backend (not source metadata or scores) to keep the API payload small

The result is a system that actually works like a research assistant — you can have a real conversation about a document, not just ask isolated questions.

---

## 10. QUICK REFERENCE — COMMANDS TO REMEMBER

### Starting the backend

```bash
cd backend
pip3 install -r requirements.txt    # first time only
cp .env.example .env                # first time only — add your GROQ_API_KEY
python3 -m uvicorn app.main:app --reload
# Runs on http://localhost:8000
# API docs at http://localhost:8000/docs
```

Or with asyncio loop (avoids any uvloop conflicts):
```bash
python3 -m app.main
```

### Starting the frontend

```bash
cd frontend
npm install          # first time only
npm run dev
# Runs on http://localhost:5173
```

### Where data is stored

| What | Where |
|---|---|
| SQLite database | `backend/ragforge.db` |
| ChromaDB vector store | `backend/chroma_db/` |
| Environment variables | `backend/.env` |

### How to add a new API route

1. Create (or add to) a file in `backend/app/routes/`
2. Define a FastAPI `APIRouter` with a prefix
3. Add your endpoint function
4. Import and register the router in `backend/app/main.py`:
   ```python
   from app.routes.your_file import router as your_router
   app.include_router(your_router)
   ```

### How to add a new frontend page

1. Create `frontend/src/pages/YourPage.jsx`
2. Add the route in `frontend/src/App.jsx`:
   ```jsx
   import YourPage from './pages/YourPage'
   <Route path="your-path" element={<YourPage />} />
   ```
3. Add the nav link in `frontend/src/components/Layout.jsx`:
   ```js
   { to: '/your-path', label: 'Your Page', icon: SomeIcon }
   ```

### How to check server logs

The backend logs to stdout. In the terminal running uvicorn you'll see:
- Request logs: `INFO: POST /api/query HTTP/1.1 200 OK`
- Warning logs from the evaluation and monitoring modules
- Stack traces if something fails

To see SQLite contents directly:
```bash
cd backend
sqlite3 ragforge.db
sqlite> SELECT query, faithfulness, total_latency_ms FROM query_logs ORDER BY created_at DESC LIMIT 5;
sqlite> .exit
```

To inspect ChromaDB:
```python
# Run from backend/
import chromadb
client = chromadb.PersistentClient(path="./chroma_db")
col = client.get_collection("documents")
print(col.count())  # total chunks stored
print(col.peek())   # first few chunks
```

---

*This guide covers every architectural decision, every file, and every interview question about RagForge. If you built it, you know it.*
