import json

from sqlalchemy.orm import Session

from app.monitoring.database import QueryLog


def log_query(session: Session, query_result: dict) -> QueryLog:
    metrics = query_result.get("metrics", {})
    eval_scores = query_result.get("eval_scores", {})

    record = QueryLog(
        query=query_result["query"],
        answer=query_result["answer"],
        sources=json.dumps(query_result.get("sources", [])),

        faithfulness=eval_scores.get("faithfulness"),
        answer_relevancy=eval_scores.get("answer_relevancy"),
        context_precision=eval_scores.get("context_precision"),
        hallucination_risk=eval_scores.get("hallucination_risk"),
        context_utilization=eval_scores.get("context_utilization"),
        cost_estimate_usd=eval_scores.get("cost_estimate_usd"),

        retrieval_latency_ms=metrics.get("retrieval_latency_ms", 0.0),
        generation_latency_ms=metrics.get("generation_latency_ms", 0.0),
        total_latency_ms=metrics.get("total_latency_ms", 0.0),
        input_tokens=metrics.get("input_tokens"),
        output_tokens=metrics.get("output_tokens"),
    )

    session.add(record)
    session.commit()
    session.refresh(record)
    return record
