from pydantic import BaseModel


class InsuranceFormFields(BaseModel):
    """Fields the OCR service aims to extract from insurance documents."""
    User_ID: str | None = None
    Region_Code: str | None = None
    Broker_ID: float | None = None
    Broker_Agency_Type: str | None = None
    Employer_ID: str | None = None
    Estimated_Annual_Income: float | None = None
    Employment_Status: str | None = None
    Adult_Dependents: int | None = None
    Child_Dependents: int | None = None
    Infant_Dependents: int | None = None
    Previous_Policy_Duration_Months: int | None = None
    Previous_Claims_Filed: int | None = None
    Years_Without_Claims: int | None = None
    Deductible_Tier: str | None = None
    Vehicles_on_Policy: int | None = None
    Custom_Riders_Requested: int | None = None
    Acquisition_Channel: str | None = None
    Payment_Schedule: str | None = None
    Days_Since_Quote: int | None = None
    Underwriting_Processing_Days: int | None = None
    Policy_Start_Month: str | None = None


class OCRResponse(BaseModel):
    filename: str
    extracted_text: str
    fields: InsuranceFormFields
    confidence: float
