from uuid import UUID

from pydantic import BaseModel


class ExplainabilityRequest(BaseModel):
    prediction_id: UUID


class FeatureImportance(BaseModel):
    feature: str
    importance: float
    direction: str  # "positive" or "negative"


INSURANCE_FEATURES = [
    "Region_Code", "Broker_ID", "Broker_Agency_Type", "Estimated_Annual_Income",
    "Employment_Status", "Adult_Dependents", "Child_Dependents", "Infant_Dependents",
    "Previous_Policy_Duration_Months", "Previous_Claims_Filed", "Years_Without_Claims",
    "Deductible_Tier", "Vehicles_on_Policy", "Custom_Riders_Requested",
    "Acquisition_Channel", "Payment_Schedule", "Days_Since_Quote",
    "Underwriting_Processing_Days", "Policy_Start_Month",
    # Engineered features
    "Total_Dependents", "Has_Dependents", "Income_Per_Dependent", "Log_Income",
    "Claims_Ratio", "Has_Previous_Policy", "Quote_UW_Ratio", "Vehicles_Plus_Riders",
    "Month_Sin", "Month_Cos", "Region_Freq", "Broker_Freq",
]


class ExplainabilityResponse(BaseModel):
    prediction_id: UUID
    method: str
    feature_importances: list[FeatureImportance]
    summary: str
