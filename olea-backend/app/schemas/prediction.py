from __future__ import annotations

import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator


class PredictionRequest(BaseModel):
    form_id: UUID


class PredictionFromFeaturesRequest(BaseModel):
    """Direct prediction from raw features sent by the frontend."""
    User_ID: str | None = None
    Region_Code: str | None = None
    Broker_ID: float | None = None

    @field_validator("Broker_ID", mode="before")
    @classmethod
    def coerce_broker_id(cls, v: object) -> float | None:
        """Accept 'BRK-4421' style strings → extract numeric part → 4421.0."""
        if v is None or v == "":
            return None
        if isinstance(v, (int, float)):
            return float(v)
        s = str(v)
        m = re.search(r"[\d.]+", s)
        return float(m.group()) if m else None
    Broker_Agency_Type: str | None = None
    Employer_ID: str | None = None
    Estimated_Annual_Income: float
    Employment_Status: str
    Adult_Dependents: int
    Child_Dependents: int | None = None
    Infant_Dependents: int
    Previous_Policy_Duration_Months: int
    Previous_Claims_Filed: int
    Years_Without_Claims: int
    Deductible_Tier: str | None = None
    Vehicles_on_Policy: int
    Custom_Riders_Requested: int
    Acquisition_Channel: str | None = None
    Payment_Schedule: str
    Days_Since_Quote: int
    Underwriting_Processing_Days: int
    Policy_Start_Month: str
    # Additional fields required by the XGB model
    Policy_Cancelled_Post_Purchase: int = 0
    Policy_Start_Year: int = 2025
    Policy_Start_Week: int = 1
    Policy_Start_Day: int = 1
    Grace_Period_Extensions: int = 0
    Existing_Policyholder: int = 0
    Policy_Amendments_Count: int = 0


class PredictionResponse(BaseModel):
    id: UUID
    form_id: UUID
    model_version: str
    result: dict
    confidence: float
    explanation: dict | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
