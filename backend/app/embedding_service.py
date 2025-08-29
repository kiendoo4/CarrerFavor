import json
import os
import requests
from typing import List, Optional
import numpy as np
from sentence_transformers import SentenceTransformer
from .models import EmbeddingProvider

class EmbeddingService:
    def __init__(self):
        self._local_model = None
    
    def get_local_model(self) -> SentenceTransformer:
        """Get or initialize the local sentence transformer model"""
        if self._local_model is None:
            # Prefer a local checked-in model directory if present
            env_model_dir = os.getenv("LOCAL_EMBEDDING_MODEL_DIR")
            default_local_dir = os.path.join(
                os.path.dirname(__file__),
                "models",
                "paraphrase-multilingual-MiniLM-L12-v2",
            )

            if env_model_dir and os.path.isdir(env_model_dir):
                self._local_model = SentenceTransformer(env_model_dir)
            elif os.path.isdir(default_local_dir):
                self._local_model = SentenceTransformer(default_local_dir)
            else:
                # Fallback: fetch from Hugging Face once (cached/mounted)
                model_name = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
                self._local_model = SentenceTransformer(model_name)
        return self._local_model
    
    def embed_text(self, text: str, provider: EmbeddingProvider, api_key: Optional[str] = None, model_name: Optional[str] = None) -> List[float]:
        """Generate embedding for text using specified provider"""
        if provider == EmbeddingProvider.local:
            return self._embed_local(text)
        elif provider == EmbeddingProvider.gemini:
            return self._embed_gemini(text, api_key, model_name)
        elif provider == EmbeddingProvider.openai:
            return self._embed_openai(text, api_key, model_name)
        else:
            raise ValueError(f"Unsupported embedding provider: {provider}")
    
    def _embed_local(self, text: str) -> List[float]:
        """Generate embedding using local sentence-transformers model"""
        model = self.get_local_model()
        embedding = model.encode([text])
        return embedding[0].tolist()
    
    def _embed_gemini(self, text: str, api_key: str, model_name: Optional[str] = None) -> List[float]:
        """Generate embedding using Gemini API"""
        if not api_key:
            raise ValueError("API key required for Gemini embeddings")
        
        model = model_name or "models/text-embedding-004"
        url = f"https://generativelanguage.googleapis.com/v1beta/{model}:embedContent?key={api_key}"
        
        headers = {"Content-Type": "application/json"}
        data = {
            "content": {
                "parts": [{"text": text}]
            }
        }
        
        response = requests.post(url, headers=headers, json=data, timeout=30)
        response.raise_for_status()
        
        result = response.json()
        return result["embedding"]["values"]
    
    def _embed_openai(self, text: str, api_key: str, model_name: Optional[str] = None) -> List[float]:
        """Generate embedding using OpenAI API"""
        if not api_key:
            raise ValueError("API key required for OpenAI embeddings")
        
        model = model_name or "text-embedding-3-small"
        url = "https://api.openai.com/v1/embeddings"
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        data = {
            "input": text,
            "model": model
        }
        
        response = requests.post(url, headers=headers, json=data, timeout=30)
        response.raise_for_status()
        
        result = response.json()
        return result["data"][0]["embedding"]
    
    def cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors"""
        a = np.array(vec1)
        b = np.array(vec2)
        
        dot_product = np.dot(a, b)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        
        if norm_a == 0 or norm_b == 0:
            return 0.0
        
        return float(dot_product / (norm_a * norm_b))
    
    def find_similar_cvs(self, query_embedding: List[float], cv_embeddings: List[tuple], top_k: int = 10) -> List[tuple]:
        """Find most similar CVs based on embeddings
        
        Args:
            query_embedding: Embedding vector of the query (JD)
            cv_embeddings: List of tuples (cv_id, embedding_vector)
            top_k: Number of top results to return
            
        Returns:
            List of tuples (cv_id, similarity_score) sorted by similarity desc
        """
        similarities = []
        
        for cv_id, cv_embedding in cv_embeddings:
            if cv_embedding:
                similarity = self.cosine_similarity(query_embedding, cv_embedding)
                similarities.append((cv_id, similarity))
        
        # Sort by similarity score descending
        similarities.sort(key=lambda x: x[1], reverse=True)
        return similarities[:top_k]

# Global embedding service instance
embedding_service = EmbeddingService()