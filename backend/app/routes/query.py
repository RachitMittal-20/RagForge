import logging

from fastapi import APIRouter, HTTPException

from app.core.rag_pipeline import run_query
from app.models.schemas import QueryRequest, QueryResponse
from app.monitoring.database import get_session
from app.monitoring.logger import log_query

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")


@router.post("/query", response_model=QueryResponse)
async def query_documents(request: QueryRequest):
    history = [m.model_dump() for m in request.conversation_history]
    try:
        result = run_query(request.query, top_k=request.top_k, conversation_history=history)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    # Log to DB — non-blocking: a logging failure must not fail the response
    session = get_session()
    try:
        log_query(session, result)
    except Exception as exc:
        logger.warning("Failed to log query to database: %s", exc)
    finally:
        session.close()

    return result
