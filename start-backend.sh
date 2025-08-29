#!/bin/bash

# Start Backend
echo "Starting Backend..."

# Set environment variables
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/resume_matcher"
export JWT_SECRET="supersecretjwt"
export CORS_ORIGINS="*"
export MINIO_ENDPOINT="localhost:9000"
export MINIO_ACCESS_KEY="minio"
export MINIO_SECRET_KEY="minio12345"
export MINIO_BUCKET="cv-storage"
export MINIO_SECURE="false"
export TIKA_URL="http://localhost:9998/tika"
export TRANSFORMERS_CACHE="./hf_cache"
export HUGGINGFACE_HUB_CACHE="./hf_cache"
export SENTENCE_TRANSFORMERS_HOME="./st_cache"
export LOCAL_EMBEDDING_MODEL_DIR="./backend/app/models/paraphrase-multilingual-MiniLM-L12-v2"

# Activate virtual environment if it exists
if [ -d ".venv" ]; then
    echo "Activating virtual environment..."
    source .venv/bin/activate
fi

# Install dependencies if needed
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r backend/requirements.txt
fi

# Start the backend
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload 