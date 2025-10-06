from google.adk.agents import LlmAgent, SequentialAgent
from google.adk.models.lite_llm import LiteLlm
from google.adk.sessions import InMemorySessionService
from google.adk.tools import FunctionTool
from google.adk.runners import Runner
from google.genai import types
from copy import deepcopy
import re
from typing import Dict, Any, List, Optional
import os, asyncio
import time, json
from dotenv import load_dotenv
load_dotenv()

extract_JD_skills_agent = LlmAgent(
    name = "extract_JD_skills_agent",
    instruction = """
You are an assistant that extracts key requirements from a Job Description (JD).

Input:
- The raw JD text, which may include job title, responsibilities, qualifications, requirements, benefits, etc.

Requirements:
- Extract only the requirement indicators, not the descriptive text.  
- Indicators include (but are not limited to):  
  - must_have: mandatory skills, qualifications, or requirements (weight = 2)  
  - nice_to_have: preferred or optional skills, qualifications, or requirements (weight = 1)  
  - years_experience  
  - education_level  
  - languages  

- Output must be in structured JSON format:
{
  "must_have": ["..."],
  "nice_to_have": ["..."],
  "years_experience": "X years",
  "education_level": "...",
  "languages": ["..."]
}

- If an indicator is not found in the JD, return an empty string "" or empty list [] for that field.
""",
output_key = "jd_skills"
)   


extract_resume_skills_agent = LlmAgent(
    name = "extract_resume_skills_agent",
    instruction = """
You are an assistant that matches a candidate's Resume (CV) against the requirement indicators extracted from a JD.

Input:
- The JSON output from extract_JD_agent, which contains requirement indicators.  
- The raw Resume (CV) text, which may include experiences, education, skills, projects, etc.

Requirements:
- For each indicator from the JD, check if the candidate's CV meets or contains it.  
- Normalize variations (e.g., "Master" ≈ "MSc", "Bachelor" ≈ "BSc", "NLP" ≈ "Natural Language Processing").  
- Return only the subset of JD indicators that are actually satisfied in the CV.  
- Output must use the same JSON schema as the JD agent:
{
  "must_have": ["..."],
  "nice_to_have": ["..."],
  "years_experience": "X years",
  "education_level": "...",
  "languages": ["..."]
}
""",
output_key = "resume_skills"
)

analyze_agent = LlmAgent(
    name = "analyze_agent",
    instruction = """
You are a recruitment specialist.

Your tasks:

1. If the user has not provided a CV or a JD, ask them to supply both (do not return JSON yet).

2. Once both CV and JD are available, always perform the following steps:
a) Call the tool build_cv_jd_match(cv, jd) to generate a matching analysis.
b) Call the tool generate_counterfactuals(match_report) using the output from step (a).
c) Call the tool validate_and_rank_counterfactuals(match_report, cv, jd) to enrich contrastive explanations.

3. Based on the results from (a), (b), and (c), produce a complete JSON report following the schema below. The field ats_check.score must be a numeric value between 0 and 100.

4. MANDATORY RULES:

- Always return ats_check.score as a number (0–100).
- If uncertain, use the ats_score_suggestion value from the build_cv_jd_match tool.
- Never leave the score empty or use text values like "Good".
- If information is missing, ask the user to provide it — do not guess.

5. Recommendation rule:
- recommendation must be "yes" if ats_check.score > 70, otherwise "no".

Output JSON schema:

{
  "strengths": [string],
  "weaknesses": [string],
  "edit_suggestions": [string],
  "score": number,
  "skills_analysis": {...},
  "experience_analysis": {...},
  "skill_balance": {...},
  "format_feedback": {...},
  "ats_check": {
    "Keywords": "string",
    "Formatting": "string",
    "Completeness": "string",
    "score": <number between 0 and 100>   // MANDATORY: numeric ATS score
  },
  "recommendation": "yes | no",
  "decision_rationale": {
    "main_reasons": [string],
    "key_missing_factors": [string]
  },
  "counterfactuals": [
    {
      "requirement": string,
      "suggested_change": string
    }
  ],
  "contrastive_explanations": [string],
  "decision_path": [string]
}

IMPORTANT: Always use real data from the provided CV and JD""",
output_key = "analyze_result"
)

def build_cv_jd_match(cv_or_cv_skills, jd_or_jd_skills) -> Dict[str, Any]:
    """
    Produce structured match results between CV & JD.

    Supports two input modes:
    - Structured indicators mode: pass dicts (outputs of the two extractor agents)
      with keys like must_have, nice_to_have, years_experience, education_level, languages.
    - Legacy text mode: pass raw strings (fallback to simple substring heuristics).
    """
    # Structured indicators path
    if isinstance(cv_or_cv_skills, dict) and isinstance(jd_or_jd_skills, dict):
        cv_skills: Dict[str, Any] = cv_or_cv_skills or {}
        jd_skills: Dict[str, Any] = jd_or_jd_skills or {}

        jd_must: List[str] = [str(x).lower() for x in jd_skills.get("must_have", [])]
        jd_nice: List[str] = [str(x).lower() for x in jd_skills.get("nice_to_have", [])]
        jd_langs: List[str] = [str(x).lower() for x in jd_skills.get("languages", [])]
        jd_years = jd_skills.get("years_experience")
        jd_edu = jd_skills.get("education_level")

        # Build weighted requirements list from indicators
        reqs: List[Dict[str, Any]] = []
        for name in jd_must:
            reqs.append({"name": name, "weight": 2.0, "must_have": True})
        for name in jd_nice:
            reqs.append({"name": name, "weight": 1.0, "must_have": False})
        for name in jd_langs:
            reqs.append({"name": f"lang:{name}", "weight": 0.5, "must_have": False})
        if jd_years:
            reqs.append({"name": "years_experience", "weight": 1.0, "must_have": False})
        if jd_edu:
            reqs.append({"name": "education_level", "weight": 0.8, "must_have": False})

        total_weight = sum(r.get("weight", 0.0) for r in reqs) or 1.0

        # Normalize weights to sum to 1.0 for consistent scoring
        jd_requirements: List[Dict[str, Any]] = []
        for r in reqs:
            jd_requirements.append({
                "name": r["name"],
                "weight": round(float(r["weight"]) / total_weight, 6),
                "must_have": bool(r.get("must_have", False))
            })

        # Prepare CV features
        cv_must: List[str] = [str(x).lower() for x in cv_skills.get("must_have", [])]
        cv_nice: List[str] = [str(x).lower() for x in cv_skills.get("nice_to_have", [])]
        cv_langs: List[str] = [str(x).lower() for x in cv_skills.get("languages", [])]
        cv_years = cv_skills.get("years_experience")
        cv_edu = cv_skills.get("education_level")
        cv_all_tokens = set(cv_must + cv_nice)

        def parse_years(text: Any) -> Optional[float]:
            try:
                s = str(text).lower()
                nums = [float(n) for n in re.findall(r"\d+(?:\.\d+)?", s)]
                return nums[0] if nums else None
            except Exception:
                return None

        match_results: List[Dict[str, Any]] = []
        cv_mentions: List[Dict[str, str]] = []

        for req in jd_requirements:
            name = req["name"]
            matched = False
            evidence = None

            if name.startswith("lang:"):
                lang = name.split(":", 1)[1]
                matched = lang in cv_langs
                if matched:
                    evidence = f"language '{lang}' present in CV"
            elif name == "years_experience":
                jd_y = parse_years(jd_years)
                cv_y = parse_years(cv_years)
                matched = (jd_y is None) or (cv_y is not None and cv_y >= jd_y)
                if matched and jd_y is not None and cv_y is not None:
                    evidence = f"CV years {cv_y} >= JD years {jd_y}"
            elif name == "education_level":
                matched = (not jd_edu) or (str(cv_edu).strip().lower() == str(jd_edu).strip().lower())
                if matched and jd_edu:
                    evidence = f"education '{cv_edu}' matches JD"
            else:
                matched = name in cv_all_tokens
                if matched:
                    evidence = f"skill '{name}' present in CV indicators"

            if matched and evidence:
                cv_mentions.append({"name": name, "context": evidence})

            match_results.append({
                "requirement": name,
                "weight": req["weight"],
                "must_have": req["must_have"],
                "matched": bool(matched),
                "evidence": evidence
            })

        raw_score = round(sum(r["weight"] for r in match_results if r["matched"]), 4)
        print("build_cv_jd_match (indicators) invoked. match_results:", json.dumps(match_results, ensure_ascii=False, indent=2))
        ats_score_suggestion = round(raw_score * 100, 2)
        return {
            "jd_requirements": jd_requirements,
            "cv_mentions": cv_mentions,
            "match_results": match_results,
            "raw_score": raw_score,
            "ats_score_suggestion": ats_score_suggestion,
        }

    # Legacy raw-text fallback removed: return empty structured result without mock data
    print("build_cv_jd_match: structured inputs not provided; returning empty match report (no mock).")
    return {
        "jd_requirements": [],
        "cv_mentions": [],
        "match_results": [],
        "raw_score": 0.0,
        "ats_score_suggestion": 0.0,
    }

# ---------------- NEW: Step 2 tool (Counterfactual & Contrastive) ----------------

def generate_counterfactuals(match_report: Dict[str, Any], top_k: int = 3) -> Dict[str, Any]:
    """
    Heuristic counterfactual generator.
    Input: match_report produced by build_cv_jd_match (dict).
    Output: counterfactuals, contrastive_explanations, and decision_path.
    This is intentionally conservative and deterministic for sandbox/testing.
    """
    # Basic guard
    if not match_report or "match_results" not in match_report:
        return {"error": "No match_report provided or bad format."}

    match_results = match_report["match_results"]
    raw_score = float(match_report.get("raw_score", 0.0))

    # Rank missing requirements by weight (impact)
    missing = [r for r in match_results if not r.get("matched", False)]
    missing_sorted = sorted(missing, key=lambda x: x.get("weight", 0.0), reverse=True)

    counterfactuals = []
    for req in missing_sorted[:top_k]:
        req_name = req["requirement"]
        weight = float(req.get("weight", 0.0))
        must = bool(req.get("must_have", False))

        # Minimal suggested change (template-based to avoid hallucination)
        if must:
            suggested_change = (
                f"Add explicit bullet describing {req_name} experience (e.g. "
                f"'Designed and maintained {req_name} pipelines for X months/years, including ...')."
            )
        else:
            suggested_change = (
                f"Mention relevant experience or project with {req_name} (e.g. "
                f"'Implemented {req_name} in project Y to achieve Z')."
            )

        counterfactuals.append({
            "requirement": req_name,
            "suggested_change": suggested_change
        })

    # Build contrastive explanations (simple, deterministic)
    strengths = [r["requirement"] for r in match_results if r.get("matched")]
    weaknesses = [r["requirement"] for r in match_results if not r.get("matched")]

    contrastive_explanations = []
    if len(strengths) > 0:
        contrastive_explanations.append(
            f"The CV is preferred because it covers key requirements: {', '.join(strengths[:5])}."
        )
    if len(weaknesses) > 0:
        contrastive_explanations.append(
            f"However, it lacks: {', '.join(weaknesses[:5])}, which limits a full match."
        )

    # Decision path (trace)
    decision_path = [
        "Step 1: build_cv_jd_match produced matched/missing per requirement.",
        f"Step 2: Identified top missing requirements by impact: {[r['requirement'] for r in missing_sorted[:top_k]]}.",
        f"Step 3: Proposed minimal, template-based changes and estimated score deltas."
    ]

    # Debug print for logs
    print("generate_counterfactuals invoked. counterfactuals:", json.dumps(counterfactuals, ensure_ascii=False, indent=2))

    return {
        "counterfactuals": counterfactuals,
        "contrastive_explanations": contrastive_explanations,
        "decision_path": decision_path
    }

# ---------------- NEW: Step 3-4-5 helpers (validation, ranking, expanded contrastive) ----------------

def apply_counterfactual_to_cv(cv: str, requirement_name: str) -> str:
    """
    Simple mock: append a bullet mentioning the requirement to the CV text.
    This simulates "adding" the skill/experience for validation.
    """
    if not cv:
        cv = ""
    # add short bullet, keep it minimal to avoid heavy polishing/hallucination
    appended = cv + f"\n- Experience with {requirement_name}"
    return appended

def validate_and_rank_counterfactuals(match_report: Dict[str, Any], cv: str, jd: str, top_k: int = 3) -> Dict[str, Any]:
    """
    - Take match_report and cv, generate counterfactuals (via generate_counterfactuals),
    - For each counterfactual (single-change scenario), apply to CV, re-run build_cv_jd_match,
    Returns a dict with validated counterfactuals (with actual_delta, impact_ratio) and expanded explanations.
    """
    # generate predicted counterfactuals from existing tool logic
    predicted = generate_counterfactuals(match_report, top_k=top_k)
    if "counterfactuals" not in predicted:
        return {"error": "No predicted counterfactuals available."}

    cfs = deepcopy(predicted["counterfactuals"])
    old_raw = float(match_report.get("raw_score", 0.0))

    validated = []
    for cf in cfs:
        req_name = cf.get("requirement")
        # apply single cf to CV (mock)
        new_cv = apply_counterfactual_to_cv(cv, req_name)
        # re-run matching
        new_match = build_cv_jd_match(new_cv, jd)
        new_raw = float(new_match.get("raw_score", 0.0))
        # actual improvement (raw units)
        actual_delta_raw = round(new_raw - old_raw, 4)
        # convert to 0-100 points similar to ats suggestion if needed
        actual_delta_pct = round((new_raw - old_raw) * 100, 2)

        # effort heuristic: must-have -> higher effort, optional -> lower
        # If match_report contains a requirement entry, find must flag
        matched_entry = next((r for r in match_report.get("match_results", []) if r["requirement"] == req_name), {})
        must_flag = bool(matched_entry.get("must_have", False))
        effort_cost = 1.0 if must_flag else 0.5

        # impact ratio: delta per unit effort (use pct)
        impact_ratio = round((actual_delta_pct / effort_cost) if effort_cost > 0 else 0.0, 4)

        # enrich cf
        cf_valid = dict(cf)
        cf_valid.update({
            "actual_delta_raw": actual_delta_raw,
            "actual_delta_pct": actual_delta_pct,
            "effort_cost": effort_cost,
            "impact_ratio": impact_ratio,
            "validated_with_new_raw": new_raw,
        })
        validated.append(cf_valid)

        # Debug log
        print(f"Validated CF '{req_name}': old_raw={old_raw}, new_raw={new_raw}, actual_delta_raw={actual_delta_raw}, actual_delta_pct={actual_delta_pct}, effort_cost={effort_cost}, impact_ratio={impact_ratio}")

    # sort by impact_ratio desc
    validated_sorted = sorted(validated, key=lambda x: x.get("impact_ratio", 0.0), reverse=True)

    # Expanded contrastive explanations
    strengths = [r["requirement"] for r in match_report.get("match_results", []) if r.get("matched")]
    weaknesses = [r["requirement"] for r in match_report.get("match_results", []) if not r.get("matched")]

    expanded_contrastive = []
    if strengths:
        expanded_contrastive.append(f"Positive: Candidate covers {', '.join(strengths)} — these are the reasons for the current match.")
    if weaknesses:
        expanded_contrastive.append(f"Negative: Candidate lacks {', '.join(weaknesses)} — adding these would most improve the match.")

    # Also include per-cf short explanation comparing to ideal candidate
    per_cf_explanations = []
    for cf in validated_sorted:
        per_cf_explanations.append(
            f"If candidate adds '{cf['requirement']}', actual +{cf.get('actual_delta_pct')} (pct). Impact ratio {cf.get('impact_ratio')}."
        )

    result = {
        "validated_counterfactuals": validated_sorted,
        "expanded_contrastive_explanations": expanded_contrastive,
        "per_counterfactual_explanations": per_cf_explanations,
    }

    # Debug print
    print("validate_and_rank_counterfactuals result:", json.dumps(result, ensure_ascii=False, indent=2))

    return result

# ---------------- Register Tools ----------------
build_cv_jd_match_tool   = FunctionTool(func=build_cv_jd_match)
generate_counterfactuals_tool = FunctionTool(func=generate_counterfactuals)
validate_and_rank_counterfactuals_tool = FunctionTool(func=validate_and_rank_counterfactuals)


root_agent = SequentialAgent(
    name = "root_agent",
    sub_agents=[extract_JD_skills_agent, extract_resume_skills_agent, analyze_agent]
)


def configure_agents_from_llm_config(llm_provider: str, llm_model_name: str, api_key: str, ollama_base_url: str = None):
    """Configure underlying LLM model for all sub-agents using LiteLlm.
    llm_provider: factory name, e.g., "openai", "gemini", or "ollama"
    llm_model_name: model, e.g., "gpt-4o-mini", "gemini-2.0-flash", or "llama3.2"
    api_key: provider API key (not used for Ollama)
    ollama_base_url: base URL for Ollama (e.g., "http://localhost:11434")
    """
    if not llm_provider or not llm_model_name:
        return
    try:
        if llm_provider.lower() == "ollama":
            if not ollama_base_url:
                print("No Ollama base URL provided")
                return
            # Ensure URL has protocol
            base_url = ollama_base_url.strip()
            if not base_url.startswith(('http://', 'https://')):
                base_url = f"http://{base_url}"
            # For Ollama, we need to set the base URL in the model card
            # Try different formats for Ollama integration
            model_card = f"ollama_chat/{llm_model_name}"
            print(f"Configuring Ollama model: {model_card} with base_url: {base_url}")
            try:
                # Try with api_base parameter
                model = LiteLlm(model_card, api_key="ollama", api_base=base_url)
                print(f"Ollama model configured successfully: {model_card}")
            except Exception as e:
                print(f"Failed to configure Ollama model with api_base: {e}")
                try:
                    # Try alternative format without api_base
                    model = LiteLlm(model_card, api_key="ollama")
                    print(f"Ollama model configured without api_base: {model_card}")
                except Exception as e2:
                    print(f"Failed to configure Ollama model without api_base: {e2}")
                    try:
                        # Try with different model card format
                        alt_model_card = f"ollama_chat/{llm_model_name}"
                        model = LiteLlm(alt_model_card)
                        print(f"Ollama model configured with alternative format: {alt_model_card}")
                    except Exception as e3:
                        print(f"Failed to configure Ollama model with alternative format: {e3}")
                        return
        else:
            if not api_key:
                return
            model_card = f"{str(llm_provider).lower()}/{llm_model_name}"
            model = LiteLlm(model_card, api_key=api_key)
        extract_JD_skills_agent.model = model
        extract_resume_skills_agent.model = model
        analyze_agent.model = model
    except Exception:
        # Silently ignore configuration errors; agents will fall back to defaults
        pass

def remove_json_fence(text):
    if text.startswith("```json"):
        text = text[len("```json"):].lstrip()
    if text.startswith("```latex"):
        text = text[len("```latex"):].lstrip()
    if text.endswith("```"):
        text = text[: -len("```")].rstrip()
    return text

def compute_relevant_score(jd: Dict, cv: Dict) -> Dict[str, float]:
    """
    Compute relevance score between JD requirements and candidate CV.
    Handles must-have, nice-to-have, and other requirement indicators.
    """

    # --- Skills scoring ---
    must_total = len(jd.get("must_have", []))
    nice_total = len(jd.get("nice_to_have", []))
    must_matched = len(cv.get("must_have", []))
    nice_matched = len(cv.get("nice_to_have", []))

    s_must = must_matched / must_total if must_total > 0 else 0.0
    s_nice = nice_matched / nice_total if nice_total > 0 else 0.0
    # Emphasize must-have more strongly and cap influence of nice-to-have
    s_skills = (3 * s_must + 1 * s_nice) / 4

    # --- Other indicators (binary match: 1 if satisfied, 0 otherwise) ---
    def indicator_match(jd_value, cv_value) -> float:
        if not jd_value:
            return 1.0  # no requirement → always satisfied
        if isinstance(jd_value, list):
            return 1.0 if all(item in cv_value for item in jd_value) else 0.0
        return 1.0 if jd_value and jd_value == cv_value else 0.0

    s_experience = indicator_match(jd.get("years_experience"), cv.get("years_experience"))
    s_education  = indicator_match(jd.get("education_level"), cv.get("education_level"))
    s_lang       = indicator_match(jd.get("languages", []), cv.get("languages", []))

    # --- Final weighted score ---
    # Heavier weight on skills; experience/language moderate; education lower
    score = (
        0.6 * s_skills +
        0.2 * s_experience +
        0.15 * s_lang +
        0.05 * s_education
    )

    return {
        "s_must": round(s_must, 4),
        "s_nice": round(s_nice, 4),
        "s_skills": round(s_skills, 4),
        "s_experience": s_experience,
        "s_education": s_education,
        "s_languages": s_lang,
        "score": round(score, 4)
    }

async def run_resume_scoring_agent(cv_info, jd_info, llm_provider: str = None, llm_model_name: str = None, api_key: str = None, ollama_base_url: str = None):
    """Run the structured extraction agents and compute the relevance score.
    If llm_provider, llm_model_name, and api_key/ollama_base_url are provided, set the model immediately.
    """
    session_service = InMemorySessionService()
    APP_NAME = "resume"
    USER_ID = "kdoo"
    # Generate a unique session ID for each request
    session_id = f"session_{int(time.time() * 1000)}"
    
    try:
        # Set model at call time if provided; fallback to a sensible default if not
        try:
            # Ensure environment variables are available for providers that read from env
            if llm_provider and api_key:
                provider = str(llm_provider).lower()
                if provider == "openai":
                    os.environ.setdefault("OPENAI_API_KEY", api_key)
                elif provider == "gemini":
                    os.environ.setdefault("GOOGLE_API_KEY", api_key)
            elif llm_provider and llm_provider.lower() == "ollama" and ollama_base_url:
                # Set Ollama environment variables
                base_url = ollama_base_url.strip()
                if not base_url.startswith(('http://', 'https://')):
                    base_url = f"http://{base_url}"
                os.environ.setdefault("OLLAMA_API_BASE", base_url)
                print(f"Set OLLAMA_API_BASE to: {base_url}")
            # Disable LiteLLM background logging to avoid event loop warnings
            try:
                os.environ.setdefault("LITELLM_LOGGING", "false")
                os.environ.setdefault("LITELLM_SDK_LOGGING", "false")
            except Exception:
                pass
            # Create model
            if llm_provider and llm_model_name:
                if llm_provider.lower() == "ollama":
                    if ollama_base_url:
                        # Ensure URL has protocol
                        base_url = ollama_base_url.strip()
                        if not base_url.startswith(('http://', 'https://')):
                            base_url = f"http://{base_url}"
                        model_card = f"ollama_chat/{llm_model_name}"
                        print(f"Creating Ollama model: {model_card} with base_url: {base_url}")
                        try:
                            # Try with api_base parameter
                            model = LiteLlm(model_card, api_key="ollama", api_base=base_url, temperature=0.0, top_p=1.0)
                            print(f"Ollama model created successfully: {model_card}")
                        except Exception as e:
                            print(f"Failed to create Ollama model with api_base: {e}")
                            try:
                                # Try alternative format without api_base
                                model = LiteLlm(model_card, api_key="ollama", temperature=0.0, top_p=1.0)
                                print(f"Ollama model created without api_base: {model_card}")
                            except Exception as e2:
                                print(f"Failed to create Ollama model without api_base: {e2}")
                                try:
                                    # Try with different model card format
                                    alt_model_card = f"ollama_chat/{llm_model_name}"
                                    model = LiteLlm(alt_model_card, temperature=0.0, top_p=1.0)
                                    print(f"Ollama model created with alternative format: {alt_model_card}")
                                except Exception as e3:
                                    print(f"Failed to create Ollama model with alternative format: {e3}")
                                    # Fallback to default
                                    model = LiteLlm("gemini/gemini-2.0-flash", temperature=0.0, top_p=1.0)
                    else:
                        print("No Ollama base URL provided, using fallback")
                        # Fallback default to avoid missing model errors
                        model = LiteLlm("gemini/gemini-2.0-flash", temperature=0.0, top_p=1.0)
                elif api_key:
                    model_card = f"{str(llm_provider).lower()}/{llm_model_name}"
                    print(f"Creating model: {model_card}")
                    model = LiteLlm(model_card, api_key=api_key, temperature=0.0, top_p=1.0)
                else:
                    print("No API key provided, using fallback")
                    # Fallback default to avoid missing model errors
                    model = LiteLlm("gemini/gemini-2.0-flash", temperature=0.0, top_p=1.0)
            else:
                print("No provider or model name, using fallback")
                # Fallback default to avoid missing model errors
                model = LiteLlm("gemini/gemini-2.0-flash", temperature=0.0, top_p=1.0)
            extract_JD_skills_agent.model = model
            extract_resume_skills_agent.model = model
            analyze_agent.model = model
        except Exception:
            pass
        # Create session asynchronously
        session = await session_service.create_session(app_name=APP_NAME, user_id=USER_ID, session_id=session_id)
        runner = Runner(agent=root_agent, app_name=APP_NAME, session_service=session_service)
        content = types.Content(role='user', parts=[types.Part(text="CV: " + cv_info + "\nJD: " + jd_info)])
        # Run the agent asynchronously with the existing session (which now contains history)
        jd_response = ""
        cv_response = ""
        analyze_response = ""
        async for event in runner.run_async(
            user_id=USER_ID, 
            session_id=session_id, 
            new_message=content
        ):
            if event.is_final_response():
                if event.author == "extract_JD_skills_agent":
                    jd_response = event.content.parts[0].text if event.content.parts and event.content.parts[0].text else ""
                if event.author == "extract_resume_skills_agent":
                    cv_response = event.content.parts[0].text if event.content.parts and event.content.parts[0].text else ""
                if event.author == "analyze_agent":
                    try:
                        txt = event.content.parts[0].text if event.content.parts and event.content.parts[0].text else ""
                        if txt:
                            # Strip common markdown fences from provider outputs
                            cleaned = remove_json_fence(txt)
                            print("analyze_agent raw output:")
                            print(cleaned)
                            analyze_response = cleaned
                    except Exception:
                        pass

        jd_response = remove_json_fence(jd_response)
        cv_response = remove_json_fence(cv_response)
        try:
            jd_skills = json.loads(jd_response) if jd_response else {}
            cv_skills = json.loads(cv_response) if cv_response else {}
        except json.JSONDecodeError:
            # If parsing fails, treat as empty indicators
            jd_skills, cv_skills = {}, {}
        score = compute_relevant_score(jd_skills, cv_skills)

        # Attempt to parse analyze_agent structured JSON if present
        analysis_obj = None
        if analyze_response:
            try:
                analysis_text = remove_json_fence(analyze_response)
                analysis_obj = json.loads(analysis_text)
            except Exception:
                analysis_obj = None
        # Get session and debug session state
        session = await session_service.get_session(
            app_name=APP_NAME,
            user_id=USER_ID,    
            session_id=session_id
        )
        # Return both score breakdown and analysis if available
        result = dict(score)
        if analysis_obj is not None:
            result["analysis"] = analysis_obj
        return result
    finally:
        # Clean up session asynchronously
        try:
            await session_service.delete_session(app_name=APP_NAME, user_id=USER_ID, session_id=session_id)
        except Exception:
            pass  # Ignore cleanup errors  

def main():
    cv_info = """
    A

| - | - | - | - Carrer Objective Experienced aspiring AI Engineer with a strong focus on Natural Language Processing (NLP) and its applications. Education University of Science - HCMUS Dec 2024 - Expected Feb 2027 • Pursuing Master’s in Computer Science to enhance theoretical and practical expertise in diverse technologies. University of Information Technology - UIT Sept 2021 - June 2024 • Completed a Bachelor of Computer Science, Mass Program. Overall GPA: 3.5/4 • Coursework: Natural Language Processing, Computer Vision, Introduction to Software Engineering Experience AI Engineer TMA Solutions Mar 2025 - Present Projects DoctorQA Nov 2024 - Present Technologies used: Python, Large language model (LLM), LangChain, PostgreSQL, Qdrant, Flask, . . . Personal project • Developed an intelligent medical assistant as an exploratory project, using RAG (Retrieval-Augmented Generation), LangChain framework with LLM (Gemini) to provide accurate healthcare information. • Crawled and processed 30,000+ medical documents from reputable sources into a Qdrant vector database. • Designed and maintained PostgreSQL database architecture for user management and conversation logging. • Designed web interfaces featuring login, registration, and DoctorQA chat functionality and built backend services with Flask to handle user login, chat interactions and API endpoints. • Leveraged Chain-of-thought prompting to enhance the accuracy and detail of AI-generated responses, resulting in more comprehensive and insightful outputs. • Github: https://github.com/kiendoo4/DoctorQA Student Management Sept 2023 - Dec 2023 Technologies used: C#, XAML, SQL, Entity Framework, Git Collaborators: HatakaCder, AnTran210, LuongDaiPhat • Applied C# and XAML for developing a software application for efficient school management. • Established user roles (admin, teacher), designed a SQL-based database on Azure for CRUD operations • Employed Entity Framework to enhance data interaction between the database and the C# application. • Leveraged Git and Github expertise to integrate individual contributions into a cohesive project repository. • Managed codebase projects and led my team in developing software interfaces and functionalities. • Github: https://github.com/kiendoo4/StudentManagement Skills Concepts Experience working on projects related to NLP, Deep Learning, Machine Learning, Computer Vision Genetic Algorithms, Data Mining and Software Development. Technical skills • Core competencies: Python, C++, C#, SQL, NoSQL, Qdrant, LangChain, XAML. • Tools: Git, GitHub, Visual Studio, Visual Studio Code, Kaggle, Overleaf for LaTeX. • Framework: Soft skills • Language: Achieved an IELTS score of 6.5 (TRF number: 23VN012469NGUT028A). • Leadership: Team leader of all of the projects above, I led and coordinated all project phases. • Research & Innovation: Strong track record in implementing cutting-edge AI solutions, with experience in adapting academic research into practical applications as demonstrated in the DoctorQA project and Vietnamese document retrieval system.
"""
    jd_info = """
About the Role

We are looking for a passionate and motivated AI Engineer (Fresher) to join our team. This role is ideal for recent graduates who are eager to apply their knowledge in machine learning, deep learning, and data processing to solve real-world problems. You will work closely with senior engineers and data scientists to design, develop, and deploy AI-driven applications.

Key Responsibilities

Assist in developing and implementing machine learning and deep learning models.

Work on data preprocessing, cleaning, and feature engineering.

Collaborate with cross-functional teams to integrate AI solutions into products.

Support in training, testing, and evaluating AI models to improve performance.

Stay updated with the latest AI/ML research, frameworks, and tools.

Contribute to documentation, reporting, and presentation of findings.

Requirements

Bachelor’s degree in Computer Science, Artificial Intelligence, Data Science, Mathematics, or related fields.

Strong understanding of machine learning algorithms, neural networks, and NLP/CV basics.

Hands-on experience with Python and ML libraries (e.g., TensorFlow, PyTorch, Scikit-learn, NumPy, Pandas).

Familiarity with SQL/NoSQL databases and data pipelines is a plus.

Basic knowledge of cloud platforms (AWS, GCP, Azure) is an advantage.

Strong problem-solving skills, eagerness to learn, and ability to work in a team.
    """
    result = asyncio.run(run_resume_scoring_agent(cv_info, jd_info))
    print(result)



if __name__ == "__main__":
    main()