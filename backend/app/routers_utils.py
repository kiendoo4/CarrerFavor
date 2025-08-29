from fastapi import APIRouter, Depends, UploadFile, File
from .deps import get_current_user
from .tika_client import extract_text_via_tika


router = APIRouter(prefix="/utils", tags=["utils"])


@router.post("/extract-text")
def extract_text(file: UploadFile = File(...), user=Depends(get_current_user)):
    raw = file.file.read()
    content_type = file.content_type or 'application/octet-stream'
    text = extract_text_via_tika(raw, content_type, file.filename)
    return {"text": text}

