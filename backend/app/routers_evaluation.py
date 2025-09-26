from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import pandas as pd
import io
import json
from collections import Counter

from .deps import get_db, get_current_user
from .models import User

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
    label_rules: str = Form(...),  # JSON string of label rules
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Start evaluation process with the uploaded file and configuration
    """
    try:
        # Parse label rules
        rules = json.loads(label_rules)
        
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
        
        # TODO: Implement actual evaluation logic here
        # For now, return success with basic info
        return {
            "status": "success",
            "message": "Evaluation started successfully",
            "total_rows": len(df),
            "cv_column": cv_column,
            "jd_column": jd_column,
            "label_column": label_column,
            "label_rules": rules
        }
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid label rules JSON format")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to start evaluation: {str(e)}")
