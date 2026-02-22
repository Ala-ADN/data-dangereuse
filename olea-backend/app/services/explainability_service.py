import logging
from uuid import UUID

from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.prediction import Prediction
from app.services import form_service

logger = logging.getLogger(__name__)

FEATURE_DESCRIPTIONS = {
    # Demographics & Coverage
    "Adult_Dependents": "Number of adults covered under the plan.",
    "Child_Dependents": "Number of children covered under the plan.",
    "Infant_Dependents": "Number of infants covered under the plan.",
    "Estimated_Annual_Income": "The estimated yearly income of the household.",
    "Employment_Status": "The professional working arrangement of the primary applicant.",
    "Region_Code": "Anonymized geographic location of the customer.",

    # Customer History & Risk Profile
    "Existing_Policyholder": "Indicates if the user already has another active policy with the company.",
    "Previous_Claims_Filed": "Total number of prior insurance claims filed by the user.",
    "Years_Without_Claims": "Consecutive years the user has gone without filing a claim.",
    "Previous_Policy_Duration_Months": "How many months the user held their prior insurance policy.",
    "Policy_Cancelled_Post_Purchase": "Flag indicating whether the user has a history of canceling policies shortly after buying them.",

    # Policy Details & Preferences
    "Deductible_Tier": "The out-of-pocket deductible level chosen by the user.",
    "Payment_Schedule": "How frequently the user pays their premium (e.g., Monthly, Annual).",
    "Vehicles_on_Policy": "Number of vehicles listed in the user's coverage portfolio.",
    "Custom_Riders_Requested": "Number of special coverage add-ons requested by the user.",
    "Grace_Period_Extensions": "Number of times the user extended their payment deadline.",

    # Sales & Underwriting Process
    "Days_Since_Quote": "Number of days between the initial quote request and finalizing the policy.",
    "Underwriting_Processing_Days": "Days taken by the underwriting department to approve the risk.",
    "Policy_Amendments_Count": "Number of times the user modified the quote details before signing.",
    "Acquisition_Channel": "The platform or method through which the policy was sold.",
    "Broker_Agency_Type": "The scale of the brokerage firm handling the policy.",
    "Broker_ID": "Unique identifier for the specific sales agent.",
    "Employer_ID": "Unique identifier for the user's employer.",

    # Timeline Variables
    "Policy_Start_Year": "The year the coverage officially begins.",
    "Policy_Start_Month": "The month the coverage officially begins.",
    "Policy_Start_Week": "The week of the year the coverage begins.",
    "Policy_Start_Day": "The day of the month the coverage begins.",

    # Engineered Features
    "Total_Dependents": "Total number of dependents (adults + children + infants) on the policy.",
    "Has_Dependents": "Whether the policyholder has any dependents at all (1 = yes, 0 = no).",
    "Income_Per_Dependent": "Estimated annual income divided by the number of dependents plus one.",
    "Log_Income": "Natural logarithm of estimated annual income (smooths extreme values).",
    "Claims_Ratio": "Ratio of previous claims filed to claim-free years (indicates risk behavior).",
    "Has_Previous_Policy": "Whether the user held a prior policy (1 = yes, 0 = no).",
    "Quote_UW_Ratio": "Ratio of days since quote to underwriting processing days.",
    "Vehicles_Plus_Riders": "Combined count of vehicles and custom riders on the policy.",
    "Month_Num": "Numeric month (1-12) of policy start.",
    "Month_Sin": "Sine encoding of the policy start month (captures cyclical pattern).",
    "Month_Cos": "Cosine encoding of the policy start month (captures cyclical pattern).",
    "Region_Freq": "Frequency encoding of the region — how common this region is in the dataset.",
    "Broker_Freq": "Frequency encoding of the broker — how common this broker is in the dataset.",
}


BUNDLE_NAMES = {
    0: "Auto Comprehensive",
    1: "Auto Liability Basic",
    2: "Basic Health",
    3: "Family Comprehensive",
    4: "Health, Dental & Vision",
    5: "Home Premium",
    6: "Home Standard",
    7: "Premium Health & Life",
    8: "Renter Basic",
    9: "Renter Premium",
}


def _build_prompt(prediction_result: dict, feature_importances: list[dict], form_data: dict | None) -> str:
    predicted_bundle_id = prediction_result.get("purchased_coverage_bundle", "unknown")
    bundle_name = BUNDLE_NAMES.get(predicted_bundle_id, f"Bundle {predicted_bundle_id}")
    confidence = prediction_result.get("confidence", 0)
    probabilities = prediction_result.get("probabilities", {})

    # Build readable probabilities with bundle names
    proba_lines = []
    for idx_str, prob in sorted(probabilities.items(), key=lambda x: -x[1]):
        idx = int(idx_str)
        name = BUNDLE_NAMES.get(idx, f"Bundle {idx}")
        if prob > 0.005:
            proba_lines.append(f"  - {name}: {prob:.1%}")
    proba_block = "\n".join(proba_lines) if proba_lines else "  N/A"

    top_features = feature_importances[:15]

    feature_lines = []
    for f in top_features:
        name = f["feature"]
        importance = f["importance"]
        description = FEATURE_DESCRIPTIONS.get(name, "No description available.")
        value = form_data.get(name, "N/A") if form_data else "N/A"
        feature_lines.append(
            f"  - {name} (importance: {importance:.4f}, value: {value}): {description}"
        )
    features_block = "\n".join(feature_lines)

    return f"""You are a friendly, clear insurance explainability assistant for Olea Insurance.
You are writing directly TO THE CUSTOMER to help them understand why a particular coverage bundle
was recommended for them. Use warm, approachable language — no jargon, no technical terms.

## Coverage Bundles Available
0 = Auto Comprehensive, 1 = Auto Liability Basic, 2 = Basic Health, 3 = Family Comprehensive,
4 = Health Dental & Vision, 5 = Home Premium, 6 = Home Standard, 7 = Premium Health & Life,
8 = Renter Basic, 9 = Renter Premium

## Your Recommendation
- Recommended Bundle: {bundle_name}
- Confidence: {confidence:.2%}
- Other bundles that may also suit you:
{proba_block}

## Factors That Shaped This Recommendation (sorted by relevance)
{features_block}

## Task
Write a clear, friendly explanation directly to the CUSTOMER explaining:
1. Which coverage bundle is recommended for them (use the full name, e.g. "Auto Liability Basic"), how confident the assessment is, and mention any close alternative bundles worth considering.
2. In simple terms, which aspects of their situation (family size, income, claims history, etc.) most influenced this recommendation and why those things matter for their coverage.
3. Any highlights — things working in their favor (e.g. clean claims record) or things to be mindful of.
4. A brief, encouraging next step (e.g. "You might also want to explore..." or "Talk to your agent about...").

Keep it concise (3-4 paragraphs), warm and reassuring, written in second person ("you", "your").
Never use raw variable names or technical feature names — only plain English.
Do not mention any model, algorithm, or scoring system — frame it as a personalized "assessment" or "recommendation"."""


async def _call_llm(prompt: str) -> str:
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=800,
    )
    return response.choices[0].message.content


async def get_explanation(db: AsyncSession, prediction_id: UUID) -> dict | None:
    prediction = await db.get(Prediction, prediction_id)
    if not prediction:
        return None

    if not prediction.explanation:
        return {
            "prediction_id": str(prediction_id),
            "method": "unavailable",
            "feature_importances": [],
            "summary": "No explanation was stored for this prediction.",
            "llm_explanation": None,
        }

    # Get form data for the LLM context
    form = await form_service.get_form(db, prediction.form_id)
    form_data = form.data if form else None

    feature_importances = prediction.explanation.get("feature_importances", [])
    summary = prediction.explanation.get("summary", "")

    # Call OpenAI for natural-language explanation
    llm_explanation = None
    if settings.OPENAI_API_KEY:
        try:
            prompt = _build_prompt(prediction.result, feature_importances, form_data)
            llm_explanation = await _call_llm(prompt)
        except Exception:
            logger.exception("OpenAI call failed for prediction %s", prediction_id)
            llm_explanation = "LLM explanation unavailable — API call failed."

    return {
        "prediction_id": str(prediction_id),
        "method": prediction.explanation.get("method", "xgb_feature_importance"),
        "feature_importances": feature_importances,
        "summary": summary,
        "llm_explanation": llm_explanation,
    }
