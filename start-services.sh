#!/bin/bash

# Start Docker Services (PostgreSQL, MinIO, Tika)
echo "Starting Docker Services..."

# Start services
docker compose up -d

echo "Services started:"
echo "- PostgreSQL: localhost:5432"
echo "- MinIO: localhost:9000 (API), localhost:9001 (Console)"
echo "- Tika: localhost:9998"
echo ""
echo "Now you can run:"
echo "./start-backend.sh  # In one terminal"
echo "./start-frontend.sh # In another terminal" 