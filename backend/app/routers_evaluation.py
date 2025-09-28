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

router = APIRouter(prefix="/evaluation", tags=["evaluation"])

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
                    
                    if llm_config and llm_config.llm_api_key:
                        result = await run_resume_scoring_agent(
                            anonymized_cv,
                            anonymized_jd,
                            llm_provider=str(llm_config.llm_provider.value if hasattr(llm_config.llm_provider, 'value') else llm_config.llm_provider),
                            llm_model_name=llm_config.llm_model_name,
                            api_key=llm_config.llm_api_key,
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
            # Description-based evaluation (placeholder for future implementation)
            if not label_rules:
                raise HTTPException(status_code=400, detail="Label rules are required for description-based evaluation")
            
            rules = json.loads(label_rules)
            
            # TODO: Implement description-based evaluation logic
            return {
                "status": "success",
                "message": "Description-based evaluation started successfully",
                "total_rows": len(df),
                "cv_column": cv_column,
                "jd_column": jd_column,
                "label_column": label_column,
                "label_rules": rules
            }
        else:
            raise HTTPException(status_code=400, detail="Invalid matching method. Use 'threshold' or 'description'")
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid label rules JSON format")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid threshold value: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to start evaluation: {str(e)}")
