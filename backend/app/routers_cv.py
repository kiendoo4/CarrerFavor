import os
import tempfile
import json
from io import BytesIO
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
import base64

from .deps import get_db, get_current_user
from .models import CV, User, UserRole, CVCollection
from .schemas import (
    CVUploadResponse, CVListResponse, CVListItem,
    CVCollectionCreate, CVCollectionUpdate, CVCollectionItem,
    CVCollectionListResponse, CVCollectionDetailResponse
)
from .minio_client import get_minio_client
from .config import settings
from .text_extract import sniff_and_extract_text
from .tika_client import extract_text_via_tika

from .embedding_service import embedding_service


router = APIRouter(prefix="/cv", tags=["cv"])


# CV Collection endpoints
@router.post("/collections", response_model=CVCollectionItem)
async def create_collection(
    collection: CVCollectionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new CV collection"""
    if current_user.role != UserRole.hr:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR users can create collections"
        )
    
    db_collection = CVCollection(
        owner_id=current_user.id,
        name=collection.name,
        description=collection.description
    )
    
    db.add(db_collection)
    db.commit()
    db.refresh(db_collection)
    
    return CVCollectionItem(
        id=db_collection.id,
        name=db_collection.name,
        description=db_collection.description,
        created_at=db_collection.created_at,
        updated_at=db_collection.updated_at,
        cv_count=0
    )


@router.get("/collections", response_model=CVCollectionListResponse)
async def list_collections(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all CV collections for the current user"""
    collections = db.query(CVCollection).filter(
        CVCollection.owner_id == current_user.id
    ).all()
    
    result = []
    for collection in collections:
        cv_count = db.query(CV).filter(CV.collection_id == collection.id).count()
        result.append(CVCollectionItem(
            id=collection.id,
            name=collection.name,
            description=collection.description,
            created_at=collection.created_at,
            updated_at=collection.updated_at,
            cv_count=cv_count
        ))
    
    return CVCollectionListResponse(collections=result)


@router.get("/collections/{collection_id}", response_model=CVCollectionDetailResponse)
async def get_collection(
    collection_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific CV collection with its CVs"""
    collection = db.query(CVCollection).filter(
        CVCollection.id == collection_id,
        CVCollection.owner_id == current_user.id
    ).first()
    
    if not collection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection not found"
        )
    
    cvs = db.query(CV).filter(CV.collection_id == collection_id).all()
    
    cv_list = []
    for cv in cvs:
        parsed_metadata = None
        if cv.parsed_metadata:
            try:
                parsed_metadata = json.loads(cv.parsed_metadata)
            except json.JSONDecodeError:
                parsed_metadata = {}
        
        cv_list.append(CVListItem(
            id=cv.id,
            filename=cv.filename,
            uploaded_at=cv.created_at,
            parsed_metadata=parsed_metadata,
            collection_id=cv.collection_id
        ))
    
    return CVCollectionDetailResponse(
        id=collection.id,
        name=collection.name,
        description=collection.description,
        created_at=collection.created_at,
        updated_at=collection.updated_at,
        cvs=cv_list
    )


@router.put("/collections/{collection_id}")
async def update_collection(
    collection_id: int,
    collection_update: CVCollectionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a CV collection"""
    collection = db.query(CVCollection).filter(
        CVCollection.id == collection_id,
        CVCollection.owner_id == current_user.id
    ).first()
    
    if not collection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection not found"
        )
    
    collection.name = collection_update.name
    collection.description = collection_update.description
    
    db.commit()
    db.refresh(collection)
    
    return {"message": "Collection updated successfully"}


@router.delete("/collections/{collection_id}")
async def delete_collection(
    collection_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a CV collection"""
    collection = db.query(CVCollection).filter(
        CVCollection.id == collection_id,
        CVCollection.owner_id == current_user.id
    ).first()
    
    if not collection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection not found"
        )
    
    # Remove collection_id from all CVs in this collection
    db.query(CV).filter(CV.collection_id == collection_id).update({
        CV.collection_id: None
    })
    
    db.delete(collection)
    db.commit()
    
    return {"message": "Collection deleted successfully"}


@router.put("/{cv_id}/collection/{collection_id}")
async def assign_cv_to_collection(
    cv_id: int,
    collection_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Assign a CV to a collection"""
    # Check if CV exists and belongs to user
    cv = db.query(CV).filter(
        CV.id == cv_id,
        CV.owner_id == current_user.id
    ).first()
    
    if not cv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CV not found"
        )
    
    # Check if collection exists and belongs to user
    collection = db.query(CVCollection).filter(
        CVCollection.id == collection_id,
        CVCollection.owner_id == current_user.id
    ).first()
    
    if not collection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection not found"
        )
    
    cv.collection_id = collection_id
    db.commit()
    
    return {"message": "CV assigned to collection successfully"}


@router.delete("/{cv_id}/collection")
async def remove_cv_from_collection(
    cv_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a CV from its collection"""
    cv = db.query(CV).filter(
        CV.id == cv_id,
        CV.owner_id == current_user.id
    ).first()
    
    if not cv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CV not found"
        )
    
    cv.collection_id = None
    db.commit()
    
    return {"message": "CV removed from collection successfully"}


# Original CV endpoints with collection support
@router.post("/upload", response_model=CVUploadResponse)
def upload_cv(
    file: UploadFile = File(...),
    collection_id: int = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role != UserRole.hr:
        raise HTTPException(status_code=403, detail="Only HR can upload and store CVs")

    # Validate collection_id if provided
    if collection_id is not None:
        collection = db.query(CVCollection).filter(
            CVCollection.id == collection_id,
            CVCollection.owner_id == user.id
        ).first()
        if not collection:
            raise HTTPException(status_code=404, detail="CV collection not found")

    # Save to temp and extract text
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        content = file.file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        extracted = sniff_and_extract_text(tmp_path, file.filename)
        if not extracted:
            extracted = extract_text_via_tika(content, file.content_type, file.filename)
        if not extracted:
            extracted = f"Could not extract text from {file.filename}. File may be corrupted or in unsupported format."
        
        # Clean text: remove NUL characters and other problematic characters
        if extracted:
            extracted = extracted.replace('\x00', '')  # Remove NUL characters
            extracted = ''.join(char for char in extracted if ord(char) >= 32 or char in '\n\r\t')  # Keep only printable chars
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass

    client = get_minio_client()
    object_key = f"user-{user.id}/{file.filename}"
    # Upload file bytes to MinIO
    client.put_object(
        bucket_name=settings.minio_bucket,
        object_name=object_key,
        data=BytesIO(content),
        length=len(content),
        content_type=file.content_type or "application/octet-stream",
    )

    cv = CV(
        owner_id=user.id, 
        filename=file.filename, 
        object_key=object_key, 
        content_text=extracted,
        collection_id=collection_id
    )
    db.add(cv)
    db.commit()
    db.refresh(cv)
    return cv


@router.get("/list", response_model=CVListResponse)
def list_cvs(
    collection_id: int = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role != UserRole.hr:
        raise HTTPException(status_code=403, detail="Only HR can list CVs")
    
    query = db.query(CV).filter(CV.owner_id == user.id)
    
    if collection_id is not None:
        query = query.filter(CV.collection_id == collection_id)
    
    cvs = query.order_by(CV.created_at.desc()).all()
    cv_items = []
    for cv in cvs:
        # Parse JSON metadata if exists
        parsed_metadata = None
        if cv.parsed_metadata:
            try:
                import json
                parsed_metadata = json.loads(cv.parsed_metadata)
            except (json.JSONDecodeError, TypeError):
                parsed_metadata = None
        
        cv_items.append(CVListItem(
            id=cv.id,
            filename=cv.filename,
            uploaded_at=cv.created_at,
            parsed_metadata=parsed_metadata,
            collection_id=cv.collection_id
        ))
    
    return CVListResponse(cvs=cv_items, total=len(cv_items))


@router.delete("/{cv_id}")
def delete_cv(
    cv_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role != UserRole.hr:
        raise HTTPException(status_code=403, detail="Only HR can delete CVs")
    
    cv = db.query(CV).filter(CV.id == cv_id, CV.owner_id == user.id).first()
    if not cv:
        raise HTTPException(status_code=404, detail="CV not found")
    
    # Delete from MinIO
    try:
        client = get_minio_client()
        client.remove_object(bucket_name=settings.minio_bucket, object_name=cv.object_key)
        print(f"Successfully deleted from MinIO: {cv.object_key}")
    except Exception as e:
        print(f"Failed to delete from MinIO: {cv.object_key}, error: {e}")
        pass  # Continue even if MinIO deletion fails
    
    # Delete from database
    db.delete(cv)
    db.commit()
    
    return {"message": "CV deleted successfully"}


@router.get("/{cv_id}/content")
def get_cv_content(
    cv_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role != UserRole.hr:
        raise HTTPException(status_code=403, detail="Only HR can view CV content")
    
    cv = db.query(CV).filter(CV.id == cv_id, CV.owner_id == user.id).first()
    if not cv:
        raise HTTPException(status_code=404, detail="CV not found")
    
    # Parse JSON metadata if exists
    parsed_metadata = None
    if cv.parsed_metadata:
        try:
            import json
            parsed_metadata = json.loads(cv.parsed_metadata)
        except (json.JSONDecodeError, TypeError):
            parsed_metadata = None
    
    return {
        "id": cv.id,
        "filename": cv.filename,
        "content": cv.content_text,
        "created_at": cv.created_at.isoformat(),
        "parsed_metadata": parsed_metadata
    }


@router.get("/{cv_id}/file")
def get_cv_file(
    cv_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role != UserRole.hr:
        raise HTTPException(status_code=403, detail="Only HR can view CV files")
    
    cv = db.query(CV).filter(CV.id == cv_id, CV.owner_id == user.id).first()
    if not cv:
        raise HTTPException(status_code=404, detail="CV not found")
    
    try:
        client = get_minio_client()
        # Get file from MinIO
        file_data = client.get_object(bucket_name=settings.minio_bucket, object_name=cv.object_key)
        
        # Determine content type based on file extension
        file_ext = cv.filename.lower().split('.')[-1]
        content_type_map = {
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'txt': 'text/plain',
            'rtf': 'application/rtf'
        }
        content_type = content_type_map.get(file_ext, 'application/octet-stream')
        
        # Read file data
        file_bytes = file_data.read()
        
        return Response(
            content=file_bytes,
            media_type=content_type,
            headers={
                "Content-Disposition": f"inline; filename={cv.filename}",
                "Cache-Control": "no-cache"
            }
        )
        
    except Exception as e:
        print(f"Error serving file: {e}")
        # Check if it's a NoSuchKey error (file doesn't exist in MinIO)
        if "NoSuchKey" in str(e) or "does not exist" in str(e):
            raise HTTPException(status_code=404, detail="File not found in storage")
        raise HTTPException(status_code=500, detail="Failed to serve file")


@router.get("/{cv_id}/view")
def view_cv_file(
    cv_id: int,
    db: Session = Depends(get_db),
):
    # Less secure endpoint for iframe viewing
    cv = db.query(CV).filter(CV.id == cv_id).first()
    if not cv:
        raise HTTPException(status_code=404, detail="CV not found")
    
    try:
        client = get_minio_client()
        # Get file from MinIO
        file_data = client.get_object(bucket_name=settings.minio_bucket, object_name=cv.object_key)
        
        # Determine content type based on file extension
        file_ext = cv.filename.lower().split('.')[-1]
        content_type_map = {
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'txt': 'text/plain',
            'rtf': 'application/rtf'
        }
        content_type = content_type_map.get(file_ext, 'application/octet-stream')
        
        # Read file data
        file_bytes = file_data.read()
        
        # For PDF files, return as inline
        if file_ext == 'pdf':
            return Response(
                content=file_bytes,
                media_type=content_type,
                headers={
                    "Content-Disposition": f"inline; filename={cv.filename}",
                    "Cache-Control": "no-cache"
                }
            )
        else:
            # For other files, return base64 encoded data
            import base64
            encoded_data = base64.b64encode(file_bytes).decode('utf-8')
            data_url = f"data:{content_type};base64,{encoded_data}"
            return {"data_url": data_url, "filename": cv.filename, "content_type": content_type}
        
    except Exception as e:
        print(f"Error serving file: {e}")
        # Check if it's a NoSuchKey error (file doesn't exist in MinIO)
        if "NoSuchKey" in str(e) or "does not exist" in str(e):
            raise HTTPException(status_code=404, detail="File not found in storage")
        raise HTTPException(status_code=500, detail="Failed to serve file")


class UploadFileSpooled:
    def __init__(self, upload_file: UploadFile, raw_bytes: bytes):
        self._bytes = raw_bytes
        self._offset = 0

    def read(self, size=-1):
        if size == -1:
            size = len(self._bytes) - self._offset
        start = self._offset
        end = min(len(self._bytes), self._offset + size)
        self._offset = end
        return self._bytes[start:end]

