import json
from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.monitoring.database import QueryLog


def get_metrics_summary(session: Session) -> dict:
    total = session.query(func.count(QueryLog.id)).scalar() or 0

    # Averages — filter out -1.0 sentinels from failed RAGAs evals
    def _avg(col):
        result = (
            session.query(func.avg(col))
            .filter(col > 0)
            .scalar()
        )
        return round(float(result), 4) if result is not None else None

    avg_faithfulness = _avg(QueryLog.faithfulness)
    avg_answer_relevancy = _avg(QueryLog.answer_relevancy)
    avg_total_latency = session.query(func.avg(QueryLog.total_latency_ms)).scalar()
    avg_total_latency = round(float(avg_total_latency), 2) if avg_total_latency is not None else None

    total_input = session.query(func.sum(QueryLog.input_tokens)).scalar() or 0
    total_output = session.query(func.sum(QueryLog.output_tokens)).scalar() or 0
    total_cost = session.query(func.sum(QueryLog.cost_estimate_usd)).scalar() or 0.0

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    queries_today = (
        session.query(func.count(QueryLog.id))
        .filter(QueryLog.created_at >= today_start)
        .scalar()
        or 0
    )

    # Score trend — last 7 days, one row per calendar day
    score_trend = []
    for days_ago in range(6, -1, -1):
        day_start = today_start - timedelta(days=days_ago)
        day_end = day_start + timedelta(days=1)
        row = (
            session.query(
                func.avg(QueryLog.faithfulness).label("avg_faithfulness"),
                func.avg(QueryLog.answer_relevancy).label("avg_answer_relevancy"),
            )
            .filter(
                QueryLog.created_at >= day_start,
                QueryLog.created_at < day_end,
                QueryLog.faithfulness > 0,
            )
            .one()
        )
        score_trend.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "avg_faithfulness": round(float(row.avg_faithfulness), 4) if row.avg_faithfulness is not None else None,
            "avg_answer_relevancy": round(float(row.avg_answer_relevancy), 4) if row.avg_answer_relevancy is not None else None,
        })

    return {
        "total_queries": total,
        "avg_faithfulness": avg_faithfulness,
        "avg_answer_relevancy": avg_answer_relevancy,
        "avg_total_latency_ms": avg_total_latency,
        "total_input_tokens": int(total_input),
        "total_output_tokens": int(total_output),
        "total_cost_usd": round(float(total_cost), 8),
        "queries_today": queries_today,
        "score_trend": score_trend,
    }


def get_query_history(session: Session, limit: int = 50, offset: int = 0) -> list[dict]:
    rows = (
        session.query(QueryLog)
        .order_by(QueryLog.created_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )

    result = []
    for row in rows:
        result.append({
            "id": row.id,
            "query": row.query,
            "answer": row.answer,
            "sources": json.loads(row.sources) if row.sources else [],
            "faithfulness": row.faithfulness,
            "answer_relevancy": row.answer_relevancy,
            "context_precision": row.context_precision,
            "hallucination_risk": row.hallucination_risk,
            "context_utilization": row.context_utilization,
            "cost_estimate_usd": row.cost_estimate_usd,
            "retrieval_latency_ms": row.retrieval_latency_ms,
            "generation_latency_ms": row.generation_latency_ms,
            "total_latency_ms": row.total_latency_ms,
            "input_tokens": row.input_tokens,
            "output_tokens": row.output_tokens,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        })

    return result
