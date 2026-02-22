from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class PredictionRequest(BaseModel):
    form_id: UUID


class PredictionResult(BaseModel):
    purchased_coverage_bundle: int
    confidence: float
    probabilities: dict[str, float] | None = None


class PredictionResponse(BaseModel):
    id: UUID
    form_id: UUID
    model_version: str
    result: dict
    confidence: float
    explanation: dict | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
