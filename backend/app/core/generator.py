import time

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage

from app.config import settings

# Module-level singleton — client reused across requests
_llm = ChatGroq(
    model="llama-3.1-8b-instant",
    api_key=settings.GROQ_API_KEY,
)

_SYSTEM_PROMPT = (
    "You are a helpful assistant. Answer the question based ONLY on the provided context. "
    "If the context doesn't contain enough information to answer, say so clearly. "
    "Do not hallucinate or make up information."
)


def generate_answer(query: str, context_chunks: list[dict]) -> dict:
    context_text = "\n\n---\n\n".join(chunk["content"] for chunk in context_chunks)

    messages = [
        SystemMessage(content=_SYSTEM_PROMPT),
        HumanMessage(content=f"Context:\n{context_text}\n\nQuestion: {query}"),
    ]

    start_time = time.perf_counter()
    response = _llm.invoke(messages)
    end_time = time.perf_counter()

    latency_ms = round((end_time - start_time) * 1000, 2)

    usage = response.usage_metadata or {}
    input_tokens = usage.get("input_tokens", 0)
    output_tokens = usage.get("output_tokens", 0)

    return {
        "answer": response.content,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "generation_latency_ms": latency_ms,
    }
