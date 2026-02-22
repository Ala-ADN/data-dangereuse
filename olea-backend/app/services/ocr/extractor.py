"""
OCR text extractor — wraps pytesseract (primary) with EasyOCR fallback.

Extracts raw text from a preprocessed PIL Image.
Returns text + overall OCR confidence score.
"""

from __future__ import annotations

import io
import logging
from dataclasses import dataclass
from typing import Optional

from PIL import Image

logger = logging.getLogger(__name__)


@dataclass
class ExtractionResult:
    """Raw OCR output."""
    text: str
    confidence: float  # 0.0 – 1.0
    engine: str        # "pytesseract" | "easyocr" | "none"
    line_confidences: list[float]  # per-line confidence scores


def extract_text(
    img: Image.Image,
    *,
    lang: str = "eng+fra",
    engine: str = "auto",
) -> ExtractionResult:
    """
    Extract text from a preprocessed image.

    Args:
        img: Preprocessed PIL Image (grayscale, cleaned).
        lang: Tesseract language string (e.g. "eng+fra+ara").
        engine: "pytesseract", "easyocr", or "auto" (try pytesseract first).

    Returns:
        ExtractionResult with text, confidence, and engine used.
    """
    if engine == "auto":
        # Try pytesseract first (faster, lighter)
        result = _try_pytesseract(img, lang)
        if result and result.confidence > 0.3:
            return result

        # Fallback to EasyOCR
        result = _try_easyocr(img, lang)
        if result:
            return result

        # Last resort: return empty
        logger.warning("All OCR engines failed")
        return ExtractionResult(text="", confidence=0.0, engine="none", line_confidences=[])

    elif engine == "pytesseract":
        result = _try_pytesseract(img, lang)
        return result or ExtractionResult(text="", confidence=0.0, engine="pytesseract", line_confidences=[])

    elif engine == "easyocr":
        result = _try_easyocr(img, lang)
        return result or ExtractionResult(text="", confidence=0.0, engine="easyocr", line_confidences=[])

    else:
        raise ValueError(f"Unknown OCR engine: {engine}")


def _try_pytesseract(img: Image.Image, lang: str) -> Optional[ExtractionResult]:
    """Try OCR with pytesseract."""
    try:
        import pytesseract
    except ImportError:
        logger.debug("pytesseract not installed, skipping")
        return None

    try:
        # Get detailed data with confidence per word
        data = pytesseract.image_to_data(img, lang=lang, output_type=pytesseract.Output.DICT)

        # Build text line by line and compute per-line confidence
        lines: dict[int, list[tuple[str, float]]] = {}
        for i, word in enumerate(data["text"]):
            if not word.strip():
                continue
            line_num = data["line_num"][i]
            conf = float(data["conf"][i])
            if conf < 0:
                conf = 0.0
            else:
                conf = conf / 100.0  # normalize to 0-1
            lines.setdefault(line_num, []).append((word, conf))

        # Reconstruct text and compute line-level confidence
        text_lines = []
        line_confidences = []
        for line_num in sorted(lines.keys()):
            words = lines[line_num]
            line_text = " ".join(w for w, _ in words)
            line_conf = sum(c for _, c in words) / len(words) if words else 0.0
            text_lines.append(line_text)
            line_confidences.append(round(line_conf, 3))

        full_text = "\n".join(text_lines)
        avg_conf = sum(line_confidences) / len(line_confidences) if line_confidences else 0.0

        logger.info("pytesseract: %d lines, avg confidence %.2f", len(text_lines), avg_conf)

        return ExtractionResult(
            text=full_text,
            confidence=round(avg_conf, 3),
            engine="pytesseract",
            line_confidences=line_confidences,
        )

    except Exception:
        logger.exception("pytesseract extraction failed")
        return None


def _try_easyocr(img: Image.Image, lang: str) -> Optional[ExtractionResult]:
    """Try OCR with EasyOCR."""
    try:
        import easyocr
    except ImportError:
        logger.debug("easyocr not installed, skipping")
        return None

    try:
        # Map tesseract lang codes to EasyOCR
        lang_map = {"eng": "en", "fra": "fr", "ara": "ar"}
        easyocr_langs = []
        for l in lang.split("+"):
            mapped = lang_map.get(l, l)
            if mapped not in easyocr_langs:
                easyocr_langs.append(mapped)

        reader = easyocr.Reader(easyocr_langs, gpu=False)

        # Convert PIL → numpy array
        import numpy as np
        img_array = np.array(img)

        results = reader.readtext(img_array, detail=1, paragraph=False)

        # Sort by vertical position (top to bottom)
        results.sort(key=lambda r: r[0][0][1])  # sort by top-left Y

        text_lines = []
        line_confidences = []

        # Group by approximate Y position into lines
        current_line_words = []
        current_y = None
        y_threshold = 20  # pixels

        for bbox, text, conf in results:
            y = bbox[0][1]  # top-left Y
            if current_y is None or abs(y - current_y) > y_threshold:
                if current_line_words:
                    line_text = " ".join(w for w, _ in current_line_words)
                    line_conf = sum(c for _, c in current_line_words) / len(current_line_words)
                    text_lines.append(line_text)
                    line_confidences.append(round(line_conf, 3))
                current_line_words = [(text, conf)]
                current_y = y
            else:
                current_line_words.append((text, conf))

        # Don't forget last line
        if current_line_words:
            line_text = " ".join(w for w, _ in current_line_words)
            line_conf = sum(c for _, c in current_line_words) / len(current_line_words)
            text_lines.append(line_text)
            line_confidences.append(round(line_conf, 3))

        full_text = "\n".join(text_lines)
        avg_conf = sum(line_confidences) / len(line_confidences) if line_confidences else 0.0

        logger.info("easyocr: %d lines, avg confidence %.2f", len(text_lines), avg_conf)

        return ExtractionResult(
            text=full_text,
            confidence=round(avg_conf, 3),
            engine="easyocr",
            line_confidences=line_confidences,
        )

    except Exception:
        logger.exception("easyocr extraction failed")
        return None
