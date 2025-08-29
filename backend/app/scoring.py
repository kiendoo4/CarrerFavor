from typing import List
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def compute_similarity_score(cv_text: str, jd_text: str) -> float:
    texts: List[str] = [cv_text or "", jd_text or ""]
    vectorizer = TfidfVectorizer(stop_words="english")
    tfidf_matrix = vectorizer.fit_transform(texts)
    sim = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])
    score = float(sim[0][0])
    return round(score, 4)

