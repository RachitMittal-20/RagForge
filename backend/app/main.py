from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.ingest import router as ingest_router
from app.routes.query import router as query_router
from app.routes.metrics import router as metrics_router

app = FastAPI(title="RagForge", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest_router)
app.include_router(query_router)
app.include_router(metrics_router)


@app.on_event("startup")
async def startup():
    from app.monitoring.database import init_db
    init_db()


@app.get("/health")
async def health():
    return {"status": "healthy", "project": "RagForge"}
