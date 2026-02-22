"""
OCR schemas — request/response models for the OCR extraction endpoint.

Fields use Optional types because OCR may fail on any individual field.
The frontend shows extracted values and lets the user fix/fill empty ones.
"""

from typing import Any, Optional

from pydantic import BaseModel


class InsuranceFormFields(BaseModel):
    """All dataset columns the OCR aims to extract. None = not found / user must fill."""
    # Demographics & Financials
    Adult_Dependents: Optional[int] = None
    Child_Dependents: Optional[int] = None
    Infant_Dependents: Optional[int] = None
    Estimated_Annual_Income: Optional[float] = None
    Employment_Status: Optional[str] = None
    Region_Code: Optional[str] = None

    # Customer History & Risk Profile
    Existing_Policyholder: Optional[bool] = None
    Previous_Claims_Filed: Optional[int] = None
    Years_Without_Claims: Optional[int] = None
    Previous_Policy_Duration_Months: Optional[int] = None
    Policy_Cancelled_Post_Purchase: Optional[bool] = None

    # Policy Details & Preferences
    Deductible_Tier: Optional[str] = None
    Payment_Schedule: Optional[str] = None
    Vehicles_on_Policy: Optional[int] = None
    Custom_Riders_Requested: Optional[int] = None
    Grace_Period_Extensions: Optional[int] = None

    # Sales & Underwriting
    Days_Since_Quote: Optional[int] = None
    Underwriting_Processing_Days: Optional[int] = None
    Policy_Amendments_Count: Optional[int] = None
    Acquisition_Channel: Optional[str] = None
    Broker_Agency_Type: Optional[str] = None
    Broker_ID: Optional[str] = None
    Employer_ID: Optional[str] = None

    # Timeline
    Policy_Start_Year: Optional[int] = None
    Policy_Start_Month: Optional[str] = None
    Policy_Start_Week: Optional[int] = None
    Policy_Start_Day: Optional[int] = None


class ExtractionStats(BaseModel):
    """Statistics about the OCR extraction quality."""
    total_lines: int = 0
    matched_fields: int = 0
    empty_fields: int = 0
    missing_fields: int = 0
    failed_fields: int = 0
    total_files: Optional[int] = None  # only for multi-file


class OCRResponse(BaseModel):
    """Response from the OCR extraction endpoint."""
    filename: str
    extracted_text: str
    ocr_engine: str = "none"
    fields: dict[str, Any]                          # canonical_name → value (or None)
    field_confidences: dict[str, float]              # canonical_name → 0.0-1.0
    field_statuses: dict[str, str]                   # canonical_name → extracted|empty|failed|missing
    confidence: float                                # overall confidence 0.0-1.0
    stats: ExtractionStats
    unmatched_lines: list[str] = []                  # lines OCR read but couldn't map

