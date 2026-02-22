"""
Integration tests for the OCR service (end-to-end pipeline).

These tests generate a form image, run OCR, and verify field extraction.
Requires Tesseract to be installed (skipped if not available).
"""

import io
import pytest

from PIL import Image, ImageDraw, ImageFont


def _tesseract_available() -> bool:
    try:
        import pytesseract
        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False


skip_no_tesseract = pytest.mark.skipif(
    not _tesseract_available(),
    reason="Tesseract OCR not installed",
)


def _generate_form_bytes(fields: dict[str, str]) -> bytes:
    """Generate a simple form image as PNG bytes."""
    width, height = 800, 40 * len(fields) + 100
    img = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(img)

    try:
        font = ImageFont.truetype("cour.ttf", 18)
    except (OSError, IOError):
        font = ImageFont.load_default()

    y = 40
    for label, value in fields.items():
        draw.text((50, y), f"{label}: {value}", fill="black", font=font)
        y += 36

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@skip_no_tesseract
class TestOCRServiceIntegration:
    @pytest.mark.asyncio
    async def test_extract_full_form(self):
        from app.services.ocr_service import extract_document

        form_bytes = _generate_form_bytes({
            "Adult Dependents": "2",
            "Child Dependents": "1",
            "Estimated Annual Income": "65000",
            "Employment Status": "Employed",
            "Deductible Tier": "Medium",
            "Vehicles on Policy": "3",
        })

        result = await extract_document(form_bytes, "test_form.png")

        assert result["filename"] == "test_form.png"
        assert result["ocr_engine"] != "none"
        assert result["confidence"] > 0.0
        assert "fields" in result
        assert "field_statuses" in result

    @pytest.mark.asyncio
    async def test_extract_empty_image(self):
        from app.services.ocr_service import extract_document

        # Pure white image — no text
        img = Image.new("RGB", (400, 400), "white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")

        result = await extract_document(buf.getvalue(), "blank.png")

        assert result["confidence"] == 0.0
        assert all(v is None for v in result["fields"].values())

    @pytest.mark.asyncio
    async def test_extract_multiple_merge(self):
        from app.services.ocr_service import extract_multiple_documents

        form1 = _generate_form_bytes({
            "Adult Dependents": "2",
            "Employment Status": "Employed",
        })
        form2 = _generate_form_bytes({
            "Vehicles on Policy": "3",
            "Deductible Tier": "High",
        })

        result = await extract_multiple_documents([
            (form1, "page1.png"),
            (form2, "page2.png"),
        ])

        assert "page1.png" in result["filename"]
        assert "page2.png" in result["filename"]
        # Should have merged fields from both
        assert result["stats"]["total_files"] == 2
