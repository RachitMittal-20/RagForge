import time

from app.core.retriever import retrieve_context
from app.core.generator import generate_answer


def run_query(query: str, top_k: int = 5) -> dict:
    # Step 1: Retrieve
    t0 = time.perf_counter()
    chunks = retrieve_context(query, top_k=top_k)
    retrieval_latency_ms = round((time.perf_counter() - t0) * 1000, 2)

    # Step 2: Generate
    generation_result = generate_answer(query, chunks)
    generation_latency_ms = generation_result["generation_latency_ms"]

    sources = [
        {
            "content": chunk["content"],
            "filename": chunk["metadata"].get("filename", ""),
            "score": chunk["similarity_score"],
        }
        for chunk in chunks
    ]

    return {
        "query": query,
        "answer": generation_result["answer"],
        "sources": sources,
        "metrics": {
            "retrieval_latency_ms": retrieval_latency_ms,
            "generation_latency_ms": generation_latency_ms,
            "total_latency_ms": round(retrieval_latency_ms + generation_latency_ms, 2),
            "input_tokens": generation_result["input_tokens"],
            "output_tokens": generation_result["output_tokens"],
        },
    }
