from google.adk.agents import LlmAgent, SequentialAgent
from google.adk.models.lite_llm import LiteLlm
from google.adk.sessions import InMemorySessionService
from google.adk.runners import Runner
from google.genai import types
from typing import Dict
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

root_agent = SequentialAgent(
    name = "root_agent",
    sub_agents=[extract_JD_skills_agent, extract_resume_skills_agent]
)


def configure_agents_from_llm_config(llm_provider: str, llm_model_name: str, api_key: str):
    """Configure underlying LLM model for all sub-agents using LiteLlm.
    llm_provider: factory name, e.g., "openai" or "gemini"
    llm_model_name: model, e.g., "gpt-4o-mini" or "gemini-2.0-flash"
    api_key: provider API key
    """
    if not llm_provider or not llm_model_name or not api_key:
        return
    try:
        model_card = f"{str(llm_provider).lower()}/{llm_model_name}"
        model = LiteLlm(model_card, api_key=api_key)
        extract_JD_skills_agent.model = model
        extract_resume_skills_agent.model = model
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
    s_skills = (2 * s_must + s_nice) / 3

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
    score = (s_skills + s_experience + s_education + s_lang) / 4

    return {
        "s_must": round(s_must, 4),
        "s_nice": round(s_nice, 4),
        "s_skills": round(s_skills, 4),
        "s_experience": s_experience,
        "s_education": s_education,
        "s_languages": s_lang,
        "score": round(score, 4)
    }

async def run_resume_scoring_agent(cv_info, jd_info, llm_provider: str = None, llm_model_name: str = None, api_key: str = None):
    """Run the structured extraction agents and compute the relevance score.
    If llm_provider, llm_model_name, and api_key are provided, set the model immediately.
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
            # Disable LiteLLM background logging to avoid event loop warnings
            try:
                os.environ.setdefault("LITELLM_LOGGING", "false")
                os.environ.setdefault("LITELLM_SDK_LOGGING", "false")
            except Exception:
                pass
            # Create model
            if llm_provider and llm_model_name and api_key:
                model_card = f"{str(llm_provider).lower()}/{llm_model_name}"
                model = LiteLlm(model_card, api_key=api_key)
            else:
                # Fallback default to avoid missing model errors
                model = LiteLlm("gemini/gemini-2.0-flash")
            extract_JD_skills_agent.model = model
            extract_resume_skills_agent.model = model
        except Exception:
            pass
        # Create session asynchronously
        session = await session_service.create_session(app_name=APP_NAME, user_id=USER_ID, session_id=session_id)
        runner = Runner(agent=root_agent, app_name=APP_NAME, session_service=session_service)
        content = types.Content(role='user', parts=[types.Part(text="CV: " + cv_info + "\nJD: " + jd_info)])
        # Run the agent asynchronously with the existing session (which now contains history)
        jd_response = ""
        cv_response = ""
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

        jd_response = remove_json_fence(jd_response)
        cv_response = remove_json_fence(cv_response)
        try:
            jd_skills = json.loads(jd_response) if jd_response else {}
            cv_skills = json.loads(cv_response) if cv_response else {}
        except json.JSONDecodeError:
            # If parsing fails, treat as empty indicators
            jd_skills, cv_skills = {}, {}
        score = compute_relevant_score(jd_skills, cv_skills)
        # Get session and debug session state
        session = await session_service.get_session(
            app_name=APP_NAME,
            user_id=USER_ID,    
            session_id=session_id
        )
        return score
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