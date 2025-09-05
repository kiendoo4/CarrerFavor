import requests
from typing import List, Dict, Any
from .config import settings


def analyze_pii(text: str, language: str = "en") -> List[Dict[str, Any]]:
    url = f"{settings.presidio_analyzer_url}/analyze"
    payload = {
        "text": text,
        "language": language
    }
    resp = requests.post(url, json=payload, timeout=30)
    resp.raise_for_status()
    return resp.json() or []


def anonymize_text(text: str, analyzer_results: List[Dict[str, Any]]) -> str:
    url = f"{settings.presidio_anonymizer_url}/anonymize"
    payload = {
        "text": text,
        "analyzer_results": analyzer_results
    }
    resp = requests.post(url, json=payload, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    # API returns {"text": "anonymized"}
    return data.get("text", "")


def analyze_and_anonymize(text: str, language: str = "en") -> str:
    if not text:
        return ""
    findings = analyze_pii(text, language=language)
    return anonymize_text(text, findings)

