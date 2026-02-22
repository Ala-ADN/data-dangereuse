EXPECTED_FIELDS = [
    "User_ID", "Region_Code", "Broker_ID", "Broker_Agency_Type", "Employer_ID",
    "Estimated_Annual_Income", "Employment_Status", "Adult_Dependents",
    "Child_Dependents", "Infant_Dependents", "Previous_Policy_Duration_Months",
    "Previous_Claims_Filed", "Years_Without_Claims", "Deductible_Tier",
    "Vehicles_on_Policy", "Custom_Riders_Requested", "Acquisition_Channel",
    "Payment_Schedule", "Days_Since_Quote", "Underwriting_Processing_Days",
    "Policy_Start_Month",
]


async def extract_document(file_bytes: bytes, filename: str) -> dict:
    """Extract insurance form fields from an uploaded document.

    The OCR pipeline should extract the following fields required by the
    prediction model:

    - User_ID:                        Policyholder identifier
    - Region_Code:                    Geographic region code
    - Broker_ID:                      Broker identifier (nullable)
    - Broker_Agency_Type:             Type of broker agency
    - Employer_ID:                    Employer identifier (often missing)
    - Estimated_Annual_Income:        Annual income estimate
    - Employment_Status:              Employment category
    - Adult_Dependents:               Number of adult dependents
    - Child_Dependents:               Number of child dependents (nullable)
    - Infant_Dependents:              Number of infant dependents
    - Previous_Policy_Duration_Months: Prior policy duration in months
    - Previous_Claims_Filed:          Number of prior claims
    - Years_Without_Claims:           Claim-free years
    - Deductible_Tier:                Deductible tier level
    - Vehicles_on_Policy:             Vehicles covered
    - Custom_Riders_Requested:        Number of custom riders
    - Acquisition_Channel:            How the customer was acquired
    - Payment_Schedule:               Payment frequency
    - Days_Since_Quote:               Days since initial quote
    - Underwriting_Processing_Days:   Underwriting turnaround
    - Policy_Start_Month:             Month name (e.g. "January")

    TODO: Replace stub with actual OCR engine (Tesseract / PaddleOCR / AWS Textract).
    """
    return {
        "filename": filename,
        "extracted_text": "Stub: OCR extraction not yet implemented.",
        "fields": {field: None for field in EXPECTED_FIELDS},
        "confidence": 0.0,
    }
