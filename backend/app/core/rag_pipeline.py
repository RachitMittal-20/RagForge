import time

from app.core.retriever import retrieve_context
from app.core.generator import generate_answer
from app.core.query_reformulator import reformulate_query
from app.evaluation.ragas_eval import evaluate_response
from app.evaluation.custom_metrics import calculate_custom_metrics


def run_query(
    query: str,
    top_k: int = 5,
    conversation_history: list[dict] | None = None,
) -> dict:
    if conversation_history is None:
        conversation_history = []

    # Step 1: Reformulate follow-up questions into standalone queries
    standalone_query = reformulate_query(query, conversation_history)

    # Step 2: Retrieve using the standalone query for better semantic match
    t0 = time.perf_counter()
    chunks = retrieve_context(standalone_query, top_k=top_k)
    retrieval_latency_ms = round((time.perf_counter() - t0) * 1000, 2)

    contexts = [chunk["content"] for chunk in chunks]
    sources = [
        {
            "content": chunk["content"],
            "filename": chunk["metadata"].get("filename", ""),
            "score": chunk["similarity_score"],
        }
        for chunk in chunks
    ]

    # Step 3: Generate — pass conversation history so the LLM can maintain context
    generation_result = generate_answer(
        query=query,
        context_chunks=chunks,
        conversation_history=conversation_history,
    )
    generation_latency_ms = generation_result["generation_latency_ms"]
    answer = generation_result["answer"]

    # Step 4: Evaluate against original query (not reformulated)
    ragas_scores = evaluate_response(query, answer, contexts)
    custom_scores = calculate_custom_metrics(query, answer, contexts, generation_result)

    return {
        "query": query,
        "reformulated_query": standalone_query,
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
