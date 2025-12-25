import os
import tempfile
import subprocess
import json
from typing import Dict, Any, Optional
import requests
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
    
    # Create enhancement prompt including full analysis JSON and template
    enhancement_prompt = f"""
You are a professional CV writer. Using the ORIGINAL CV, the JD, and the FULL ANALYSIS below, produce an ENHANCED CV as a COMPLETE LaTeX document.

IMPORTANT ABOUT THE TEMPLATE:
- The following is a STYLE TEMPLATE (not placeholders). Use its structure, macros, and visual style (colors, SectionTitle, spacing, header layout) as a guideline.
- Replace the example content (e.g., names like "Trung Kien Nguyen", roles, emails, links, experiences) with content derived from the ORIGINAL CV and ANALYSIS. If information is missing, synthesize plausible professional details consistent with the candidate and JD.
- You MAY add/remove/reorder bullet points and sections if clearly beneficial, but keep overall aesthetic consistent with the template.
- STRICT: Do NOT include markdown code fences. Return ONLY LaTeX source that compiles standalone.

ORIGINAL CV (plaintext):
{cv_text}

JOB DESCRIPTION (plaintext):
{jd_text}

FULL ANALYSIS JSON (verbatim):
{json.dumps(analysis, ensure_ascii=False)}

CONVENIENCE SUMMARY (extracted):
- Strengths: {', '.join(strengths) if strengths else 'None'}
- Weaknesses: {', '.join(weaknesses) if weaknesses else 'None'}
- Edit Suggestions: {', '.join(edit_suggestions) if edit_suggestions else 'None'}
- Counterfactuals: {json.dumps(counterfactuals, ensure_ascii=False) if counterfactuals else 'None'}

STYLE TEMPLATE (use its structure/macros; replace all example content with enhanced content):
{template}

WRITING RULES:
1) Keep the header realistic: candidate name, title, email, phone, LinkedIn/GitHub if available or plausible.
2) Profile: rewrite to align with JD using strengths/suggestions; be concise and impactful.
3) Technical Skills: prioritize JD-relevant skills; group clearly; avoid skills not evidenced.
4) Experience: rewrite bullets to be results-oriented, quantify impact, align with JD; 4-6 bullets per recent role.
5) Projects/Education/Languages: keep only relevant and improve clarity.
6) Incorporate edit suggestions and address weaknesses and (where sensible) counterfactuals.
7) Maintain LaTeX syntax from the template and ensure it compiles.
8) Output ONLY the final LaTeX document (no explanations, no fences).
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
    Call provider LLM to generate enhanced CV LaTeX.
    Removes markdown code fences if present.
    """
    def _strip_fences(text: str) -> str:
        t = text.strip()
        if t.startswith("```"):
            # remove opening fence with optional language tag
            t = t.split("\n", 1)[1] if "\n" in t else t
        if t.endswith("```"):
            t = t.rsplit("```", 1)[0]
        return t.strip()

    provider = (llm_provider or '').lower()

    try:
        if provider == 'ollama':
            base = ollama_base_url or 'http://localhost:11434'
            url = base.rstrip('/') + '/api/generate'
            resp = requests.post(url, json={
                'model': llm_model_name or 'llama3.2',
                'prompt': prompt,
                'stream': False,
                'options': {
                    'temperature': 0.0,
                    'top_p': 1.0
                }
            }, timeout=120)
            resp.raise_for_status()
            data = resp.json()
            return _strip_fences(data.get('response', ''))

        if provider == 'openai':
            url = 'https://api.openai.com/v1/chat/completions'
            headers = {
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            }
            body = {
                'model': llm_model_name or 'gpt-4o-mini',
                'temperature': 0.0,
                'top_p': 1.0,
                'messages': [
                    { 'role': 'system', 'content': 'You write LaTeX CV documents. Output ONLY LaTeX.' },
                    { 'role': 'user', 'content': prompt }
                ]
            }
            resp = requests.post(url, headers=headers, json=body, timeout=120)
            resp.raise_for_status()
            data = resp.json()
            content = data['choices'][0]['message']['content']
            return _strip_fences(content)

        if provider == 'gemini':
            # Support Gemini 1.x (v1beta) and 2.x (v1) - try v1 first
            model = llm_model_name or 'gemini-1.5-flash'
            # v1
            url = f'https://generativelanguage.googleapis.com/v1/models/{model}:generateContent?key={api_key}'
            body = {
                'contents': [{ 'parts': [{ 'text': prompt }]}],
                'generationConfig': { 'temperature': 0.0, 'topP': 1.0 }
            }
            resp = requests.post(url, json=body, timeout=120)
            # Fallback to v1beta if needed
            if not resp.ok:
                url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}'
                resp = requests.post(url, json=body, timeout=120)
            resp.raise_for_status()
            data = resp.json()
            candidates = data.get('candidates', [])
            parts = candidates[0].get('content', {}).get('parts', []) if candidates else []
            text = ''.join(p.get('text', '') for p in parts)
            return _strip_fences(text)

        # Default: return prompt error
        raise HTTPException(status_code=400, detail='Unsupported LLM provider for enhancement')
    except Exception as e:
        # Surface error to caller
        raise HTTPException(status_code=500, detail=f"LLM enhancement call failed: {str(e)}")


def compile_latex_to_pdf(tex_content: str) -> bytes:
    """
    Compile LaTeX content to PDF using the LaTeX container.
    """
    # Create temporary directory for LaTeX compilation
    with tempfile.TemporaryDirectory() as temp_dir:
        tex_file = os.path.join(temp_dir, "cv.tex")
        pdf_file = os.path.join(temp_dir, "cv.pdf")
        
        # Sanitize LaTeX content to fix common issues
        sanitized_tex = tex_content
        # Fix unescaped ampersands in text (but not in table environments)
        import re
        # Replace & with \& when it's not in table context (simple heuristic)
        sanitized_tex = re.sub(r'(?<!\\)&(?![^{]*})', r'\\&', sanitized_tex)
        
        # Write LaTeX content to file
        with open(tex_file, 'w', encoding='utf-8') as f:
            f.write(sanitized_tex)
        
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
            
            # Check if PDF was generated despite errors (LaTeX can have warnings but still produce PDF)
            pdf_exists = os.path.exists(pdf_file)
            
            if result.returncode != 0 and not pdf_exists:
                print(f"DEBUG: LaTeX compilation failed!")
                print(f"DEBUG: Return code: {result.returncode}")
                print(f"DEBUG: STDOUT: {result.stdout}")
                print(f"DEBUG: STDERR: {result.stderr}")
                print(f"DEBUG: LaTeX content (first 500 chars): {tex_content[:500]}...")
                raise HTTPException(
                    status_code=500, 
                    detail=f"LaTeX compilation failed. Return code: {result.returncode}. STDERR: {result.stderr[:500]}. STDOUT: {result.stdout[:200]}"
                )
            elif result.returncode != 0 and pdf_exists:
                print(f"DEBUG: LaTeX had warnings/errors but PDF was generated successfully")
                print(f"DEBUG: Return code: {result.returncode} (non-fatal)")
                # Continue to read the PDF despite warnings
            
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


def _strip_latex_to_text(tex: str) -> str:
    """Very naive LaTeX to text stripper for analysis purposes."""
    lines = []
    for line in tex.splitlines():
        if line.strip().startswith('%'):
            continue
        lines.append(line)
    text = '\n'.join(lines)
    # Remove common LaTeX commands and environments
    import re
    text = re.sub(r"\\begin\{[^}]+\}|\\end\{[^}]+\}", "\n", text)
    text = re.sub(r"\\[a-zA-Z]+\*?(\[[^\]]*\])?(\{[^}]*\})?", "", text)
    text = re.sub(r"\{|\}", "", text)
    text = re.sub(r"\n\n+", "\n\n", text)
    return text.strip()


async def generate_enhanced_cv_pdf_and_analysis(
    cv_text: str,
    jd_text: str,
    llm_provider: str = None,
    llm_model_name: str = None,
    api_key: str = None,
    ollama_base_url: str = None
) -> Dict[str, Any]:
    """Generate enhanced PDF and run analysis on the enhanced CV content."""
    # Generate LaTeX
    tex_content = generate_enhanced_cv_tex(
        cv_text, jd_text, analysis={},  # analysis will be recomputed after enhancement anyway
        llm_provider=llm_provider,
        llm_model_name=llm_model_name,
        api_key=api_key,
        ollama_base_url=ollama_base_url
    )
    # Compile to PDF
    pdf_content = compile_latex_to_pdf(tex_content)
    # Strip LaTeX -> text for scoring
    enhanced_text = _strip_latex_to_text(tex_content)
    # Re-run analysis on enhanced content
    analysis_result = await run_resume_scoring_agent(
        enhanced_text, jd_text, llm_provider, llm_model_name, api_key, ollama_base_url
    )
    return { 'pdf': pdf_content, 'analysis': analysis_result }
