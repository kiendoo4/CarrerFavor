import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import Optional

from .deps import get_db, get_current_user
from .models import User, UserRole
from .schemas import UserCreate, UserLogin, UserOut, Token, ChangePassword
from .security import create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from .minio_client import get_minio_client
from .config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)


@router.post("/register", response_model=UserOut)
def register(user: UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    hashed_password = get_password_hash(user.password)
    db_user = User(
        email=user.email,
        password_hash=hashed_password,
        role=user.role
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    # Find user by email
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
def get_current_user_info(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Refresh user data from database to get latest avatar_path
    db.refresh(current_user)
    return current_user


@router.post("/change-password")
def change_password(
    password_data: ChangePassword,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify current password
    if not verify_password(password_data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Hash new password
    new_password_hash = get_password_hash(password_data.new_password)
    
    # Update password
    current_user.password_hash = new_password_hash
    db.commit()
    
    return {"message": "Password changed successfully"}


@router.post("/avatar")
def upload_avatar(
    avatar: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Validate file type
    if not avatar.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Validate file size (max 5MB)
    if avatar.size > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size must be less than 5MB")
    
    # Upload to MinIO
    client = get_minio_client()
    object_key = f"avatars/user-{current_user.id}/{avatar.filename}"
    
    try:
        content = avatar.file.read()
        from io import BytesIO
        content_stream = BytesIO(content)
        client.put_object(
            bucket_name=settings.minio_bucket,
            object_name=object_key,
            data=content_stream,
            length=len(content),
            content_type=avatar.content_type,
        )
        
        # Update user avatar path in database
        current_user.avatar_path = object_key
        db.commit()
        
        return {"message": "Avatar uploaded successfully", "avatar_path": object_key}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload avatar: {str(e)}")


@router.get("/avatar/{user_id}")
def get_avatar(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.avatar_path:
        # Return default avatar
        return {"avatar_url": "/default_avatar/default.jpeg"}
    
    # Generate presigned URL for MinIO
    client = get_minio_client()
    try:
        url = client.presigned_get_object(
            bucket_name=settings.minio_bucket,
            object_name=user.avatar_path,
            expires=timedelta(hours=1)
        )
        return {"avatar_url": url}
    except Exception as e:
        # Fallback to default avatar
        return {"avatar_url": "/default_avatar/default.jpeg"}

