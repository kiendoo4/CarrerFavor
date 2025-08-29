# CarrerFavor

A comprehensive CV and job description matching system with AI-powered evaluation capabilities.

## Quickstart

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for local development)
- Python 3.9+ (for local development)

### Option 1: Docker (Recommended)

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd LLM_final_project
   ```

2. **Start all services**
   ```bash
   docker-compose up -d
   ```

3. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000

### Option 2: Local Development

1. **Backend Setup**
   ```bash
   cd backend
   pip install -r requirements.txt
   python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000

## 📋 Features

### For Candidates
- Upload CV files (PDF, DOC, TXT) or paste text
- Upload job descriptions or paste text
- Get AI-powered matching scores and analysis
- View detailed evaluation results

### For HR Users
- **CV Management**: Organize CVs into collections
- **CV Upload**: Bulk upload and parse CV files
- **Matching Engine**: Match CVs against job descriptions
- **Evaluation**: AI-powered CV evaluation and scoring

## 🔧 Configuration

### Environment Variables
Create `.env` files in both `backend/` and `frontend/` directories:

**Backend (.env)**
```env
DATABASE_URL=postgresql://user:password@localhost/dbname
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=your_access_key
MINIO_SECRET_KEY=your_secret_key
JWT_SECRET=your_jwt_secret
```

**Frontend (.env)**
```env
VITE_API_BASE_URL=http://localhost:8000
```

## 🛠️ Development

### Project Structure
```
LLM_final_project/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── models/         # ML models
│   │   ├── routers_*.py    # API routes
│   │   └── main.py         # FastAPI app
│   └── requirements.txt
├── frontend/               # React + TypeScript frontend
│   ├── src/
│   │   ├── ui/
│   │   │   ├── auth/       # Authentication pages
│   │   │   ├── candidate/  # Candidate features
│   │   │   └── hr/         # HR features
│   │   └── main.tsx
│   └── package.json
└── docker-compose.yml
```

### API Endpoints

**Authentication**
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `GET /auth/me` - Get current user

**CV Management**
- `POST /cv/upload` - Upload CV file
- `GET /cv/collections` - Get CV collections
- `POST /cv/collections` - Create collection

**Matching & Evaluation**
- `POST /match/start` - Start CV-job matching
- `GET /match/results/{id}` - Get matching results

## 🐳 Docker Services

- **Frontend**: React app on port 3000
- **Backend**: FastAPI on port 8000
- **PostgreSQL**: Database on port 5432
- **MinIO**: File storage on port 9000
- **Redis**: Caching on port 6379

## 📝 Usage

1. **Register/Login**: Create account or sign in
2. **Upload CVs**: Use CV Management to organize CVs
3. **Create Job Description**: Upload or paste job requirements
4. **Run Matching**: Select CVs and job description for evaluation
5. **View Results**: Analyze matching scores and AI insights

## 🔍 Troubleshooting

**Common Issues:**
- Port conflicts: Check if ports 3000, 8000, 5432, 9000, 6379 are available
- Docker issues: Run `docker-compose down && docker-compose up -d`
- Frontend build: Clear node_modules and reinstall dependencies

**Logs:**
```bash
# View all logs
docker-compose logs

# View specific service logs
docker-compose logs backend
docker-compose logs frontend
```

## 📄 License

[Your License Here]

---

**Need Help?** Check the logs or create an issue in the repository.