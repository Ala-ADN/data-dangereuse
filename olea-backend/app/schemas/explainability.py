from uuid import UUID

from pydantic import BaseModel


class FeatureImportance(BaseModel):
    feature: str
    importance: float


class ExplainabilityResponse(BaseModel):
    prediction_id: UUID
    method: str
    feature_importances: list[FeatureImportance]
    summary: str
    llm_explanation: str | None = None
