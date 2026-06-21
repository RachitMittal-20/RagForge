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


class QueryResponse(BaseModel):
    query: str
    answer: str
    sources: list[SourceChunk]
    metrics: QueryMetrics
