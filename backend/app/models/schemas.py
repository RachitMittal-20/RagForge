from typing import Optional
from pydantic import BaseModel


class IngestResponse(BaseModel):
    filename: str
    total_chunks: int
    status: str


class DocumentInfo(BaseModel):
    filename: str
    total_chunks: int
    ingested_at: str


class QueryRequest(BaseModel):
    query: str
    top_k: int = 5


class SourceChunk(BaseModel):
    content: str
    filename: str
    score: float


class QueryMetrics(BaseModel):
    retrieval_latency_ms: float
    generation_latency_ms: float
    total_latency_ms: float
    input_tokens: int
    output_tokens: int


class EvalScores(BaseModel):
    # RAGAs scores (-1.0 means unavailable)
    faithfulness: float
    answer_relevancy: float
    context_precision: float
    error: Optional[str] = None   # populated when RAGAs eval fails

    # Custom metrics (always populated)
    hallucination_risk: float
    context_utilization: float
    cost_estimate_usd: float


class QueryResponse(BaseModel):
    query: str
    answer: str
    sources: list[SourceChunk]
    metrics: QueryMetrics
    eval_scores: EvalScores
