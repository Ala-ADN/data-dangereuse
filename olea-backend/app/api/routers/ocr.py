"""
OCR router — upload single or multiple document images for field extraction.

Supported formats: JPEG, PNG, PDF (first page).
Max 5 files, 10MB each.

The response includes:
- extracted field values (None for anything OCR couldn't read)
- per-field confidence scores
- per-field status (extracted / empty / failed / missing)
- unmatched lines for debugging

The frontend should display extracted fields in an editable form
so the user can correct OCR errors and fill in missing values.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException

from app.schemas.ocr import OCRResponse
from app.services import ocr_service

router = APIRouter(prefix="/ocr", tags=["ocr"])

ALLOWED_TYPES = {
    "image/jpeg", "image/png", "image/jpg", "image/webp",
    "application/pdf",
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_FILES = 5


@router.post("/extract", response_model=OCRResponse)
async def extract_document(file: UploadFile = File(...)):
    """
    Extract insurance form fields from a single uploaded document.

    Upload a photo of a paper form with lines like:
        Adult Dependents: 2
        Estimated Annual Income: 65000
        Employment Status: Employed
        ...

    Returns extracted values mapped to dataset columns.
    Fields OCR couldn't read will be null — fill them in the form.
    """
    _validate_file(file)
    contents = await file.read()
    result = await ocr_service.extract_document(contents, file.filename or "unknown")
    return result


@router.post("/extract-multiple", response_model=OCRResponse)
async def extract_multiple_documents(files: list[UploadFile] = File(...)):
    """
    Extract fields from multiple document images and merge results.

    Useful when the form spans multiple pages or the user uploads
    several related documents (ID card + insurance quote + pay stub).

    Fields are merged by highest confidence — if two files both extract
    'Annual Income', the one with higher OCR confidence wins.
    """
    if len(files) > MAX_FILES:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_FILES} files allowed, got {len(files)}",
        )

    for f in files:
        _validate_file(f)

    file_data = []
    for f in files:
        contents = await f.read()
        file_data.append((contents, f.filename or "unknown"))

    result = await ocr_service.extract_multiple_documents(file_data)
    return result


def _validate_file(file: UploadFile) -> None:
    """Validate file type and size."""
    if file.content_type and file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. "
                   f"Allowed: JPEG, PNG, WebP, PDF",
        )

    # Check filename extension as fallback
    if file.filename:
        ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
        if ext not in ("jpg", "jpeg", "png", "webp", "pdf"):
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file extension: .{ext}",
            )

