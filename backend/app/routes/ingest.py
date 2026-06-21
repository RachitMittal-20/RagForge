import os
import tempfile

from fastapi import APIRouter, HTTPException, UploadFile

from app.core.ingestion import get_all_documents, process_document
from app.models.schemas import DocumentInfo, IngestResponse

router = APIRouter(prefix="/api")


@router.post("/ingest", response_model=IngestResponse)
async def ingest_document(file: UploadFile):
    suffix = os.path.splitext(file.filename)[1] if file.filename else ""
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_path = tmp.name
            content = await file.read()
            tmp.write(content)

        result = process_document(tmp_path, file.filename or "unknown")
        return IngestResponse(**result)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


@router.get("/documents", response_model=list[DocumentInfo])
async def list_documents():
    try:
        return get_all_documents()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
