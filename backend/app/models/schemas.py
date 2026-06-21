from pydantic import BaseModel


class IngestResponse(BaseModel):
    filename: str
    total_chunks: int
    status: str


class DocumentInfo(BaseModel):
    filename: str
    total_chunks: int
    ingested_at: str
