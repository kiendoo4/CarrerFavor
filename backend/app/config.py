from pydantic import BaseModel
import os


class Settings(BaseModel):
    database_url: str = os.getenv("DATABASE_URL", "postgresql+psycopg2://postgres:postgres@localhost:5432/resume_matcher")
    jwt_secret: str = os.getenv("JWT_SECRET", "changeme")
    cors_origins: str = os.getenv("CORS_ORIGINS", "*")

    minio_endpoint: str = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    minio_access_key: str = os.getenv("MINIO_ACCESS_KEY", "minio")
    minio_secret_key: str = os.getenv("MINIO_SECRET_KEY", "minio12345")
    minio_bucket: str = os.getenv("MINIO_BUCKET", "cv-storage")
    minio_secure: bool = os.getenv("MINIO_SECURE", "false").lower() == "true"
    tika_url: str = os.getenv("TIKA_URL", "http://localhost:9998/tika")
    presidio_analyzer_url: str = os.getenv("PRESIDIO_ANALYZER_URL", "http://localhost:3000")
    presidio_anonymizer_url: str = os.getenv("PRESIDIO_ANONYMIZER_URL", "http://localhost:3001")


settings = Settings()

