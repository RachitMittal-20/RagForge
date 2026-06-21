from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.ingest import router as ingest_router

app = FastAPI(title="RagForge", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest_router)


@app.get("/health")
async def health():
    return {"status": "healthy", "project": "RagForge"}
