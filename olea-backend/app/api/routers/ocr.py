from fastapi import APIRouter, UploadFile, File

from app.schemas.ocr import OCRResponse
from app.services import ocr_service

router = APIRouter(prefix="/ocr", tags=["ocr"])


@router.post("/extract", response_model=OCRResponse)
async def extract_document(file: UploadFile = File(...)):
    contents = await file.read()
    result = await ocr_service.extract_document(contents, file.filename)
    return result
