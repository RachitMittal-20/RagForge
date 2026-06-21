import time

from app.core.retriever import retrieve_context
from app.core.generator import generate_answer
from app.evaluation.ragas_eval import evaluate_response
from app.evaluation.custom_metrics import calculate_custom_metrics


def run_query(query: str, top_k: int = 5) -> dict:
    # Step 1: Retrieve
    t0 = time.perf_counter()
    chunks = retrieve_context(query, top_k=top_k)
    retrieval_latency_ms = round((time.perf_counter() - t0) * 1000, 2)

    # Step 2: Generate
    generation_result = generate_answer(query, chunks)
    generation_latency_ms = generation_result["generation_latency_ms"]

    answer = generation_result["answer"]
    contexts = [chunk["content"] for chunk in chunks]

    sources = [
        {
            "content": chunk["content"],
            "filename": chunk["metadata"].get("filename", ""),
            "score": chunk["similarity_score"],
        }
        for chunk in chunks
    ]

    # Step 3: Evaluate — both are non-blocking; failures return sentinel values
    ragas_scores = evaluate_response(query, answer, contexts)
    custom_scores = calculate_custom_metrics(
        query, answer, contexts, generation_result
    )

    return {
        "query": query,
        "answer": answer,
        "sources": sources,
        "metrics": {
            "retrieval_latency_ms": retrieval_latency_ms,
            "generation_latency_ms": generation_latency_ms,
            "total_latency_ms": round(retrieval_latency_ms + generation_latency_ms, 2),
            "input_tokens": generation_result["input_tokens"],
            "output_tokens": generation_result["output_tokens"],
        },
        "eval_scores": {**ragas_scores, **custom_scores},
    }
