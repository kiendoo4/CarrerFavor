import os
import tempfile
import subprocess
import json
from typing import Dict, Any, Optional
from fastapi import HTTPException
from .adk_agent.agent import run_resume_scoring_agent


def generate_enhanced_cv_tex(
    cv_text: str, 
    jd_text: str, 
    analysis: Dict[str, Any],
    llm_provider: str = None,
    llm_model_name: str = None,
    api_key: str = None,
    ollama_base_url: str = None
) -> str:
    """
    Generate enhanced CV LaTeX content using LLM based on analysis suggestions.
    """
    # Read template
    template_path = os.path.join(os.path.dirname(__file__), "..", "..", "cv_template.txt")
    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            template = f.read()
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="CV template not found")
    
    # Extract suggestions from analysis
    edit_suggestions = analysis.get("edit_suggestions", [])
    strengths = analysis.get("strengths", [])
    weaknesses = analysis.get("weaknesses", [])
    counterfactuals = analysis.get("counterfactuals", [])
    
    # Create enhancement prompt
    enhancement_prompt = f"""
You are a professional CV writer. Based on the following analysis of a CV against a job description, generate an enhanced version of the CV.

Original CV:
{cv_text}

Job Description:
{jd_text}

Analysis Results:
- Strengths: {', '.join(strengths) if strengths else 'None identified'}
- Weaknesses: {', '.join(weaknesses) if weaknesses else 'None identified'}
- Edit Suggestions: {', '.join(edit_suggestions) if edit_suggestions else 'None provided'}
- Counterfactuals: {json.dumps(counterfactuals, ensure_ascii=False) if counterfactuals else 'None provided'}

Please generate an enhanced CV that addresses the weaknesses and incorporates the suggestions. 
Use the following LaTeX template and fill in the placeholders:

{template}

Instructions:
1. CV_NAME: Use a professional name (you can generate one)
2. CV_EMAIL: Generate a professional email
3. CV_PHONE: Generate a phone number
4. CV_SUMMARY: Write a compelling professional summary that addresses the job requirements
5. CV_SKILLS: List relevant technical skills, emphasizing those mentioned in the job description
6. CV_EXPERIENCE: Write 2-3 relevant work experiences that match the job requirements
7. CV_EDUCATION: Include relevant education background
8. CV_PROJECTS: Add 1-2 relevant projects that demonstrate required skills
9. CV_ADDITIONAL: Include any additional relevant information

Make sure to:
- Address all identified weaknesses
- Incorporate all edit suggestions
- Emphasize skills and experiences that match the job requirements
- Use professional language and formatting
- Keep the content realistic and coherent

Return only the complete LaTeX document, ready for compilation.
"""

    # Use LLM to generate enhanced CV
    try:
        # Create a simple LLM call for enhancement
        # This is a simplified version - you might want to use the full agent system
        enhanced_cv = _call_llm_for_enhancement(
            enhancement_prompt, 
            llm_provider, 
            llm_model_name, 
            api_key, 
            ollama_base_url
        )
        return enhanced_cv
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate enhanced CV: {str(e)}")


def _call_llm_for_enhancement(
    prompt: str,
    llm_provider: str = None,
    llm_model_name: str = None,
    api_key: str = None,
    ollama_base_url: str = None
) -> str:
    """
    Call LLM to generate enhanced CV content.
    This is a simplified implementation - you might want to integrate with your existing agent system.
    """
    # For now, return a basic enhanced template
    # In a real implementation, you would call your LLM here
    enhanced_template = f"""
\\documentclass[11pt,a4paper]{{article}}
\\usepackage[utf8]{{inputenc}}
\\usepackage[margin=1in]{{geometry}}
\\usepackage{{enumitem}}
\\usepackage{{hyperref}}
\\usepackage{{xcolor}}

\\title{{\\textbf{{John Smith}}}}
\\author{{john.smith@email.com}}
\\date{{+1 (555) 123-4567}}

\\begin{{document}}

\\maketitle

\\section*{{Professional Summary}}
Experienced software engineer with expertise in Python, machine learning, and data analysis. 
Strong background in developing scalable applications and working with cross-functional teams.

\\section*{{Technical Skills}}
\\begin{{itemize}}[leftmargin=*]
\\item Python, JavaScript, SQL
\\item Machine Learning (TensorFlow, PyTorch)
\\item Data Analysis (Pandas, NumPy)
\\item Cloud Platforms (AWS, GCP)
\\end{{itemize}}

\\section*{{Work Experience}}
\\textbf{{Software Engineer}} | Tech Company | 2020-2023
\\begin{{itemize}}
\\item Developed and maintained web applications using Python and JavaScript
\\item Implemented machine learning models for data analysis
\\item Collaborated with cross-functional teams to deliver high-quality software
\\end{{itemize}}

\\section*{{Education}}
\\textbf{{Bachelor of Computer Science}} | University Name | 2016-2020

\\section*{{Projects}}
\\textbf{{ML Data Pipeline}} | 2022
\\begin{{itemize}}
\\item Built end-to-end data pipeline for processing large datasets
\\item Implemented machine learning models for predictive analytics
\\end{{itemize}}

\\section*{{Additional Information}}
\\begin{{itemize}}
\\item Strong problem-solving and analytical skills
\\item Experience with agile development methodologies
\\item Excellent communication and teamwork abilities
\\end{{itemize}}

\\end{{document}}
"""
    return enhanced_template


def compile_latex_to_pdf(tex_content: str) -> bytes:
    """
    Compile LaTeX content to PDF using the LaTeX container.
    """
    # Create temporary directory for LaTeX compilation
    with tempfile.TemporaryDirectory() as temp_dir:
        tex_file = os.path.join(temp_dir, "cv.tex")
        pdf_file = os.path.join(temp_dir, "cv.pdf")
        
        # Write LaTeX content to file
        with open(tex_file, 'w', encoding='utf-8') as f:
            f.write(tex_content)
        
        try:
            # Run LaTeX compilation using docker
            cmd = [
                "docker", "run", "--rm",
                "-v", f"{temp_dir}:/latex",
                "-w", "/latex",
                "texlive/texlive:latest-full",
                "pdflatex", "-interaction=nonstopmode", "cv.tex"
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            
            if result.returncode != 0:
                raise HTTPException(
                    status_code=500, 
                    detail=f"LaTeX compilation failed: {result.stderr}"
                )
            
            # Read the generated PDF
            with open(pdf_file, 'rb') as f:
                pdf_content = f.read()
            
            return pdf_content
            
        except subprocess.TimeoutExpired:
            raise HTTPException(status_code=500, detail="LaTeX compilation timeout")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"LaTeX compilation error: {str(e)}")


async def generate_enhanced_cv_pdf(
    cv_text: str,
    jd_text: str,
    llm_provider: str = None,
    llm_model_name: str = None,
    api_key: str = None,
    ollama_base_url: str = None
) -> bytes:
    """
    Generate enhanced CV PDF by running analysis, creating LaTeX, and compiling to PDF.
    """
    # First, run the analysis to get suggestions
    analysis_result = await run_resume_scoring_agent(
        cv_text, jd_text, llm_provider, llm_model_name, api_key, ollama_base_url
    )
    
    analysis = analysis_result.get("analysis", {})
    
    # Generate enhanced LaTeX
    tex_content = generate_enhanced_cv_tex(
        cv_text, jd_text, analysis, llm_provider, llm_model_name, api_key, ollama_base_url
    )
    
    # Compile to PDF
    pdf_content = compile_latex_to_pdf(tex_content)
    
    return pdf_content
