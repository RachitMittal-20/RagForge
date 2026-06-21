import os
from datetime import datetime, timezone

import chromadb
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.config import settings

# Module-level singletons — model and DB client loaded once at startup
_embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
_chroma_client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
_collection = _chroma_client.get_or_create_collection("documents")

_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)


def _extract_text(file_path: str, filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()

    if ext == ".pdf":
        import PyPDF2
        with open(file_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            return "\n".join(page.extract_text() or "" for page in reader.pages)

    if ext == ".docx":
        import docx
        doc = docx.Document(file_path)
        return "\n".join(para.text for para in doc.paragraphs)

    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()


def process_document(file_path: str, filename: str) -> dict:
    text = _extract_text(file_path, filename)
    chunks = _splitter.split_text(text)
    total_chunks = len(chunks)
    ingested_at = datetime.now(timezone.utc).isoformat()

    embeddings = _embeddings.embed_documents(chunks)

    ids = [f"{filename}__chunk_{i}" for i in range(total_chunks)]
    metadatas = [
        {
            "filename": filename,
            "chunk_index": i,
            "total_chunks": total_chunks,
            "ingested_at": ingested_at,
        }
        for i in range(total_chunks)
    ]

    # Upsert so re-ingesting the same file replaces old chunks
    _collection.upsert(
        ids=ids,
        embeddings=embeddings,
        documents=chunks,
        metadatas=metadatas,
    )

    return {"filename": filename, "total_chunks": total_chunks, "status": "success"}


def get_all_documents() -> list[dict]:
    results = _collection.get(include=["metadatas"])
    metadatas = results.get("metadatas") or []

    # Collapse per-chunk records into one entry per filename
    seen: dict[str, dict] = {}
    for meta in metadatas:
        name = meta["filename"]
        if name not in seen:
            seen[name] = {
                "filename": name,
                "total_chunks": meta["total_chunks"],
                "ingested_at": meta["ingested_at"],
            }

    return list(seen.values())
