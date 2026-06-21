"""
RAGAs-based evaluation with Groq as the evaluator LLM.

RAGAs requires langchain_community.chat_models.vertexai which was removed in
langchain-community>=0.3. All imports are deferred inside the function so a broken
ragas install degrades gracefully to -1.0 sentinel scores rather than crashing the
server at startup. Custom metrics in custom_metrics.py always run regardless.
"""

import logging

logger = logging.getLogger(__name__)


def evaluate_response(query: str, answer: str, contexts: list[str]) -> dict:
    """
    Run RAGAs faithfulness / answer_relevancy / context_precision.
    Returns all scores as -1.0 with an "error" key if ragas is unavailable or fails.
    """
    try:
        # Defer all ragas imports so an import error is caught here, not at server start
        from ragas import evaluate as ragas_evaluate
        from ragas.metrics import faithfulness, answer_relevancy, context_precision
        from ragas.llms import LangchainLLMWrapper
        from ragas.embeddings import LangchainEmbeddingsWrapper
        from datasets import Dataset
        from langchain_groq import ChatGroq

        from app.config import settings
        from app.core.ingestion import _embeddings as hf_embeddings

        groq_llm = ChatGroq(
            model="llama-3.1-8b-instant",
            api_key=settings.GROQ_API_KEY,
        )
        wrapped_llm = LangchainLLMWrapper(groq_llm)
        wrapped_embeddings = LangchainEmbeddingsWrapper(hf_embeddings)

        for metric in (faithfulness, answer_relevancy, context_precision):
            metric.llm = wrapped_llm
            if hasattr(metric, "embeddings"):
                metric.embeddings = wrapped_embeddings

        dataset = Dataset.from_dict(
            {
                "question": [query],
                "answer": [answer],
                "contexts": [contexts],
                "ground_truth": [""],   # not available at query time
            }
        )

        result = ragas_evaluate(
            dataset,
            metrics=[faithfulness, answer_relevancy, context_precision],
        )
        scores = result.to_pandas().iloc[0]

        def _safe(val) -> float:
            try:
                f = float(val)
                return round(f, 4) if f == f else -1.0   # NaN check
            except Exception:
                return -1.0

        return {
            "faithfulness": _safe(scores.get("faithfulness", -1.0)),
            "answer_relevancy": _safe(scores.get("answer_relevancy", -1.0)),
            "context_precision": _safe(scores.get("context_precision", -1.0)),
        }

    except Exception as exc:
        logger.warning("RAGAs evaluation failed: %s", exc, exc_info=True)
        return {
            "faithfulness": -1.0,
            "answer_relevancy": -1.0,
            "context_precision": -1.0,
            "error": str(exc),
        }
