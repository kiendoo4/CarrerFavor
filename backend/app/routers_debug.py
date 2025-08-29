from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .deps import get_db, get_current_user
from .models import CV, User


router = APIRouter(prefix="/debug", tags=["debug"])


@router.get("/list-cv")
def list_cv(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cvs = db.query(CV).filter(CV.owner_id == user.id).all()
    return [{"id": cv.id, "filename": cv.filename} for cv in cvs]

