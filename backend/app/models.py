from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from .db import Base


class UserRole(str, enum.Enum):
    candidate = "candidate"
    hr = "hr"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.candidate)
    avatar_path = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    cvs = relationship("CV", back_populates="owner")
    cv_collections = relationship("CVCollection", back_populates="owner")


class CVCollection(Base):
    __tablename__ = "cv_collections"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    owner = relationship("User", back_populates="cv_collections")
    cvs = relationship("CV", back_populates="collection")


class CV(Base):
    __tablename__ = "cvs"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    collection_id = Column(Integer, ForeignKey("cv_collections.id"), nullable=True, index=True)
    filename = Column(String(512), nullable=False)
    object_key = Column(String(1024), nullable=False)
    content_text = Column(Text, nullable=True)
    embedding_vector = Column(Text, nullable=True)  # JSON string
    parsed_metadata = Column(Text, nullable=True)   # JSON string
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    owner = relationship("User", back_populates="cvs")
    collection = relationship("CVCollection", back_populates="cvs")


class LLMProvider(str, enum.Enum):
    openai = "openai"
    gemini = "gemini"
    ollama = "ollama"


class EmbeddingProvider(str, enum.Enum):
    local = "local"
    openai = "openai"
    gemini = "gemini"


class LLMConfig(Base):
    __tablename__ = "llm_configs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    # LLM settings
    llm_provider = Column(Enum(LLMProvider), nullable=False, default=LLMProvider.openai)
    llm_api_key = Column(String(2048), nullable=True)
    llm_model_name = Column(String(256), nullable=False, default="gpt-4o-mini")
    llm_temperature = Column(Float, nullable=False, default=0.2)
    llm_top_p = Column(Float, nullable=False, default=1.0)
    llm_max_tokens = Column(Integer, nullable=False, default=1024)
    ollama_base_url = Column(String(512), nullable=True)
    # Embedding settings
    embedding_provider = Column(Enum(EmbeddingProvider), nullable=False, default=EmbeddingProvider.local)
    embedding_api_key = Column(String(2048), nullable=True)
    embedding_model_name = Column(String(256), nullable=False, default="paraphrase-multilingual-MiniLM-L12-v2")
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

