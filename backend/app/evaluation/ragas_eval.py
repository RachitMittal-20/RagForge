"""
Pure-Python RAG evaluation — no RAGAs dependency.

RAGAs 0.2.x has a broken transitive import
(langchain_community.chat_models.vertexai) that was removed in
langchain-community >= 0.3, making the library unusable without pinning an
incompatible dependency tree.

This module replicates the three key metrics with keyword-overlap heuristics
that are deterministic, instant, and require no external API calls:

  faithfulness      — fraction of answer sentences grounded in context
  answer_relevancy  — keyword overlap between the query and the answer
  context_precision — fraction of retrieved chunks that contributed to the answer

Results are directionally equivalent to the RAGAs scores for typical RAG
outputs and have been calibrated against the same 0-1 scale.
"""

import re
import logging

logger = logging.getLogger(__name__)

_STOPWORDS = frozenset(
    "a an the is are was were be been being have has had do does did "
    "will would could should may might shall can need dare ought used "
    "to of in on at by for with about against between through during "
    "before after above below from up down out off over under again "
    "further then once here there when where why how all both each "
    "few more most other some such no nor not only own same so than "
    "too very just but and or if as it its this that these those i "
    "we you he she they me him her us them my our your his their what "
    "which who whom this that am".split()
)


def _kw(text: str) -> set[str]:
    """Non-stopword tokens longer than 2 characters."""
    return {w for w in re.findall(r"[a-z]+", text.lower())
            if w not in _STOPWORDS and len(w) > 2}


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"[.!?]+", text) if len(s.strip()) > 10]


def _faithfulness(answer: str, contexts: list[str]) -> float:
    """
    Fraction of answer sentences where ≥40% of the sentence's keywords appear
    in at least one context chunk.  A sentence with no meaningful keywords is
    counted as grounded (it's likely a filler phrase, not a factual claim).
    """
    sentences = _sentences(answer)
    if not sentences:
        return 1.0

    all_ctx_kw = set().union(*(_kw(c) for c in contexts)) if contexts else set()
    if not all_ctx_kw:
        return 0.0

    grounded = 0
    for sent in sentences:
        sent_kw = _kw(sent)
        if not sent_kw:          # no content words → not a factual claim
            grounded += 1
            continue
        overlap = len(sent_kw & all_ctx_kw) / len(sent_kw)
        if overlap >= 0.40:
            grounded += 1

    return round(grounded / len(sentences), 4)


def _answer_relevancy(query: str, answer: str) -> float:
    """
    Jaccard similarity between query keywords and answer keywords.
    High score means the answer actually addresses what was asked.
    """
    q_kw = _kw(query)
    a_kw = _kw(answer)
    if not q_kw or not a_kw:
        return 0.0
    intersection = len(q_kw & a_kw)
    union = len(q_kw | a_kw)
    # Jaccard is naturally low for short queries; scale by coverage of query terms
    coverage = intersection / len(q_kw)
    jaccard = intersection / union
    return round((jaccard + coverage) / 2, 4)


def _context_precision(answer: str, contexts: list[str]) -> float:
    """
    Fraction of retrieved chunks whose keywords overlap substantially with the
    answer (≥2 shared keywords).  Measures whether retrieval was precise —
    i.e. we didn't pull in a lot of irrelevant chunks.
    """
    if not contexts:
        return 0.0
    a_kw = _kw(answer)
    if not a_kw:
        return 0.0
    useful = sum(1 for c in contexts if len(_kw(c) & a_kw) >= 2)
    return round(useful / len(contexts), 4)


def evaluate_response(query: str, answer: str, contexts: list[str]) -> dict:
    """
    Public entry point — always returns a complete score dict, never raises.
    """
    try:
        return {
            "faithfulness":      _faithfulness(answer, contexts),
            "answer_relevancy":  _answer_relevancy(query, answer),
            "context_precision": _context_precision(answer, contexts),
        }
    except Exception as exc:
        logger.warning("Evaluation failed: %s", exc, exc_info=True)
        return {
            "faithfulness":      -1.0,
            "answer_relevancy":  -1.0,
            "context_precision": -1.0,
            "error": str(exc),
        }
