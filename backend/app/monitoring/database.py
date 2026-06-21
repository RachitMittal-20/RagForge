import json
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    Integer,
    Text,
    create_engine,
)
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


class QueryLog(Base):
    __tablename__ = "query_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    query = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    sources = Column(Text, nullable=True)           # JSON string

    # RAGAs eval scores
    faithfulness = Column(Float, nullable=True)
    answer_relevancy = Column(Float, nullable=True)
    context_precision = Column(Float, nullable=True)

    # Custom eval scores
    hallucination_risk = Column(Float, nullable=True)
    context_utilization = Column(Float, nullable=True)
    cost_estimate_usd = Column(Float, nullable=True)

    # Latency metrics
    retrieval_latency_ms = Column(Float, nullable=False)
    generation_latency_ms = Column(Float, nullable=False)
    total_latency_ms = Column(Float, nullable=False)

    # Token usage
    input_tokens = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


_engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},   # required for SQLite
)
_SessionLocal = sessionmaker(bind=_engine, autocommit=False, autoflush=False)


def init_db() -> None:
    Base.metadata.create_all(bind=_engine)


def get_session() -> Session:
    return _SessionLocal()
