from fastapi import APIRouter, HTTPException

from app.core.rag_pipeline import run_query
from app.models.schemas import QueryRequest, QueryResponse

router = APIRouter(prefix="/api")


@router.post("/query", response_model=QueryResponse)
async def query_documents(request: QueryRequest):
    try:
        return run_query(request.query, top_k=request.top_k)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
