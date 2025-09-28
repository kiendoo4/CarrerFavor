from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import pandas as pd
import io
import json
from collections import Counter

from .deps import get_db, get_current_user
from .models import User, LLMConfig
from .scoring import compute_similarity_score
from .presidio_client import analyze_and_anonymize
import openai
import requests
import json
import google.generativeai as genai
import logging
import os

# Suppress Google Cloud SDK warnings
os.environ['GRPC_VERBOSITY'] = 'ERROR'
os.environ['GRPC_TRACE'] = ''
logging.getLogger('google').setLevel(logging.ERROR)

router = APIRouter(prefix="/evaluation", tags=["evaluation"])

async def call_llm_for_description_matching(cv_text: str, jd_text: str, label_rules: List[Dict], llm_config: LLMConfig) -> str:
    """
    Call LLM to predict label based on CV, JD and label rules
    Returns predicted label string
    """
    # Create prompt template
    prompt = f"""You are an expert HR analyst. Your task is to analyze a CV and Job Description (JD) and predict the most appropriate label based on the given rules.

CV Text:
{cv_text}

Job Description:
{jd_text}

Available Labels and Rules:
"""
    
    for rule in label_rules:
        prompt += f"- {rule['label']}: {rule['rule']}\n"
    
    prompt += """
Instructions:
1. Carefully analyze the CV and JD content
2. Apply the rules for each label to determine the best match
3. Return ONLY the predicted label name (exactly as written above)
4. Do not include any explanation, reasoning, or additional text
5. Ensure your response is consistent and deterministic

Predicted Label:"""

    try:
        if llm_config.llm_provider.value == "openai" and llm_config.llm_api_key:
            # OpenAI API
            client = openai.AsyncOpenAI(api_key=llm_config.llm_api_key)
            response = await client.chat.completions.create(
                model=llm_config.llm_model_name,
                messages=[
                    {"role": "system", "content": "You are a precise HR analyst. Always respond with only the label name, nothing else."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.0,  # Ensure consistency
                max_tokens=50
            )
            predicted_label = response.choices[0].message.content.strip()
            
        elif llm_config.llm_provider.value == "gemini" and llm_config.llm_api_key:
            # Gemini API
            import google.generativeai as genai
            import warnings
            
            # Suppress warnings for this call
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                genai.configure(api_key=llm_config.llm_api_key)
                model = genai.GenerativeModel(llm_config.llm_model_name)
                
                full_prompt = f"System: You are a precise HR analyst. Always respond with only the label name, nothing else.\n\nUser: {prompt}"
                response = await model.generate_content_async(full_prompt)
                predicted_label = response.text.strip()
            
        elif llm_config.llm_provider.value == "ollama" and llm_config.ollama_base_url:
            # Ollama API - Fix URL format
            base_url = llm_config.ollama_base_url.rstrip('/')
            if not base_url.startswith(('http://', 'https://')):
                base_url = f"http://{base_url}"
            ollama_url = f"{base_url}/api/chat"
            
            payload = {
                "model": llm_config.llm_model_name,
                "messages": [
                    {"role": "system", "content": "You are a precise HR analyst. Always respond with only the label name, nothing else."},
                    {"role": "user", "content": prompt}
                ],
                "stream": False,
                "options": {
                    "temperature": 0.0,  # Ensure consistency
                    "top_p": 1.0
                }
            }
            
            response = requests.post(ollama_url, json=payload, timeout=30)
            response.raise_for_status()
            result = response.json()
            predicted_label = result["message"]["content"].strip()
            
        else:
            # No valid configuration
            raise Exception("No valid LLM configuration found")
            
        # Clean up the response to ensure it matches one of the available labels
        available_labels = [rule['label'] for rule in label_rules]
        predicted_label = predicted_label.strip().strip('"').strip("'")
        
        if predicted_label in available_labels:
            return predicted_label
        else:
            # If response doesn't match any label, return "Error"
            return "Error"
            
    except Exception as e:
        print(f"Error calling LLM for description matching: {e}")
        return "Error"

@router.post("/parse-file")
async def parse_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Parse uploaded Excel/CSV file and return column names
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Check file extension
    if not file.filename.lower().endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="Only Excel (.xlsx, .xls) and CSV files are supported")
    
    try:
        # Read file content
        content = await file.read()
        
        # Parse based on file type
        if file.filename.lower().endswith('.csv'):
            # Parse CSV
            df = pd.read_csv(io.BytesIO(content))
        else:
            # Parse Excel
            df = pd.read_excel(io.BytesIO(content))
        
        # Get column names
        columns = df.columns.tolist()
        
        # Get basic file info
        total_rows = len(df)
        
        return {
            "columns": columns,
            "total_rows": total_rows,
            "file_name": file.filename,
            "file_size": len(content)
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

@router.post("/analyze-labels")
async def analyze_labels(
    file: UploadFile = File(...),
    label_column: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Analyze labels from selected column in the uploaded file
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    if not label_column:
        raise HTTPException(status_code=400, detail="Label column not specified")
    
    try:
        # Read file content
        content = await file.read()
        
        # Parse based on file type
        if file.filename.lower().endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
        
        # Check if label column exists
        if label_column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Column '{label_column}' not found in file")
        
        # Count labels
        label_counts = df[label_column].value_counts().to_dict()
        
        # Convert to list of objects
        labels = [{"label": label, "count": count} for label, count in label_counts.items()]
        
        # Get total rows
        total_rows = len(df)
        
        return {
            "labels": labels,
            "total_rows": total_rows,
            "label_column": label_column
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to analyze labels: {str(e)}")

@router.post("/start-evaluation")
async def start_evaluation(
    file: UploadFile = File(...),
    cv_column: str = Form(...),
    jd_column: str = Form(...),
    label_column: str = Form(...),
    matching_method: str = Form(...),
    label_thresholds: str = Form(None),  # JSON string for threshold method
    label_rules: str = Form(None),  # Optional for description method
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Start evaluation process with the uploaded file and configuration
    """
    try:
        # Read file content
        content = await file.read()
        
        # Parse based on file type
        if file.filename.lower().endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
        
        # Validate columns exist
        required_columns = [cv_column, jd_column, label_column]
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise HTTPException(status_code=400, detail=f"Missing columns: {missing_columns}")
        
        # Get user's LLM config for scoring
        llm_config = db.query(LLMConfig).filter(LLMConfig.user_id == current_user.id).first()
        
        if matching_method == "threshold":
            # Threshold-based evaluation
            if not label_thresholds:
                raise HTTPException(status_code=400, detail="Label thresholds are required for threshold-based evaluation")
            
            thresholds = json.loads(label_thresholds)
            results = []
            
            # Process each row
            for index, row in df.iterrows():
                cv_text = str(row[cv_column]) if pd.notna(row[cv_column]) else ""
                jd_text = str(row[jd_column]) if pd.notna(row[jd_column]) else ""
                expected_label = str(row[label_column]) if pd.notna(row[label_column]) else ""
                
                if not cv_text or not jd_text:
                    continue
                
                # Anonymize texts
                anonymized_cv = analyze_and_anonymize(cv_text)
                anonymized_jd = analyze_and_anonymize(jd_text)
                
                # Compute similarity score
                try:
                    # Import here to avoid circular imports
                    from .adk_agent.agent import run_resume_scoring_agent
                    
                    if llm_config and (llm_config.llm_api_key or llm_config.ollama_base_url):
                        result = await run_resume_scoring_agent(
                            anonymized_cv,
                            anonymized_jd,
                            llm_provider=str(llm_config.llm_provider.value if hasattr(llm_config.llm_provider, 'value') else llm_config.llm_provider),
                            llm_model_name=llm_config.llm_model_name,
                            api_key=llm_config.llm_api_key,
                            ollama_base_url=llm_config.ollama_base_url,
                        )
                    else:
                        result = await run_resume_scoring_agent(anonymized_cv, anonymized_jd)
                    
                    score = result.get("score", 0.0) if isinstance(result, dict) else 0.0
                except Exception as e:
                    print(f"Error computing score for row {index}: {e}")
                    score = 0.0  # Default score on error
                
                # Predict label based on thresholds for this specific label
                label_threshold = thresholds.get(expected_label, {})
                match_threshold = label_threshold.get('match', 0.7)
                no_match_threshold = label_threshold.get('noMatch', 0.3)
                
                # Use the expected label as the predicted label based on score
                if score >= match_threshold:
                    predicted_label = expected_label  # High score = match the expected label
                elif score < no_match_threshold:
                    # Find a different label from the available labels
                    available_labels = list(thresholds.keys())
                    other_labels = [label for label in available_labels if label != expected_label]
                    predicted_label = other_labels[0] if other_labels else "no_match"
                else:
                    predicted_label = "uncertain"  # Between thresholds
                
                results.append({
                    "cv": cv_text[:500],  # Truncate for display
                    "jd": jd_text[:500],
                    "expectedLabel": expected_label,
                    "predictedLabel": predicted_label,
                    "score": score
                })
            
            return {
                "status": "success",
                "message": "Threshold-based evaluation completed",
                "total_rows": len(df),
                "processed_rows": len(results),
                "label_thresholds": thresholds,
                "results": results
            }
            
        elif matching_method == "description":
            # Description-based evaluation using LLM
            if not label_rules:
                raise HTTPException(status_code=400, detail="Label rules are required for description-based evaluation")
            
            rules = json.loads(label_rules)
            results = []
            
            # Process each row
            for index, row in df.iterrows():
                cv_text = str(row[cv_column]) if pd.notna(row[cv_column]) else ""
                jd_text = str(row[jd_column]) if pd.notna(row[jd_column]) else ""
                expected_label = str(row[label_column]) if pd.notna(row[label_column]) else ""
                
                if not cv_text or not jd_text:
                    continue
                
                # Anonymize texts
                anonymized_cv = analyze_and_anonymize(cv_text)
                anonymized_jd = analyze_and_anonymize(jd_text)
                
                # Call LLM for prediction
                try:
                    predicted_label = await call_llm_for_description_matching(
                        anonymized_cv, 
                        anonymized_jd, 
                        rules, 
                        llm_config
                    )
                except Exception as e:
                    print(f"Error calling LLM for row {index}: {e}")
                    predicted_label = "Error"  # Return "Error" on failure
                
                results.append({
                    "cv": cv_text[:500],  # Truncate for display
                    "jd": jd_text[:500],
                    "expectedLabel": expected_label,
                    "predictedLabel": predicted_label
                })
            
            return {
                "status": "success",
                "message": "Description-based evaluation completed",
                "total_rows": len(df),
                "processed_rows": len(results),
                "label_rules": rules,
                "results": results
            }
        else:
            raise HTTPException(status_code=400, detail="Invalid matching method. Use 'threshold' or 'description'")
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid label rules JSON format")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid threshold value: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to start evaluation: {str(e)}")
