import re

# Common English stopwords — excluded from keyword-overlap calculations
_STOPWORDS = frozenset(
    "a an the is are was were be been being have has had do does did "
    "will would could should may might shall can need dare ought used "
    "to of in on at by for with about against between through during "
    "before after above below from up down out off over under again "
    "further then once here there when where why how all both each "
    "few more most other some such no nor not only own same so than "
    "too very just but and or if as it its this that these those i "
    "we you he she they me him her us them my our your his their what "
    "which who whom this that am is are".split()
)

# Groq pricing (USD per token)
_PRICE_INPUT_PER_TOKEN = 0.05 / 1_000_000
_PRICE_OUTPUT_PER_TOKEN = 0.08 / 1_000_000


def _keywords(text: str) -> set[str]:
    words = re.findall(r"[a-z]+", text.lower())
    return {w for w in words if w not in _STOPWORDS and len(w) > 2}


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"[.!?]+", text) if s.strip()]


def calculate_custom_metrics(
    query: str,
    answer: str,
    contexts: list[str],
    generation_metrics: dict,
) -> dict:
    answer_keywords = _keywords(answer)
    context_keywords_list = [_keywords(ctx) for ctx in contexts]
    all_context_keywords = set().union(*context_keywords_list) if context_keywords_list else set()

    # --- hallucination_risk ---
    # Per-sentence: does at least 3 answer keywords overlap with ANY context chunk?
    sentences = _sentences(answer)
    if sentences and all_context_keywords:
        grounded = sum(
            1
            for sent in sentences
            if len(_keywords(sent) & all_context_keywords) >= 3
        )
        overlap_ratio = grounded / len(sentences)
    else:
        overlap_ratio = 0.0
    hallucination_risk = round(1.0 - overlap_ratio, 4)

    # --- context_utilization ---
    # Fraction of retrieved chunks that share >=2 keywords with the answer
    if context_keywords_list and answer_keywords:
        utilized = sum(
            1 for ckw in context_keywords_list if len(ckw & answer_keywords) >= 2
        )
        context_utilization = round(utilized / len(context_keywords_list), 4)
    else:
        context_utilization = 0.0

    # --- cost_estimate ---
    input_tokens = generation_metrics.get("input_tokens", 0)
    output_tokens = generation_metrics.get("output_tokens", 0)
    cost_estimate_usd = round(
        input_tokens * _PRICE_INPUT_PER_TOKEN + output_tokens * _PRICE_OUTPUT_PER_TOKEN,
        8,
    )

    return {
        "hallucination_risk": hallucination_risk,
        "context_utilization": context_utilization,
        "cost_estimate_usd": cost_estimate_usd,
    }
