from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from .models import UserRole, LLMProvider


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: UserRole


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class ChangePassword(BaseModel):
    current_password: str
    new_password: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
    role: UserRole
    created_at: datetime
    avatar_path: Optional[str] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class CVCollectionCreate(BaseModel):
    name: str
    description: Optional[str] = None


class CVCollectionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class CVCollectionItem(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    cv_count: int = 0

    class Config:
        from_attributes = True


class CVCollectionListResponse(BaseModel):
    collections: List[CVCollectionItem]


class CVCollectionDetailResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    cvs: List["CVListItem"]

    class Config:
        from_attributes = True


class CVUploadResponse(BaseModel):
    id: int
    filename: str
    object_key: str
    created_at: datetime

    class Config:
        from_attributes = True


class CVListItem(BaseModel):
    id: int
    filename: str
    uploaded_at: datetime
    parsed_metadata: Optional[dict] = None
    collection_id: Optional[int] = None

    class Config:
        from_attributes = True


class CVListResponse(BaseModel):
    cvs: List[CVListItem]


class MatchRequestSingle(BaseModel):
    cv_text: Optional[str] = None
    jd_text: Optional[str] = None


class MatchScore(BaseModel):
    score: float


class HRMatchRequest(BaseModel):
    cv_ids: List[int]
    jd_text: str


class HRMatchItem(BaseModel):
    cv_id: int
    filename: str
    score: float


class HRMatchResponse(BaseModel):
    results: List[HRMatchItem]


class LLMConfigIn(BaseModel):
    llm_provider: LLMProvider
    llm_api_key: str
    llm_model_name: str
    llm_temperature: float = 0.2
    llm_top_p: float = 1.0
    llm_max_tokens: int = 1024
    embedding_provider: str = "local"
    embedding_api_key: Optional[str] = None
    embedding_model_name: str = "paraphrase-multilingual-MiniLM-L12-v2"


class LLMConfigOut(BaseModel):
    llm_provider: LLMProvider
    llm_model_name: str
    llm_temperature: float
    llm_top_p: float
    llm_max_tokens: int
    embedding_provider: str
    embedding_model_name: str


class CVParsedField(BaseModel):
    name: str
    value: str


class CVParseResponse(BaseModel):
    fields: List[CVParsedField]


class CVItem(BaseModel):
    id: int
    filename: str
    uploaded_at: str
    parsed_metadata: Optional[dict] = None


class CollectionResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_at: str
    cvs: List[CVItem]


class MatchingRequest(BaseModel):
    cv_ids: List[int]

