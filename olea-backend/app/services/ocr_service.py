"""
OCR service — orchestrates the full pipeline:
    image bytes → preprocess → extract text → parse fields → structured JSON

Supports single and multi-file processing with result merging.
"""

from __future__ import annotations

import logging
from typing import Any

from app.services.ocr.preprocessor import preprocess
from app.services.ocr.extractor import extract_text, ExtractionResult
from app.services.ocr.field_parser import (
    parse_text,
    fields_to_dict,
    fields_to_confidence_dict,
    fields_to_status_dict,
    ParseResult,
)
from app.services.ocr.field_map import ALL_COLUMNS

logger = logging.getLogger(__name__)


async def extract_document(file_bytes: bytes, filename: str) -> dict:
    """
    Process a single document image through the full OCR pipeline.

    Args:
        file_bytes: Raw bytes of the uploaded file.
        filename: Original filename (for logging / PDF detection).
    Returns:
        Dict matching OCRResponse schema.
    """
    # 1. Handle PDF → rasterize first page
    if filename.lower().endswith(".pdf"):
        file_bytes = _pdf_to_image_bytes(file_bytes)

    # 2. Preprocess the image
    try:
        img = preprocess(file_bytes)
    except Exception:
        logger.exception("Image preprocessing failed for %s", filename)
        return _empty_response(filename, error="Image preprocessing failed")

    # 3. Extract text via OCR
    try:
        extraction = extract_text(img)
    except Exception:
        logger.exception("OCR extraction failed for %s", filename)
        return _empty_response(filename, error="OCR extraction failed")

    if not extraction.text.strip():
        return _empty_response(filename, error="No text detected in image")

    # 4. Parse extracted text into structured fields
    parse_result = parse_text(
        extraction.text,
        line_confidences=extraction.line_confidences,
    )

    # 5. Build response
    fields_dict = fields_to_dict(parse_result)
    confidence_dict = fields_to_confidence_dict(parse_result)
    status_dict = fields_to_status_dict(parse_result)

    overall_confidence = _compute_overall_confidence(parse_result, extraction)

    return {
        "filename": filename,
        "extracted_text": extraction.text,
        "ocr_engine": extraction.engine,
        "fields": fields_dict,
        "field_confidences": confidence_dict,
        "field_statuses": status_dict,
        "confidence": round(overall_confidence, 3),
        "stats": {
            "total_lines": parse_result.total_lines,
            "matched_fields": parse_result.matched_count,
            "empty_fields": parse_result.empty_count,
            "missing_fields": sum(
                1 for s in status_dict.values() if s == "missing"
            ),
            "failed_fields": sum(
                1 for s in status_dict.values() if s == "failed"
            ),
        },
        "unmatched_lines": parse_result.unmatched_lines,
    }


async def extract_multiple_documents(
    files: list[tuple[bytes, str]],
) -> dict:
    """
    Process multiple document images and merge results.

    Later files override earlier ones only if they have higher confidence
    for a given field (so scanning multiple pages works).

    Args:
        files: List of (file_bytes, filename) tuples.

    Returns:
        Merged OCRResponse dict.
    """
    if not files:
        return _empty_response("no_files", error="No files provided")

    all_results = []
    all_text_parts = []
    all_unmatched = []

    for file_bytes, filename in files:
        result = await extract_document(file_bytes, filename)
        all_results.append(result)
        all_text_parts.append(f"--- {filename} ---\n{result['extracted_text']}")
        all_unmatched.extend(result.get("unmatched_lines", []))

    # Merge: for each field, take the value with highest confidence
    merged_fields: dict[str, Any] = {col: None for col in ALL_COLUMNS}
    merged_confidences: dict[str, float] = {col: 0.0 for col in ALL_COLUMNS}
    merged_statuses: dict[str, str] = {col: "missing" for col in ALL_COLUMNS}

    for result in all_results:
        fields = result.get("fields", {})
        confs = result.get("field_confidences", {})
        stats = result.get("field_statuses", {})

        for col in ALL_COLUMNS:
            new_conf = confs.get(col, 0.0)
            new_status = stats.get(col, "missing")
            old_conf = merged_confidences[col]

            # Override if new value has higher confidence
            if new_status == "extracted" and new_conf > old_conf:
                merged_fields[col] = fields.get(col)
                merged_confidences[col] = new_conf
                merged_statuses[col] = new_status
            elif new_status == "empty" and old_conf == 0.0:
                merged_statuses[col] = "empty"
                merged_confidences[col] = new_conf

    # Stats
    total_extracted = sum(1 for s in merged_statuses.values() if s == "extracted")
    total_empty = sum(1 for s in merged_statuses.values() if s == "empty")
    total_missing = sum(1 for s in merged_statuses.values() if s == "missing")
    total_failed = sum(1 for s in merged_statuses.values() if s == "failed")

    avg_conf = (
        sum(merged_confidences.values()) / len(merged_confidences)
        if merged_confidences else 0.0
    )

    filenames = [f for _, f in files]

    return {
        "filename": ", ".join(filenames),
        "extracted_text": "\n\n".join(all_text_parts),
        "ocr_engine": all_results[0].get("ocr_engine", "none") if all_results else "none",
        "fields": merged_fields,
        "field_confidences": merged_confidences,
        "field_statuses": merged_statuses,
        "confidence": round(avg_conf, 3),
        "stats": {
            "total_files": len(files),
            "total_lines": sum(r.get("stats", {}).get("total_lines", 0) for r in all_results),
            "matched_fields": total_extracted,
            "empty_fields": total_empty,
            "missing_fields": total_missing,
            "failed_fields": total_failed,
        },
        "unmatched_lines": all_unmatched,
    }


def _compute_overall_confidence(
    parse_result: ParseResult,
    extraction: ExtractionResult,
) -> float:
    """Combine OCR quality and field matching into one score."""
    ocr_conf = extraction.confidence
    total_fields = len(ALL_COLUMNS)
    matched = parse_result.matched_count
    match_ratio = matched / total_fields if total_fields > 0 else 0.0

    # 40% OCR quality, 60% field match success
    return 0.4 * ocr_conf + 0.6 * match_ratio


def _pdf_to_image_bytes(pdf_bytes: bytes) -> bytes:
    """Convert first page of PDF to image bytes."""
    try:
        from pdf2image import convert_from_bytes
        images = convert_from_bytes(pdf_bytes, first_page=1, last_page=1, dpi=300)
        if images:
            import io
            buf = io.BytesIO()
            images[0].save(buf, format="PNG")
            return buf.getvalue()
    except ImportError:
        logger.warning("pdf2image not installed — cannot process PDFs")
    except Exception:
        logger.exception("PDF to image conversion failed")
    raise ValueError("Could not convert PDF to image. Install pdf2image + poppler.")


def _empty_response(filename: str, error: str = "") -> dict:
    """Return a response with all fields set to None (user must fill manually)."""
    return {
        "filename": filename,
        "extracted_text": error or "No text extracted",
        "ocr_engine": "none",
        "fields": {col: None for col in ALL_COLUMNS},
        "field_confidences": {col: 0.0 for col in ALL_COLUMNS},
        "field_statuses": {col: "missing" for col in ALL_COLUMNS},
        "confidence": 0.0,
        "stats": {
            "total_lines": 0,
            "matched_fields": 0,
            "empty_fields": 0,
            "missing_fields": len(ALL_COLUMNS),
            "failed_fields": 0,
        },
        "unmatched_lines": [],
    }
