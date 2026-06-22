import logging

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage

from app.config import settings

logger = logging.getLogger(__name__)

_llm = ChatGroq(
    model="llama-3.1-8b-instant",
    api_key=settings.GROQ_API_KEY,
    max_tokens=150,
)

_SYSTEM_PROMPT = (
    "You are a query reformulation assistant. Given a conversation history and a follow-up "
    "question, rewrite the follow-up question as a complete, standalone question that contains "
    "all necessary context from the conversation. Return ONLY the reformulated question, nothing "
    "else. Do not explain, do not add quotes."
)


def reformulate_query(current_query: str, conversation_history: list[dict]) -> str:
    if not conversation_history:
        return current_query

    history_text = "\n".join(
        f"{'User' if m['role'] == 'user' else 'Assistant'}: {m['content']}"
        for m in conversation_history
    )

    user_message = (
        f"Conversation history:\n{history_text}\n\n"
        f"Follow-up question: {current_query}\n\n"
        "Reformulated standalone question:"
    )

    try:
        response = _llm.invoke([
            SystemMessage(content=_SYSTEM_PROMPT),
            HumanMessage(content=user_message),
        ])
        reformulated = response.content.strip().strip('"').strip("'")
        return reformulated if reformulated else current_query
    except Exception as exc:
        logger.warning("Query reformulation failed, using original: %s", exc)
        return current_query
