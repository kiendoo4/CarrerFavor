#!/bin/bash

# Start Frontend
echo "Starting Frontend..."

# Set environment variables
export VITE_API_BASE_URL="http://localhost:8000"

# Install dependencies if needed
if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
fi

# Start the frontend
cd frontend
npm run dev 