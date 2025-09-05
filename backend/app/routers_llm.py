from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import os
import requests
import json

from .deps import get_db, get_current_user
from .models import LLMConfig, LLMProvider, CV, User
from .schemas import LLMConfigIn, LLMConfigOut, CVParseResponse, CVParsedField, APIKeyValidateRequest, APIKeyValidateResponse


router = APIRouter(prefix="/llm", tags=["llm"])


@router.get("/config", response_model=LLMConfigOut)
def get_config(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cfg = db.query(LLMConfig).filter(LLMConfig.user_id == user.id).first()
    if not cfg:
        raise HTTPException(status_code=404, detail="No config")
    return LLMConfigOut(
        llm_provider=cfg.llm_provider,
        llm_model_name=cfg.llm_model_name,
        llm_temperature=cfg.llm_temperature,
        llm_top_p=cfg.llm_top_p,
        llm_max_tokens=cfg.llm_max_tokens,
    )


@router.post("/config", response_model=LLMConfigOut)
def set_config(payload: LLMConfigIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cfg = db.query(LLMConfig).filter(LLMConfig.user_id == user.id).first()
    if cfg is None:
        cfg = LLMConfig(user_id=user.id)
        db.add(cfg)
    cfg.llm_provider = payload.llm_provider
    cfg.llm_api_key = payload.llm_api_key
    cfg.llm_model_name = payload.llm_model_name
    cfg.llm_temperature = payload.llm_temperature
    cfg.llm_top_p = payload.llm_top_p
    cfg.llm_max_tokens = payload.llm_max_tokens
    db.commit()
    return LLMConfigOut(
        llm_provider=cfg.llm_provider,
        llm_model_name=cfg.llm_model_name,
        llm_temperature=cfg.llm_temperature,
        llm_top_p=cfg.llm_top_p,
        llm_max_tokens=cfg.llm_max_tokens,
    )


@router.post("/validate-api-key", response_model=APIKeyValidateResponse)
def validate_api_key(payload: APIKeyValidateRequest, user: User = Depends(get_current_user)):
    try:
        if payload.kind == "llm":
            if payload.provider == "openai":
                # Minimal validation: list models
                url = os.getenv("OPENAI_MODELS_URL", "https://api.openai.com/v1/models")
                headers = {"Authorization": f"Bearer {payload.api_key}"}
                r = requests.get(url, headers=headers, timeout=20)
                if r.status_code == 200:
                    return APIKeyValidateResponse(valid=True, message="OpenAI key is valid")
                return APIKeyValidateResponse(valid=False, message=f"OpenAI validation failed: {r.status_code}")
            elif payload.provider == "gemini":
                # Try both v1 and v1beta endpoints for Gemini validation
                urls = [
                    f"https://generativelanguage.googleapis.com/v1/models?key={payload.api_key}",
                    f"https://generativelanguage.googleapis.com/v1beta/models?key={payload.api_key}"
                ]
                
                for url in urls:
                    try:
                        r = requests.get(url, timeout=20)
                        if r.status_code == 200:
                            return APIKeyValidateResponse(valid=True, message="Gemini key is valid")
                        elif r.status_code in [400, 403]:
                            # Try next URL if this one returns 400 or 403
                            continue
                    except Exception:
                        continue
                
                # If all URLs failed, return error
                return APIKeyValidateResponse(valid=False, message=f"Gemini validation failed: Invalid API key or insufficient permissions")
            else:
                return APIKeyValidateResponse(valid=False, message="Unsupported LLM provider")
        else:
            return APIKeyValidateResponse(valid=False, message="Unsupported kind")
    except requests.exceptions.RequestException as e:
        return APIKeyValidateResponse(valid=False, message=f"Network error: {e}")
    except Exception as e:
        return APIKeyValidateResponse(valid=False, message=f"Validation error: {e}")


@router.post("/parse/{cv_id}", response_model=CVParseResponse)
def parse_cv(cv_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cv = db.query(CV).filter(CV.id == cv_id, CV.owner_id == user.id).first()
    if not cv:
        raise HTTPException(status_code=404, detail="CV not found")
    if not cv.content_text:
        raise HTTPException(status_code=400, detail="CV has no text content")

    cfg = db.query(LLMConfig).filter(LLMConfig.user_id == user.id).first()
    if not cfg or not cfg.llm_api_key:
        raise HTTPException(status_code=400, detail="LLM config missing")

    # Clean and prepare text for better parsing
    cleaned_text = cv.content_text.strip()
    if len(cleaned_text) > 8000:
        cleaned_text = cleaned_text[:8000] + "..."
    
    prompt = f"""Extract key information from the following resume/CV and return ONLY a valid JSON object with these exact keys and structures:
{{
  "full_name": "string or null",
  "email": "string or null", 
  "phone": "string or null",
  "location": "string or null",
  "current_position": "string or null",
  "skills": ["array of skill strings"],
  "education": [{{"degree": "string or null", "institution": "string or null", "year": "string or null"}}],
  "experience": [{{"title": "string or null", "company": "string or null", "duration": "string or null", "description": "string or null"}}],
  "projects": [{{"name": "string or null", "description": "string or null", "technologies": ["strings"], "role": "string or null", "duration": "string or null", "links": ["strings (urls)"]}}]
}}

Important rules:
1. Return ONLY valid JSON, no other text
2. If a field is not found, use null for strings or empty array [] for arrays
3. Clean and normalize the extracted text
4. For skills, extract individual skills as separate strings
5. For education/experience/projects, extract structured data when possible
6. Keep descriptions concise (<= 3 sentences per item)

Resume text:
{cleaned_text}"""

    try:
        if cfg.llm_provider == LLMProvider.openai:
            data = _call_openai(cfg, prompt)
        elif cfg.llm_provider == LLMProvider.gemini:
            data = _call_gemini(cfg, prompt)
        else:
            raise HTTPException(status_code=400, detail="Unsupported provider")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM error: {e}")

    # Save parsed metadata to database
    cv.parsed_metadata = json.dumps(data)
    db.commit()
    db.refresh(cv)
    
    fields = [CVParsedField(name=k, value=str(v)) for k, v in (data or {}).items()]
    return CVParseResponse(fields=fields)


def _call_openai(cfg: LLMConfig, prompt: str):
    url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1/chat/completions")
    headers = {"Authorization": f"Bearer {cfg.llm_api_key}", "Content-Type": "application/json"}
    body = {
        "model": cfg.llm_model_name,
        "temperature": cfg.llm_temperature,
        "top_p": cfg.llm_top_p,
        "max_tokens": cfg.llm_max_tokens,
        "messages": [
            {"role": "system", "content": "You are a helpful assistant that extracts information from resumes and returns ONLY valid JSON objects. Never include explanations or additional text."},
            {"role": "user", "content": prompt},
        ],
        "response_format": {"type": "json_object"}
    }
    
    try:
        r = requests.post(url, json=body, headers=headers, timeout=60)
        r.raise_for_status()
        j = r.json()
        content = j["choices"][0]["message"]["content"]
        
        # Try to parse JSON
        try:
            parsed_data = json.loads(content)
            # Validate required structure
            required_keys = ["full_name", "email", "phone", "location", "current_position", "skills", "education", "experience", "projects"]
            for key in required_keys:
                if key not in parsed_data:
                    parsed_data[key] = None if key in ["full_name", "email", "phone", "location", "current_position"] else []
            return parsed_data
        except json.JSONDecodeError as e:
            print(f"OpenAI JSON parsing error: {e}")
            print(f"Raw response: {content}")
            return {"error": "Failed to parse JSON response", "raw": content}
            
    except requests.exceptions.RequestException as e:
        print(f"OpenAI API error: {e}")
        raise Exception(f"OpenAI API error: {e}")
    except Exception as e:
        print(f"Unexpected error in OpenAI call: {e}")
        raise Exception(f"Unexpected error: {e}")


def _call_gemini(cfg: LLMConfig, prompt: str):
    # Support both Gemini 1.x and 2.x
    # Gemini 2.x uses v1, Gemini 1.x uses v1beta
    if cfg.llm_model_name.startswith('gemini-2'):
        url = f"https://generativelanguage.googleapis.com/v1/models/{cfg.llm_model_name}:generateContent?key={cfg.llm_api_key}"
    else:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{cfg.llm_model_name}:generateContent?key={cfg.llm_api_key}"
    
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": cfg.llm_temperature, "topP": cfg.llm_top_p}
    }
    
    try:
        r = requests.post(url, json=body, timeout=60)
        r.raise_for_status()
        j = r.json()
        text = j.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        
        # Parse JSON from Gemini response (might be wrapped in ```json...```)
        try:
            # Try direct JSON parsing first
            parsed_data = json.loads(text)
        except json.JSONDecodeError:
            try:
                # Try to extract JSON from ```json...``` format
                import re
                json_match = re.search(r'```json\s*(.*?)\s*```', text, re.DOTALL)
                if json_match:
                    parsed_data = json.loads(json_match.group(1))
                else:
                    # Try to find JSON object in the text
                    json_match = re.search(r'\{.*\}', text, re.DOTALL)
                    if json_match:
                        parsed_data = json.loads(json_match.group(0))
                    else:
                        print(f"Gemini JSON parsing failed, raw response: {text}")
                        return {"error": "Failed to parse JSON response", "raw": text}
            except Exception as e:
                print(f"Gemini JSON extraction error: {e}")
                print(f"Raw response: {text}")
                return {"error": "Failed to extract JSON", "raw": text}
        
        # Validate required structure
        required_keys = ["full_name", "email", "phone", "location", "current_position", "skills", "education", "experience", "projects"]
        for key in required_keys:
            if key not in parsed_data:
                parsed_data[key] = None if key in ["full_name", "email", "phone", "location", "current_position"] else []
        
        return parsed_data
        
    except requests.exceptions.RequestException as e:
        print(f"Gemini API error: {e}")
        raise Exception(f"Gemini API error: {e}")
    except Exception as e:
        print(f"Unexpected error in Gemini call: {e}")
        raise Exception(f"Unexpected error: {e}")

