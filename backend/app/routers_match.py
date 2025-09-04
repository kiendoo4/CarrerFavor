from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
import tempfile
import os
from typing import List
import json

from .deps import get_db, get_current_user
from .models import CV, User, UserRole, CVCollection
from .schemas import MatchRequestSingle, MatchScore, HRMatchRequest, HRMatchResponse, HRMatchItem, CollectionResponse, MatchingRequest
from .text_extract import sniff_and_extract_text
from .tika_client import extract_text_via_tika
from .scoring import compute_similarity_score
from .models import LLMConfig


router = APIRouter(prefix="/match", tags=["match"])


@router.post("/single", response_model=MatchScore)
def match_single(
    payload: MatchRequestSingle,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not payload.cv_text or not payload.jd_text:
        raise HTTPException(status_code=400, detail="cv_text and jd_text are required")
    # Use user's LLM config so the agent has a valid key
    llm_config = db.query(LLMConfig).filter(LLMConfig.user_id == user.id).first()
    if llm_config and llm_config.llm_api_key:
        score = compute_similarity_score(
            payload.cv_text,
            payload.jd_text,
            llm_provider=str(llm_config.llm_provider.value if hasattr(llm_config.llm_provider, 'value') else llm_config.llm_provider),
            llm_model_name=llm_config.llm_model_name,
            api_key=llm_config.llm_api_key,
        )
    else:
        score = compute_similarity_score(payload.cv_text, payload.jd_text)
    return MatchScore(score=score)


@router.post("/single-file", response_model=MatchScore)
def match_single_file(
    cv_file: UploadFile = File(...),
    jd_file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    cv_text = _read_upload_to_text(cv_file)
    jd_text = _read_upload_to_text(jd_file)
    score = compute_similarity_score(cv_text, jd_text)
    return MatchScore(score=score)


def _read_upload_to_text(file: UploadFile) -> str:
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        content = file.file.read()
        tmp.write(content)
        tmp_path = tmp.name
    try:
        text = sniff_and_extract_text(tmp_path, file.filename) or ""
        if not text:
            content_type = file.content_type or 'application/octet-stream'
            file.file.seek(0)
            raw = file.file.read()
            text = extract_text_via_tika(raw, content_type, file.filename)
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass
    return text


@router.post("/hr", response_model=HRMatchResponse)
def match_hr(
    payload: HRMatchRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role != UserRole.hr:
        raise HTTPException(status_code=403, detail="Only HR can use this endpoint")
    if not payload.cv_ids:
        raise HTTPException(status_code=400, detail="cv_ids is required")

    cvs = db.query(CV).filter(CV.id.in_(payload.cv_ids), CV.owner_id == user.id).all()
    id_to_cv = {cv.id: cv for cv in cvs}
    
    # Pull LLM config for this user to set model card and API key
    llm_config = db.query(LLMConfig).filter(LLMConfig.user_id == user.id).first()
    results = []
    
    for cv_id in payload.cv_ids:
        cv = id_to_cv.get(cv_id)
        if not cv:
            continue
        # Use agent-based structured scoring, configured by user's LLM settings if available
        if llm_config and llm_config.llm_api_key:
            score = compute_similarity_score(
                cv.content_text or "",
                payload.jd_text,
                llm_provider=str(llm_config.llm_provider.value if hasattr(llm_config.llm_provider, 'value') else llm_config.llm_provider),
                llm_model_name=llm_config.llm_model_name,
                api_key=llm_config.llm_api_key,
            )
        else:
            score = compute_similarity_score(cv.content_text or "", payload.jd_text)
        
        results.append(HRMatchItem(cv_id=cv.id, filename=cv.filename, score=score))
    
    results.sort(key=lambda x: x.score, reverse=True)
    return HRMatchResponse(results=results)


router_matching = APIRouter(prefix="/matching", tags=["matching"])


@router_matching.get("/collections", response_model=List[CollectionResponse])
async def get_collections(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all CV collections for the current user"""
    if current_user.role != "hr":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR users can access collections"
        )
    
    collections = db.query(CVCollection).filter(
        CVCollection.owner_id == current_user.id
    ).all()
    
    result = []
    for collection in collections:
        # Get CVs for this collection
        cvs = db.query(CV).filter(CV.collection_id == collection.id).all()
        
        cv_list = []
        for cv in cvs:
            parsed_metadata = None
            if cv.parsed_metadata:
                try:
                    parsed_metadata = json.loads(cv.parsed_metadata)
                except json.JSONDecodeError:
                    parsed_metadata = {}
            
            cv_list.append({
                "id": cv.id,
                "filename": cv.filename,
                "uploaded_at": cv.created_at.isoformat(),
                "parsed_metadata": parsed_metadata
            })
        
        result.append({
            "id": collection.id,
            "name": collection.name,
            "description": collection.description,
            "created_at": collection.created_at.isoformat(),
            "cvs": cv_list
        })
    
    return result


@router_matching.post("/start")
async def start_matching(
    request: MatchingRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Start matching process for selected CVs"""
    if current_user.role != "hr":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR users can start matching"
        )
    
    if not request.cv_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one CV must be selected"
        )
    
    # Verify all CVs belong to the current user
    cvs = db.query(CV).filter(
        CV.id.in_(request.cv_ids),
        CV.owner_id == current_user.id
    ).all()
    
    if len(cvs) != len(request.cv_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Some CVs not found or not accessible"
        )
    
    # TODO: Implement actual matching logic here
    # For now, just return success
    return {
        "message": "Matching process started successfully",
        "cv_count": len(cvs),
        "cv_ids": request.cv_ids
    }

