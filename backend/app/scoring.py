import asyncio
from typing import Dict

# Delegate scoring to the ADK agent's structured extraction + rule-based scoring
from .adk_agent.agent import run_resume_scoring_agent


def compute_similarity_score(cv_text: str, jd_text: str, llm_provider: str = None, llm_model_name: str = None, api_key: str = None, ollama_base_url: str = None) -> float:
    """Compute match score using the agent's compute_relevant_score pipeline.
    Returns a float in [0,1].
    """
    # Run the async agent in a synchronous context
    result: Dict[str, float] = asyncio.run(
        run_resume_scoring_agent(cv_text or "", jd_text or "", llm_provider, llm_model_name, api_key, ollama_base_url)
    )
    score = result.get("score", 0.0) if isinstance(result, dict) else 0.0
    return float(round(score, 4))


def compute_similarity_score_detailed(cv_text: str, jd_text: str, llm_provider: str = None, llm_model_name: str = None, api_key: str = None, ollama_base_url: str = None) -> Dict[str, float]:
    """Compute match score using the agent's compute_relevant_score pipeline.
    Returns detailed scores dictionary.
    """
    # Run the async agent in a synchronous context
    result: Dict[str, float] = asyncio.run(
        run_resume_scoring_agent(cv_text or "", jd_text or "", llm_provider, llm_model_name, api_key, ollama_base_url)
    )
    return result if isinstance(result, dict) else {"score": 0.0}

