from fastapi import APIRouter, HTTPException, Query

from app.monitoring.database import get_session
from app.monitoring.tracker import get_metrics_summary, get_query_history

router = APIRouter(prefix="/api/metrics")


@router.get("/summary")
async def metrics_summary():
    session = get_session()
    try:
        return get_metrics_summary(session)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        session.close()


@router.get("/history")
async def query_history(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    session = get_session()
    try:
        return get_query_history(session, limit=limit, offset=offset)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        session.close()
