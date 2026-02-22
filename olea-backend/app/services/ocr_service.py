EXPECTED_FIELDS = [
    "User_ID", "Region_Code", "Broker_ID", "Broker_Agency_Type", "Employer_ID",
    "Estimated_Annual_Income", "Employment_Status", "Adult_Dependents",
    "Child_Dependents", "Infant_Dependents", "Previous_Policy_Duration_Months",
    "Previous_Claims_Filed", "Years_Without_Claims", "Deductible_Tier",
    "Vehicles_on_Policy", "Custom_Riders_Requested", "Acquisition_Channel",
    "Payment_Schedule", "Days_Since_Quote", "Underwriting_Processing_Days",
    "Policy_Start_Month", "Policy_Cancelled_Post_Purchase", "Policy_Start_Year",
    "Policy_Start_Week", "Policy_Start_Day", "Grace_Period_Extensions",
    "Existing_Policyholder", "Policy_Amendments_Count",
]


async def extract_document(file_bytes: bytes, filename: str) -> dict:
    """Extract insurance form fields from an uploaded document.

    TODO: Replace stub with actual OCR engine (Tesseract / PaddleOCR / AWS Textract).
    """
    return {
        "filename": filename,
        "extracted_text": "Stub: OCR extraction not yet implemented.",
        "fields": {field: None for field in EXPECTED_FIELDS},
        "confidence": 0.0,
    }
