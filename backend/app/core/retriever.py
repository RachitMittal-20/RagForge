from app.core.ingestion import _collection, _embeddings


def retrieve_context(query: str, top_k: int = 5) -> list[dict]:
    count = _collection.count()
    if count == 0:
        return []

    query_embedding = _embeddings.embed_query(query)

    results = _collection.query(
        query_embeddings=[query_embedding],
        n_results=min(top_k, count),
        include=["documents", "metadatas", "distances"],
    )

    documents = results["documents"][0]
    metadatas = results["metadatas"][0]
    # ChromaDB returns L2 distances; convert to a 0-1 similarity score
    distances = results["distances"][0]

    chunks = []
    for doc, meta, dist in zip(documents, metadatas, distances):
        chunks.append({
            "content": doc,
            "metadata": meta,
            "similarity_score": round(1 / (1 + dist), 4),
        })

    return chunks
