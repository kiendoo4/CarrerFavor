from minio import Minio
from minio.error import S3Error
from .config import settings


def get_minio_client() -> Minio:
    client = Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
    )
    # Ensure bucket exists
    found = client.bucket_exists(settings.minio_bucket)
    if not found:
        client.make_bucket(settings.minio_bucket)
    return client

