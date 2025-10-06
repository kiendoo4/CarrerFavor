# agent.py
from typing import List, Optional, Dict, Any
from collections import Counter
import re
import json
from copy import deepcopy

from google.adk.agents import Agent
from google.adk.tools import google_search
from google.adk.tools import FunctionTool

# ---------------- instruction ----------------
INSTRUCTION = """
Bạn là một chuyên gia tuyển dụng.
Nhiệm vụ:
1. Nếu người dùng chưa cung cấp CV hoặc JD, hãy yêu cầu họ cung cấp (không trả về JSON).
2. Khi đã có cả CV và JD, luôn thực hiện:
   a) Gọi công cụ `build_cv_jd_match(cv, jd)` để tạo bản phân tích khớp.
   b) Gọi công cụ `generate_counterfactuals(match_report)` với kết quả từ bước a.
   c) Gọi công cụ `validate_and_rank_counterfactuals(match_report, cv, jd)` để:
       - giả lập áp dụng từng counterfactual,
       - re-run match để tính actual_delta,
3. Dựa trên kết quả từ (a), (b), (c), tạo báo cáo JSON đầy đủ theo schema (vị trí `ats_check.score` phải là số 0–100).
4. BẮT BUỘC:
   - Trả về trường `ats_check.score` dưới dạng số từ 0 đến 100.
   - Nếu không chắc, sử dụng giá trị `ats_score_suggestion` từ tool `build_cv_jd_match`.
   - Không bao giờ để trống hoặc trả về text như "Tốt" cho score.
5. Nếu thiếu thông tin, yêu cầu người dùng bổ sung thay vì đoán.
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
    "score": <number between 0 and 100>   # MANDATORY: numeric ATS score
  },
  "recommendation": "yes | no",
  "decision_rationale": {
    "main_reasons": [string],
    "key_missing_factors": [string]
  },
  "counterfactuals": [
    {
      "requirement": string,
      "suggested_change": string,
      "predicted_score_delta": number,
      "confidence": number
    }
  ],
  "contrastive_explanations": [string],
  "decision_path": [string]
}
4. Luôn sử dụng dữ liệu thật từ CV và JD. Nếu thiếu thông tin, yêu cầu người dùng bổ sung.
"""

# ---------------- Core Functions (unchanged) ----------------

def extract_requirements(jd: str) -> List[str]:
    tokens = re.findall(r"[A-Za-z0-9\+\-#\.]{2,}", jd)
    stop = {"and", "or", "with", "of", "for", "to", "in", "the", "a", "an", "on", "at", "is"}
    cleaned = [t.lower() for t in tokens if t.lower() not in stop]
    counts = Counter(cleaned)
    return [k for k, _ in counts.most_common(40)]

def score_cv(cv: str, requirements: List[str], rubric: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    cv_l = cv.lower()
    reqs = [r.lower() for r in requirements]
    matched = [r for r in reqs if r in cv_l]
    missing = [r for r in reqs if r not in cv_l]

    breakdown = []
    if rubric:
        total_weight = sum(item.get("weight", 0.0) for item in rubric) or 1.0
        acc = 0.0
        for item in rubric:
            skill = (item.get("skill") or "").lower()
            weight = float(item.get("weight", 0.0))
            must = bool(item.get("must_have", False))
            hit = skill in cv_l if skill else False
            partial = 1.0 if hit else 0.0
            contrib = (weight / total_weight) * (100.0 * partial)
            if must and not hit:
                contrib -= (weight / total_weight) * 20.0
            acc += contrib
            breakdown.append({"skill": skill, "weight": weight, "must_have": must, "hit": hit})
        raw_score = max(0.0, min(100.0, acc))
    else:
        denom = max(1, len(reqs))
        raw_score = round(100.0 * (len(matched) / denom), 2)

    return {"matched": matched, "missing": missing, "rubric_breakdown": breakdown, "raw_score": float(raw_score)}

def suggest_edits(cv: str, jd: str) -> List[str]:
    suggestions = [
        "Thêm số liệu định lượng (%, số, thời gian hoặc kết quả cụ thể) ở các dòng thành tựu.",
        "Đưa kỹ năng quan trọng từ JD vào phần 'Skills' và phần đầu Summary.",
        "Viết bullet theo cấu trúc: [Hành động] + [Công nghệ] + [Kết quả có số liệu].",
        "Loại bỏ hoặc rút gọn phần không liên quan để tăng mật độ tín hiệu."
    ]
    kws = extract_requirements(jd)[:5]
    if kws:
        suggestions.append(f"Xem xét chèn từ khoá ưu tiên: {', '.join(kws[:3])}.")
    return suggestions

def build_cv_jd_match(cv: str, jd: str) -> Dict[str, Any]:
    """
    Step 1: Produce structured match results between CV & JD (mocked).
    This is the tool the LLM is instructed to call first.
    """
    # Mock JD requirements (can replace with parsing later)
    jd_requirements = [
        {"name": "python", "weight": 0.3, "must_have": True},
        {"name": "mlops", "weight": 0.2, "must_have": False},
        {"name": "kubernetes", "weight": 0.1, "must_have": False},
        {"name": "leadership", "weight": 0.1, "must_have": False},
    ]

    cv_lower = (cv or "").lower()
    cv_mentions = []
    for req in jd_requirements:
        if req["name"] in cv_lower:
            snippet = f"... found '{req['name']}' in CV ..."
            cv_mentions.append({"name": req["name"], "context": snippet})

    match_results = []
    for req in jd_requirements:
        found = next((m for m in cv_mentions if m["name"] == req["name"]), None)
        match_results.append({
            "requirement": req["name"],
            "weight": req["weight"],
            "must_have": req["must_have"],
            "matched": bool(found),
            "evidence": found["context"] if found else None,
        })

    # raw_score: sum of weights matched (range 0..sum(weights)=~0..0.7..1.0 depending)
    raw_score = round(sum(r["weight"] for r in match_results if r["matched"]), 4)

    # Debug print so you can see tool invocation in server logs
    print("build_cv_jd_match invoked. match_results:", json.dumps(match_results, ensure_ascii=False, indent=2))

    # Provide a suggestion for ATS score (0-100) based on matched weight
    ats_score_suggestion = round(raw_score * 100, 2)

    return {
        "jd_requirements": jd_requirements,
        "cv_mentions": cv_mentions,
        "match_results": match_results,
        "raw_score": raw_score,
        "ats_score_suggestion": ats_score_suggestion,
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

        # Heuristic predicted delta:
        # must-have missing -> larger delta
        predicted_delta = round(10 + weight * 50, 2) if must else round(5 + weight * 30, 2)
        # confidence heuristic
        confidence = 0.9 if must else 0.7

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
            "suggested_change": suggested_change,
            "predicted_score_delta": predicted_delta,
            "confidence": confidence
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
        "decision_path": decision_path,
        "predicted_new_score_example": round(raw_score * 100 + sum(c["predicted_score_delta"] for c in counterfactuals[:1]), 2)
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
            f"If candidate adds '{cf['requirement']}', predicted +{cf.get('predicted_score_delta')} (est), "
            f"actual +{cf.get('actual_delta_pct')} (pct). Impact ratio {cf.get('impact_ratio')}."
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
extract_requirements_tool = FunctionTool(func=extract_requirements)
score_cv_tool            = FunctionTool(func=score_cv)
suggest_edits_tool       = FunctionTool(func=suggest_edits)
build_cv_jd_match_tool   = FunctionTool(func=build_cv_jd_match)
generate_counterfactuals_tool = FunctionTool(func=generate_counterfactuals)
validate_and_rank_counterfactuals_tool = FunctionTool(func=validate_and_rank_counterfactuals)

# ---------------- Root Agent ----------------
root_agent = Agent(
    name="cv_jd_evaluator",
    model="gemini-2.0-flash",
    description="Đánh giá CV ứng viên so với Job Description, trả về báo cáo chi tiết đa chiều",
    instruction=INSTRUCTION,
    tools=[
        extract_requirements_tool,
        score_cv_tool,
        suggest_edits_tool,
        build_cv_jd_match_tool,             # Step 1
        generate_counterfactuals_tool,      # Step 2
        validate_and_rank_counterfactuals_tool,  # Steps 3-5
    ],
)